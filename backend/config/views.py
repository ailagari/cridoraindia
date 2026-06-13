"""HTTP views that are not tied to a single app (e.g. SPA shell)."""
from pathlib import Path

from django.conf import settings
from django.http import Http404, HttpResponse

from .seo import (
    gold_rates_feed_xml,
    gold_rates_og_svg,
    inject_route_seo,
    robots_txt,
    sitemap_xml,
)

_SPA_BASE_TAG = '<base href="/" />'


def _spa_index_html() -> str:
    path = Path(settings.FRONTEND_DIST) / "index.html"
    if not path.is_file():
        raise Http404("Frontend build missing; run the frontend build before production.")
    html = path.read_text(encoding="utf-8")
    if "<base " not in html.lower():
        # Vite `base: './'` makes ./assets resolve under /dashboard/... on hard refresh (blank page).
        html = html.replace("<head>", f"<head>\n    {_SPA_BASE_TAG}", 1)
    return html


def spa_index(request):
    html = inject_route_seo(_spa_index_html(), request.path)
    return HttpResponse(html, content_type="text/html; charset=utf-8")


def robots_txt_view(request):
    del request
    return HttpResponse(robots_txt(), content_type="text/plain; charset=utf-8")


def sitemap_xml_view(request):
    del request
    return HttpResponse(sitemap_xml(), content_type="application/xml; charset=utf-8")


def gold_rates_og_svg_view(request):
    label = (request.GET.get("label") or "Kerala Gold Rate Today").strip()[:120]
    svg = gold_rates_og_svg(label)
    response = HttpResponse(svg, content_type="image/svg+xml; charset=utf-8")
    response["Cache-Control"] = "public, max-age=120"
    return response


def gold_rates_feed_view(request):
    del request
    xml = gold_rates_feed_xml()
    response = HttpResponse(xml, content_type="application/rss+xml; charset=utf-8")
    response["Cache-Control"] = "public, max-age=300"
    return response
