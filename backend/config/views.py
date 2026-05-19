"""HTTP views that are not tied to a single app (e.g. SPA shell)."""
from pathlib import Path

from django.conf import settings
from django.http import Http404, HttpResponse

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
    del request
    return HttpResponse(_spa_index_html(), content_type="text/html; charset=utf-8")
