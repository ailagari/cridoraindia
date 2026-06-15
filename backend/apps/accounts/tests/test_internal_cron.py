import os
from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient


@override_settings(ROOT_URLCONF="config.urls")
class InternalCronProcessBroadcastsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = "/api/v1/internal/cron/process-festival-broadcasts/"

    def test_requires_cron_secret_env(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("CRON_SECRET", None)
            res = self.client.post(self.url)
        self.assertEqual(res.status_code, 503)

    def test_rejects_missing_header(self):
        with patch.dict(os.environ, {"CRON_SECRET": "test-secret"}, clear=False):
            res = self.client.post(self.url)
        self.assertEqual(res.status_code, 403)

    def test_runs_processor_with_valid_secret(self):
        with patch.dict(os.environ, {"CRON_SECRET": "test-secret"}, clear=False):
            with patch(
                "apps.accounts.views_internal_cron.maybe_process_scheduled_broadcasts",
                return_value=2,
            ) as run:
                res = self.client.post(self.url, HTTP_X_CRON_SECRET="test-secret")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["finalized"], 2)
        run.assert_called_once_with(force=True)
