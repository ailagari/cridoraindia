from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

from .views import (
    gold_rates_feed_view,
    gold_rates_og_svg_view,
    robots_txt_view,
    sitemap_xml_view,
    spa_index,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("robots.txt", robots_txt_view),
    path("sitemap.xml", sitemap_xml_view),
    path("og/gold-rates.svg", gold_rates_og_svg_view),
    path("feed/gold-rates.xml", gold_rates_feed_view),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.marketplace.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
        re_path(
            r"^(?!api/|admin/|assets/|static/|media/|sw\.js$|manifest\.webmanifest$|"
            r"robots\.txt$|sitemap\.xml$|og/|feed/|"
            r"favicon\.svg$|icon-|apple-touch-icon\.png$).*$",
            spa_index,
        ),
    ]
