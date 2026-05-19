import tempfile
from pathlib import Path

from django.test import SimpleTestCase, override_settings

from config.views import _spa_index_html


class SpaIndexHtmlTests(SimpleTestCase):
    def test_injects_document_base_for_relative_asset_urls(self):
        with tempfile.TemporaryDirectory() as tmp:
            dist = Path(tmp)
            (dist / "index.html").write_text(
                "<html><head></head><body>"
                '<script type="module" src="./assets/index.js"></script>'
                "</body></html>",
                encoding="utf-8",
            )
            with override_settings(FRONTEND_DIST=str(dist)):
                html = _spa_index_html()
            self.assertIn('<base href="/" />', html)
            self.assertIn('src="./assets/index.js"', html)
