from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from .views import (
    ads_txt_view,
    gold_rates_feed_view,
    gold_rates_og_svg_view,
    media_serve_cached,
    robots_txt_view,
    sitemap_xml_view,
    spa_index,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("robots.txt", robots_txt_view),
    path("ads.txt", ads_txt_view),
    path("sitemap.xml", sitemap_xml_view),
    path("og/gold-rates.svg", gold_rates_og_svg_view),
    path("feed/gold-rates.xml", gold_rates_feed_view),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.marketplace.urls")),
    path("api/v1/", include("apps.schemes.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            media_serve_cached,
            {"document_root": settings.MEDIA_ROOT},
        ),
        re_path(
            r"^(?!api/|admin/|assets/|static/|media/|sw\.js$|manifest\.webmanifest$|"
            r"robots\.txt$|ads\.txt$|sitemap\.xml$|og/|feed/|"
            r"favicon\.svg$|icon-|apple-touch-icon\.png$|og-preview\.png$).*$",
            spa_index,
        ),
    ]
