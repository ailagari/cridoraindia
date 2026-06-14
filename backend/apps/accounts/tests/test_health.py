"""Health endpoint and media root resolution tests."""
import os
from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from config.settings import _resolve_media_root


class HealthViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_health_returns_ok_and_media_block(self):
        res = self.client.get("/api/v1/health/")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["status"], "ok")
        self.assertIn("media", body)
        media = body["media"]
        self.assertIn("media_root", media)
        self.assertIn("persistent_volume_configured", media)
        self.assertIn("exists", media)
        self.assertIn("writable", media)
        self.assertIn("gold_rates_ad_images", media)
        self.assertIn("gold_rates_ad_videos", media)


class MediaRootResolutionTests(SimpleTestCase):
    def test_explicit_django_media_root(self):
        with patch.dict(
            os.environ,
            {"DJANGO_MEDIA_ROOT": "/data/media"},
            clear=False,
        ):
            os.environ.pop("RAILWAY_VOLUME_MOUNT_PATH", None)
            self.assertEqual(
                _resolve_media_root(),
                Path("/data/media").resolve(),
            )

    def test_railway_volume_mount_path_fallback(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DJANGO_MEDIA_ROOT", None)
            os.environ["RAILWAY_VOLUME_MOUNT_PATH"] = "/data"
            self.assertEqual(
                _resolve_media_root(),
                (Path("/data") / "media").resolve(),
            )

    def test_default_local_media_root(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("DJANGO_MEDIA_ROOT", None)
            os.environ.pop("RAILWAY_VOLUME_MOUNT_PATH", None)
            root = str(_resolve_media_root()).replace("\\", "/")
            self.assertTrue(root.endswith("/media"))
