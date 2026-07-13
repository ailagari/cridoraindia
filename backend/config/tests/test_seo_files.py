from django.test import RequestFactory, SimpleTestCase, override_settings

from config.middleware import SeoFilesMiddleware
from config.seo import inject_adsense_verification, inject_ga4, inject_route_seo, sitemap_xml


class SeoFilesMiddlewareTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.middleware = SeoFilesMiddleware(lambda request: None)

    def test_sitemap_returns_xml_not_html(self):
        request = self.factory.get("/sitemap.xml")
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/xml", response["Content-Type"])
        body = response.content.decode("utf-8")
        self.assertTrue(body.startswith("<?xml"))
        self.assertIn("<urlset", body)
        self.assertNotIn("<!doctype html>", body.lower())

    def test_robots_returns_plain_text(self):
        request = self.factory.get("/robots.txt")
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/plain", response["Content-Type"])
        body = response.content.decode("utf-8")
        self.assertIn("Sitemap:", body)
        self.assertIn("Mediapartners-Google", body)

    def test_ads_txt_returns_publisher_line(self):
        request = self.factory.get("/ads.txt")
        response = self.middleware(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/plain", response["Content-Type"])
        self.assertIn("google.com, pub-1180208702657280, DIRECT", response.content.decode("utf-8"))

    def test_sitemap_includes_gold_rate_urls(self):
        xml = sitemap_xml()
        self.assertIn("https://www.cridoraindia.com/gold-rates/kerala", xml)
        self.assertIn("https://www.cridoraindia.com/ml/gold-rates/kerala", xml)
        self.assertIn("https://www.cridoraindia.com/gold-rates/kochi", xml)
        self.assertIn("https://www.cridoraindia.com/gold-calculator", xml)
        self.assertIn("https://www.cridoraindia.com/ml/gold-calculator", xml)
        self.assertIn("https://www.cridoraindia.com/privacy", xml)
        self.assertIn("https://www.cridoraindia.com/contact", xml)
        self.assertNotIn("https://www.cridoraindia.com/gold-rates/mumbai", xml)

    def test_inject_route_seo_noindex_for_india_city_pages(self):
        html = '<html><head><meta name="robots" content="index, follow" /></head><body></body></html>'
        out = inject_route_seo(html, "/gold-rates/mumbai")
        self.assertIn('name="robots" content="noindex, follow"', out)


class AdSenseVerificationTests(SimpleTestCase):
    def test_inject_route_seo_places_adsense_meta_on_homepage(self):
        html = '<html><head></head><body><div id="root"></div></body></html>'
        out = inject_route_seo(html, "/")
        head_end = out.index("</head>")
        head = out[:head_end]
        self.assertIn('name="google-adsense-account"', head)
        self.assertIn("ca-pub-1180208702657280", head)
        self.assertNotIn("adsbygoogle.js", head)

    def test_inject_route_seo_places_adsense_script_on_gold_rates(self):
        html = '<html><head></head><body><div id="root"></div></body></html>'
        out = inject_route_seo(html, "/gold-rates/kerala")
        head_end = out.index("</head>")
        head = out[:head_end]
        self.assertIn('name="google-adsense-account"', head)
        self.assertIn("adsbygoogle.js", head)
        self.assertIn('crossorigin="anonymous"', head)
        self.assertLess(head.index("google-adsense-account"), head.index("application/ld+json"))

    def test_inject_route_seo_uses_og_preview_for_homepage(self):
        html = (
            '<html><head>'
            '<meta property="og:image" content="https://www.cridoraindia.com/icon-512.png" />'
            '<meta property="og:image:width" content="1200" />'
            '<meta property="og:image:height" content="630" />'
            "</head><body><div id=\"root\"></div></body></html>"
        )
        out = inject_route_seo(html, "/")
        self.assertIn('property="og:image" content="https://www.cridoraindia.com/og-preview.png"', out)
        self.assertIn('name="twitter:image" content="https://www.cridoraindia.com/og-preview.png"', out)
        self.assertIn('property="og:image:width" content="1200"', out)
        self.assertIn('property="og:image:height" content="630"', out)
        self.assertNotIn('J00" />', out)
        self.assertNotIn('s0" />', out)

    @override_settings(ADSENSE_PUBLISHER_ID="ca-pub-TESTENV999")
    def test_ads_txt_uses_settings_publisher_id(self):
        from config.seo import ads_txt

        self.assertIn("pub-TESTENV999", ads_txt())

    def test_inject_adsense_verification_deduplicates_tags(self):
        html = (
            "<html><head>"
            '<meta name="google-adsense-account" content="ca-pub-1180208702657280">'
            '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1180208702657280"></script>'
            "</head><body></body></html>"
        )
        out = inject_adsense_verification(html, "/gold-rates/kerala")
        self.assertEqual(out.count("google-adsense-account"), 1)
        self.assertEqual(out.count("adsbygoogle.js"), 1)


class GA4AnalyticsTests(SimpleTestCase):
    def test_inject_ga4_is_noop_when_id_blank(self):
        html = "<html><head></head><body></body></html>"
        self.assertEqual(inject_ga4(html, ""), html)

    def test_inject_ga4_adds_gtag_snippet(self):
        html = "<html><head></head><body></body></html>"
        out = inject_ga4(html, "G-TESTID123")
        self.assertIn("googletagmanager.com/gtag/js?id=G-TESTID123", out)
        self.assertIn("gtag('config', 'G-TESTID123', {'send_page_view': true});", out)
        self.assertIn('name="ga4-measurement-id"', out)

    def test_inject_ga4_deduplicates_on_repeated_calls(self):
        html = "<html><head></head><body></body></html>"
        out = inject_ga4(inject_ga4(html, "G-TESTID123"), "G-TESTID123")
        self.assertEqual(out.count("googletagmanager.com/gtag/js"), 1)

    @override_settings(GA4_MEASUREMENT_ID="G-ROUTEID456")
    def test_inject_route_seo_adds_ga4_when_configured(self):
        html = '<html><head></head><body><div id="root"></div></body></html>'
        out = inject_route_seo(html, "/")
        self.assertIn("googletagmanager.com/gtag/js?id=G-ROUTEID456", out)

    @override_settings(GA4_MEASUREMENT_ID="")
    def test_inject_route_seo_skips_ga4_when_unset(self):
        html = '<html><head></head><body><div id="root"></div></body></html>'
        out = inject_route_seo(html, "/")
        self.assertNotIn("googletagmanager.com", out)
