"""Serve SEO files before WhiteNoise / SPA routing (avoids HTML sitemap for Google)."""
from __future__ import annotations

from django.http import HttpResponse


class SeoFilesMiddleware:
    """Return XML/plain SEO assets for crawlers — must run before WhiteNoise."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path_info.split("?", 1)[0]
        if path == "/sitemap.xml":
            from .seo import sitemap_xml

            response = HttpResponse(sitemap_xml(), content_type="application/xml; charset=utf-8")
            response["Cache-Control"] = "public, max-age=3600"
            return response
        if path == "/robots.txt":
            from .seo import robots_txt

            response = HttpResponse(robots_txt(), content_type="text/plain; charset=utf-8")
            response["Cache-Control"] = "public, max-age=86400"
            return response
        if path == "/ads.txt":
            from .seo import ads_txt

            response = HttpResponse(ads_txt(), content_type="text/plain; charset=utf-8")
            response["Cache-Control"] = "public, max-age=86400"
            return response
        if path == "/feed/gold-rates.xml":
            from .seo import gold_rates_feed_xml

            response = HttpResponse(gold_rates_feed_xml(), content_type="application/rss+xml; charset=utf-8")
            response["Cache-Control"] = "public, max-age=300"
            return response
        if path == "/og/gold-rates.svg":
            from .seo import gold_rates_og_svg

            label = (request.GET.get("label") or "Kerala Gold Rate Today").strip()[:120]
            response = HttpResponse(gold_rates_og_svg(label), content_type="image/svg+xml; charset=utf-8")
            response["Cache-Control"] = "public, max-age=120"
            return response
        return self.get_response(request)
