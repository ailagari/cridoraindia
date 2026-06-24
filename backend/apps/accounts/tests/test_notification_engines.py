"""Tests for gold/portfolio/holding notification copy and engines."""

from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import (
    NotificationPreference,
    PersonalGoldHolding,
    PersonalHoldingNotificationState,
    UserPortfolioNotificationState,
)
from apps.accounts.push_payload import build_push_payload, truncate_push_copy
from apps.accounts.services.notification_copy import (
    format_gold_rate_standard,
    format_holding_gain,
    format_portfolio_gain,
)
from apps.accounts.services.personal_holding_gain_notify import notify_personal_holdings_after_rate_change
from apps.accounts.services.portfolio_gain_notify import run_portfolio_gain_notifications
from apps.marketplace.jeweller_gold_rate_notify import (
    deliver_jeweller_rate_notifications,
    maybe_notify_jeweller_gold_rate_change,
)
from apps.marketplace.models import JewellerPricingProfile, get_or_create_ticker, jeweller_profile_for

User = get_user_model()


class NotificationCopyTests(TestCase):
    def test_format_gold_rate_standard_increase(self):
        body = format_gold_rate_standard(previous_rate=Decimal("6000"), new_rate=Decimal("6100"))
        self.assertIn("₹6,000.00/g", body)
        self.assertIn("₹6,100.00/g", body)
        self.assertIn("increased", body)

    def test_format_holding_gain_truncates_for_push(self):
        long_title = "Necklace " * 20
        body = format_holding_gain(
            title=long_title,
            gain_inr=Decimal("1200"),
            new_value_inr=Decimal("132000"),
        )
        _, truncated = truncate_push_copy("Title", body)
        self.assertLessEqual(len(truncated), 120)

    def test_format_portfolio_gain(self):
        body = format_portfolio_gain(Decimal("2500"))
        self.assertIn("₹2,500", body)


class PortfolioGainDedupTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "port@notify.test",
            "pass",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        )
        NotificationPreference.objects.create(
            user=self.user,
            allow_portfolio_alerts=True,
            allow_push_notifications=False,
        )
        ticker = get_or_create_ticker()
        ticker.portfolio_gain_threshold_inr = Decimal("500")
        ticker.save(update_fields=["portfolio_gain_threshold_inr"])

    @patch("apps.accounts.services.portfolio_gain_notify.deliver_engagement")
    @patch(
        "apps.accounts.services.portfolio_gain_notify.customer_portfolio_totals_payload",
        return_value={
            "personal_gain_on_recorded_cost_inr": "1000",
            "personal_gain_on_recorded_cost_percent": "5",
        },
    )
    def test_does_not_fire_twice_without_new_gain(self, _totals, mock_notify):
        run_portfolio_gain_notifications()
        self.assertEqual(mock_notify.call_count, 1)
        run_portfolio_gain_notifications()
        self.assertEqual(mock_notify.call_count, 1)

    @patch("apps.accounts.services.portfolio_gain_notify.deliver_engagement")
    @patch(
        "apps.accounts.services.portfolio_gain_notify.customer_portfolio_totals_payload",
        return_value={
            "personal_gain_on_recorded_cost_inr": "2000",
            "personal_gain_on_recorded_cost_percent": "8",
        },
    )
    def test_fires_again_when_incremental_gain_exceeds_threshold(self, _totals, mock_notify):
        UserPortfolioNotificationState.objects.create(
            user=self.user,
            last_notified_gain_inr=Decimal("1000"),
            last_notified_at=timezone.now(),
        )
        run_portfolio_gain_notifications()
        self.assertEqual(mock_notify.call_count, 1)


class HoldingGainOnlyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "hold@notify.test",
            "pass",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        )
        NotificationPreference.objects.create(user=self.user, allow_gold_alerts=True)
        ticker = get_or_create_ticker()
        ticker.holding_gain_threshold_inr = Decimal("100")
        ticker.save(update_fields=["holding_gain_threshold_inr"])
        self.holding = PersonalGoldHolding.objects.create(
            user=self.user,
            title="Necklace",
            category=PersonalGoldHolding.CATEGORY_ORNAMENT,
            weight_grams=Decimal("10"),
            created_by_type=PersonalGoldHolding.CREATED_BY_USER,
            estimated_current_value_inr=Decimal("100000"),
        )
        PersonalHoldingNotificationState.objects.create(
            holding=self.holding,
            last_notified_value_inr=Decimal("100000"),
        )

    @patch("apps.accounts.services.personal_holding_gain_notify.deliver_engagement")
    @patch(
        "apps.accounts.services.personal_holding_gain_notify._rate_for_holding",
        return_value=Decimal("9000"),
    )
    def test_notifies_on_decrease(self, _rate, mock_notify):
        notify_personal_holdings_after_rate_change(jeweller_id=None)
        mock_notify.assert_called_once()
        self.assertEqual(mock_notify.call_args.kwargs.get("moment"), "holding_value_down")

    @patch("apps.accounts.services.personal_holding_gain_notify.deliver_engagement")
    @patch(
        "apps.accounts.services.personal_holding_gain_notify._rate_for_holding",
        return_value=Decimal("11000"),
    )
    def test_notifies_on_gain(self, _rate, mock_notify):
        notify_personal_holdings_after_rate_change(jeweller_id=None)
        mock_notify.assert_called_once()


class JewellerGoldNotifyLogoTests(TestCase):
    def setUp(self):
        self.jeweller = User.objects.create_user(
            "jew@notify.test",
            "pass",
            user_type=User.JEWELLER,
            business_name="Test Jewels",
        )
        self.customer = User.objects.create_user(
            "cust2@notify.test",
            "pass",
            user_type=User.CUSTOMER,
            default_jeweller=self.jeweller,
        )
        self.profile = jeweller_profile_for(self.jeweller)
        self.profile.gold_rate_source = JewellerPricingProfile.GOLD_RATE_MANUAL
        self.profile.gold_22k_inr_per_gram = Decimal("7000")
        self.profile.save()

    @patch(
        "apps.accounts.services.personal_holding_gain_notify.notify_personal_holdings_after_rate_change",
        return_value=0,
    )
    @patch("apps.marketplace.jeweller_gold_rate_notify.deliver_engagement")
    @patch("apps.accounts.services.campaign_audience.resolve_campaign_user_ids")
    @patch("apps.marketplace.jeweller_gold_rate_notify.resolve_jeweller_push_branding")
    def test_notify_inbox_receives_logo(self, mock_brand, mock_ids, mock_notify, _hold):
        mock_brand.return_value = {
            "branding_label": "Test Jewels via Cridora",
            "logo_url": "https://cdn.example/logo.png",
            "title_prefix": "Test Jewels",
        }
        mock_ids.return_value = [self.customer.pk]
        deliver_jeweller_rate_notifications(
            jeweller_id=self.profile.jeweller_id,
            previous_rate=Decimal("6900"),
            new_rate=Decimal("7000"),
        )
        mock_notify.assert_called()
        kwargs = mock_notify.call_args[1]
        self.assertEqual(kwargs.get("logo_url"), "https://cdn.example/logo.png")
        self.assertEqual(kwargs.get("image_url"), "https://cdn.example/logo.png")

    @patch("apps.accounts.webpush_service.push_delivery_configured", return_value=True)
    @patch("apps.accounts.services.inbox_notify.send_push_to_user")
    def test_build_push_payload_includes_image(self, _send, _configured):
        payload = build_push_payload(
            title="Test",
            body="Body",
            url="/marketplace",
            tag="test-logo",
            image_url="https://cdn.example/logo.png",
        )
        self.assertEqual(payload.get("image"), "https://cdn.example/logo.png")
