from django.test import RequestFactory, SimpleTestCase

from config.middleware import SeoFilesMiddleware
from config.seo import sitemap_xml


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
        self.assertIn("Sitemap:", response.content.decode("utf-8"))

    def test_sitemap_includes_gold_rate_urls(self):
        xml = sitemap_xml()
        self.assertIn("https://www.cridoraindia.com/gold-rates/kerala", xml)
        self.assertIn("https://www.cridoraindia.com/ml/gold-rates/kerala", xml)
        self.assertIn("https://www.cridoraindia.com/gold-rates/kochi", xml)
