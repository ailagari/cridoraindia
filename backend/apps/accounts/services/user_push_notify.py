"""User- and jeweller-scoped push (never broadcast except admin festival flows)."""

from __future__ import annotations

import logging
from decimal import Decimal

from django.contrib.auth import get_user_model
from apps.accounts.models import (
    FractionalGoldPurchase,
    GoldDepositIntake,
    GoldSellbackRequest,
    PortfolioUserNotification,
)
from apps.accounts.push_payload import build_push_payload
from apps.accounts.services.portfolio_user_notify import create_portfolio_notification
from apps.accounts.services.push_deep_links import customer_dashboard, jeweller_dashboard
from apps.accounts.webpush_service import push_delivery_configured, send_push_to_user

logger = logging.getLogger(__name__)
User = get_user_model()


def _display_name(user: User) -> str:
    name = f"{user.first_name} {user.last_name}".strip()
    return name or user.email or f"User #{user.pk}"


def _format_grams(grams: Decimal) -> str:
    text = format(grams, "f").rstrip("0").rstrip(".")
    return text or "0"


def notify_user_activity(
    user: User,
    *,
    title: str,
    body: str,
    link_path: str,
    tag: str,
    kind: str = PortfolioUserNotification.KIND_VERIFICATION_UPDATED,
    image_url: str | None = None,
) -> int:
    """In-app portfolio feed row (customers) + push to this user's devices only."""
    if user.user_type == User.CUSTOMER:
        create_portfolio_notification(
            user=user,
            kind=kind,
            title=title,
            body=body,
            link_path=link_path,
            send_push=False,
        )
    return notify_user_push(
        user,
        title=title,
        body=body,
        url=link_path,
        tag=tag,
        image_url=image_url,
    )


def notify_user_push(
    user: User,
    *,
    title: str,
    body: str,
    url: str,
    tag: str,
    image_url: str | None = None,
) -> int:
    if not push_delivery_configured():
        return 0
    path = url if url.startswith("/") else f"/{url}" if url else "/"
    try:
        return send_push_to_user(
            user,
            build_push_payload(title=title, body=body, url=path, tag=tag, image_url=image_url),
        )
    except Exception:
        logger.exception("notify_user_push failed user_id=%s tag=%s", user.pk, tag)
        return 0


# --- OTP workflow (never include OTP digits in push body) ---


def notify_fractional_counter_otp_issued(purchase: FractionalGoldPurchase) -> None:
    customer = purchase.customer
    jeweller = purchase.jeweller
    grams_s = _format_grams(purchase.grams)
    notify_user_push(
        jeweller,
        title="Counter OTP ready",
        body=f"{_display_name(customer)} generated a verification code for {grams_s} g — open Purchases to enter it.",
        url=jeweller_dashboard("txn_purchases"),
        tag=f"otp-frac-j-{purchase.pk}",
    )
    notify_user_activity(
        customer,
        title="OTP generated",
        body=f"Show your code to {jeweller.business_name or 'the jeweller'} after paying {grams_s} g at the counter.",
        link_path=customer_dashboard("invest_fractional"),
        tag=f"otp-frac-c-{purchase.pk}",
    )


def notify_gold_deposit_intake_created(intake: GoldDepositIntake) -> None:
    grams_s = _format_grams(intake.grams)
    notify_user_activity(
        intake.customer,
        title="Deposit recorded — OTP needed",
        body=f"{intake.jeweller.business_name or 'Your jeweller'} logged {grams_s} g. Generate your OTP in the app to complete the deposit.",
        link_path=customer_dashboard("invest_deposit"),
        tag=f"otp-dep-intake-c-{intake.pk}",
    )


def notify_gold_deposit_counter_otp_issued(intake: GoldDepositIntake) -> None:
    grams_s = _format_grams(intake.grams)
    notify_user_push(
        intake.jeweller,
        title="Deposit OTP ready",
        body=f"{_display_name(intake.customer)} shared a verification code for {grams_s} g deposit — open Deposits to verify.",
        url=jeweller_dashboard("txn_deposits"),
        tag=f"otp-dep-j-{intake.pk}",
    )
    notify_user_activity(
        intake.customer,
        title="Deposit OTP generated",
        body="Show your code to the jeweller. Open Deposits if you need to view it again.",
        link_path=customer_dashboard("invest_deposit"),
        tag=f"otp-dep-c-ready-{intake.pk}",
    )


def notify_sellback_pending_jeweller(row: GoldSellbackRequest) -> None:
    grams_s = _format_grams(row.grams)
    notify_user_push(
        row.jeweller,
        title="Sellback request",
        body=f"{_display_name(row.customer)} requested cash sellback for {grams_s} g — review in Redemption.",
        url=jeweller_dashboard("txn_ops"),
        tag=f"sellback-pending-j-{row.pk}",
    )


def notify_sellback_awaiting_otp_customer(row: GoldSellbackRequest) -> None:
    notify_user_activity(
        row.customer,
        title="Share sellback OTP",
        body="Jeweller accepted your sellback. Open Cash sell and share your OTP after you receive payment.",
        link_path=customer_dashboard("redeem_cash"),
        tag=f"sellback-otp-c-{row.pk}",
    )


def notify_loan_pending_jeweller(row) -> None:
    from apps.accounts.models import GoldLoanRequest

    if not isinstance(row, GoldLoanRequest):
        return
    grams_s = _format_grams(row.grams)
    notify_user_push(
        row.jeweller,
        title="Gold loan request",
        body=f"{_display_name(row.customer)} requested a loan on {grams_s} g collateral — review in Redemption.",
        url=jeweller_dashboard("txn_ops"),
        tag=f"loan-pending-j-{row.pk}",
    )


def notify_loan_awaiting_otp_customer(row) -> None:
    from apps.accounts.models import GoldLoanRequest

    if not isinstance(row, GoldLoanRequest):
        return
    notify_user_activity(
        row.customer,
        title="Share loan OTP",
        body="Jeweller accepted your loan. Open Loan and share your OTP after you receive cash.",
        link_path=customer_dashboard("redeem_loan"),
        tag=f"loan-otp-c-{row.pk}",
    )


def notify_loan_repayment_pending_jeweller(req) -> None:
    from apps.accounts.models import GoldLoanRepaymentRequest

    if not isinstance(req, GoldLoanRepaymentRequest):
        return
    loan = req.loan
    notify_user_push(
        loan.jeweller,
        title="Loan repayment",
        body=(
            f"{_display_name(loan.customer)} wants to repay ₹{req.amount_inr} "
            f"on LN-{loan.pk} — review in Redemption."
        ),
        url=jeweller_dashboard("txn_ops"),
        tag=f"loan-repay-pending-j-{req.pk}",
    )


def notify_loan_repayment_awaiting_otp_customer(req) -> None:
    from apps.accounts.models import GoldLoanRepaymentRequest

    if not isinstance(req, GoldLoanRepaymentRequest):
        return
    notify_user_activity(
        req.loan.customer,
        title="Share repayment OTP",
        body="Jeweller accepted your repayment. Pay cash at the counter, then share your OTP.",
        link_path=customer_dashboard("redeem_loan"),
        tag=f"loan-repay-otp-c-{req.pk}",
    )


def notify_cross_redemption_pending_source(req) -> None:
    from apps.accounts.models import CrossRedemptionRequest

    if not isinstance(req, CrossRedemptionRequest):
        return
    grams_s = _format_grams(req.grams)
    notify_user_push(
        req.source_jeweller,
        title="Cross-redemption approval",
        body=f"Customer needs {grams_s} g moved to {req.destination_jeweller.business_name or 'destination'} — open Redemption inbox.",
        url=jeweller_dashboard("txn_ops"),
        tag=f"cr-src-j-{req.pk}",
    )
    notify_user_push(
        req.destination_jeweller,
        title="Incoming cross-redemption",
        body=f"{grams_s} g cross-shop request pending source approval — track in Redemption inbox.",
        url=jeweller_dashboard("txn_ops"),
        tag=f"cr-dst-j-{req.pk}",
    )
    notify_user_activity(
        req.user,
        title="Cross-redemption submitted",
        body=f"Request {req.public_reference or req.pk} is awaiting source jeweller approval.",
        link_path=customer_dashboard("redeem_emergency"),
        tag=f"cr-c-{req.pk}",
    )


def notify_fractional_purchase_completed(purchase: FractionalGoldPurchase) -> None:
    grams_s = _format_grams(purchase.grams)
    create_portfolio_notification(
        user=purchase.customer,
        kind=PortfolioUserNotification.KIND_HOLDING_ADDED,
        title="Fractional gold credited",
        body=f"{grams_s} g added to your vault at {purchase.jeweller.business_name or 'your jeweller'}.",
        link_path=customer_dashboard("portfolio_holdings"),
    )


def notify_gold_deposit_completed(intake: GoldDepositIntake) -> None:
    grams_s = _format_grams(intake.grams)
    create_portfolio_notification(
        user=intake.customer,
        kind=PortfolioUserNotification.KIND_HOLDING_ADDED,
        title="Gold deposit credited",
        body=f"{grams_s} g deposit vault credit is complete.",
        link_path=customer_dashboard("portfolio_holdings"),
    )
