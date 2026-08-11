from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.accounts.models import NotificationPreference, PushOutbox
from apps.accounts.services.notification_preferences import should_send_push
from apps.accounts.services.notification_push_queue import (
    enqueue_broadcast_localized,
    enqueue_user_push,
    flush_push_queue,
)

User = get_user_model()


class PushOutboxTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "outbox@notify.test",
            "pass",
            user_type=User.CUSTOMER,
        )

    @patch("apps.accounts.webpush_service.send_push_to_user", return_value=1)
    def test_flush_sends_user_outbox(self, mock_send):
        enqueue_user_push(
            self.user.pk,
            {"title": "Hi", "body": "There", "url": "/", "tag": "t1", "id": "1"},
            tag="t1",
        )
        self.assertEqual(PushOutbox.objects.filter(status=PushOutbox.STATUS_PENDING).count(), 1)
        n = flush_push_queue()
        self.assertEqual(n, 1)
        mock_send.assert_called_once()
        row = PushOutbox.objects.get()
        self.assertEqual(row.status, PushOutbox.STATUS_SENT)

    @patch("apps.accounts.webpush_service.send_push_broadcast_localized", return_value=2)
    def test_flush_sends_broadcast_outbox(self, mock_broadcast):
        enqueue_broadcast_localized(
            {"en": {"title": "Gold", "body": "Up", "url": "/marketplace", "tag": "cridora-gold-rate"}},
            tag="cridora-gold-rate",
        )
        n = flush_push_queue()
        self.assertEqual(n, 1)
        mock_broadcast.assert_called_once()

    @patch("apps.accounts.webpush_service.send_push_to_user", side_effect=RuntimeError("boom"))
    def test_failed_send_retries_then_pending(self, _mock_send):
        enqueue_user_push(self.user.pk, {"title": "X", "body": "Y", "url": "/", "tag": "t"}, tag="t")
        flush_push_queue()
        row = PushOutbox.objects.get()
        self.assertEqual(row.status, PushOutbox.STATUS_PENDING)
        self.assertEqual(row.attempts, 1)
        self.assertIn("boom", row.last_error)


class GoldPreferenceGateTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "prefs@notify.test",
            "pass",
            user_type=User.CUSTOMER,
        )

    def test_gold_rate_up_respects_gold_flag_not_portfolio(self):
        NotificationPreference.objects.create(
            user=self.user,
            allow_gold_alerts=True,
            allow_portfolio_alerts=False,
            allow_push_notifications=True,
        )
        self.assertTrue(
            should_send_push(
                self.user,
                category="portfolio",
                notification_type="gold_rate_up",
            )
        )
        pref = NotificationPreference.objects.get(user=self.user)
        pref.allow_gold_alerts = False
        pref.save(update_fields=["allow_gold_alerts"])
        self.assertFalse(
            should_send_push(
                self.user,
                category="portfolio",
                notification_type="gold_rate_up",
            )
        )
