"""HTTP views that are not tied to a single app (e.g. SPA shell)."""
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404


def spa_index(request):
    path = Path(settings.FRONTEND_DIST) / "index.html"
    if not path.is_file():
        raise Http404("Frontend build missing; run the frontend build before production.")
    return FileResponse(path.open("rb"), content_type="text/html; charset=utf-8")
