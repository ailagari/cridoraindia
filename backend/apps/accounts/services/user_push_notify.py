"""User- and jeweller-scoped push (never broadcast except admin festival flows)."""

from __future__ import annotations

import logging
from decimal import Decimal

from django.contrib.auth import get_user_model
from apps.accounts.models import (
    CridoraPayBill,
    FractionalGoldPurchase,
    GoldDepositIntake,
    GoldSellbackRequest,
    PortfolioUserNotification,
)
from apps.accounts.services.inbox_notify import notify_inbox
from apps.accounts.services.push_deep_links import customer_dashboard, jeweller_dashboard
from apps.accounts.services.system_notification_render import resolve_system_notification

logger = logging.getLogger(__name__)
User = get_user_model()


def _copy(key: str, facts: dict[str, str], *, locale: str = "en") -> tuple[str, str]:
    resolved = resolve_system_notification(key, locale=locale, facts=facts)
    return resolved.title, resolved.body


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
    category: str = PortfolioUserNotification.CATEGORY_TRANSACTION,
    priority: str = PortfolioUserNotification.PRIORITY_MEDIUM,
    jeweller_id: int | None = None,
) -> PortfolioUserNotification:
    """In-app inbox row for any role + push."""
    return notify_inbox(
        user,
        kind=kind,
        title=title,
        body=body,
        link_path=link_path,
        category=category,
        priority=priority,
        send_push=True,
        image_url=image_url,
        jeweller_id=jeweller_id,
        tag=tag,
    )


def notify_user_push(
    user: User,
    *,
    title: str,
    body: str,
    url: str,
    tag: str,
    image_url: str | None = None,
    kind: str = PortfolioUserNotification.KIND_SYSTEM,
    category: str = PortfolioUserNotification.CATEGORY_TRANSACTION,
    priority: str = PortfolioUserNotification.PRIORITY_HIGH,
) -> PortfolioUserNotification:
    path = url if url.startswith("/") else f"/{url}" if url else "/"
    return notify_inbox(
        user,
        kind=kind,
        title=title,
        body=body,
        link_path=path,
        category=category,
        priority=priority,
        send_push=True,
        image_url=image_url,
        tag=tag,
    )


# --- OTP workflow (never include OTP digits in push body) ---


def notify_fractional_counter_otp_issued(purchase: FractionalGoldPurchase) -> None:
    customer = purchase.customer
    jeweller = purchase.jeweller
    grams_s = _format_grams(purchase.grams)
    j_title, j_body = _copy(
        "fractional_otp_jeweller",
        {"customer_name": _display_name(customer), "grams": grams_s},
    )
    notify_user_push(
        jeweller,
        title=j_title,
        body=j_body,
        url=jeweller_dashboard("txn_purchases"),
        tag=f"otp-frac-j-{purchase.pk}",
        kind=PortfolioUserNotification.KIND_OTP,
        category=PortfolioUserNotification.CATEGORY_SECURITY,
    )
    c_title, c_body = _copy(
        "fractional_otp_customer",
        {
            "jeweller_name": jeweller.business_name or "the jeweller",
            "grams": grams_s,
        },
    )
    notify_user_activity(
        customer,
        title=c_title,
        body=c_body,
        link_path=customer_dashboard("invest_fractional"),
        tag=f"otp-frac-c-{purchase.pk}",
        kind=PortfolioUserNotification.KIND_OTP,
        category=PortfolioUserNotification.CATEGORY_SECURITY,
    )


def notify_gold_deposit_intake_created(intake: GoldDepositIntake) -> None:
    grams_s = _format_grams(intake.grams)
    title, body = _copy(
        "deposit_intake_customer",
        {
            "jeweller_name": intake.jeweller.business_name or "Your jeweller",
            "grams": grams_s,
        },
    )
    notify_user_activity(
        intake.customer,
        title=title,
        body=body,
        link_path=customer_dashboard("invest_deposit"),
        tag=f"otp-dep-intake-c-{intake.pk}",
        kind=PortfolioUserNotification.KIND_DEPOSIT,
    )


def notify_gold_deposit_counter_otp_issued(intake: GoldDepositIntake) -> None:
    grams_s = _format_grams(intake.grams)
    j_title, j_body = _copy(
        "deposit_otp_jeweller",
        {"customer_name": _display_name(intake.customer), "grams": grams_s},
    )
    notify_user_push(
        intake.jeweller,
        title=j_title,
        body=j_body,
        url=jeweller_dashboard("txn_deposits"),
        tag=f"otp-dep-j-{intake.pk}",
        kind=PortfolioUserNotification.KIND_OTP,
        category=PortfolioUserNotification.CATEGORY_SECURITY,
    )
    c_title, c_body = _copy("deposit_otp_customer", {})
    notify_user_activity(
        intake.customer,
        title=c_title,
        body=c_body,
        link_path=customer_dashboard("invest_deposit"),
        tag=f"otp-dep-c-ready-{intake.pk}",
        kind=PortfolioUserNotification.KIND_OTP,
        category=PortfolioUserNotification.CATEGORY_SECURITY,
    )


def notify_sellback_pending_jeweller(row: GoldSellbackRequest) -> None:
    grams_s = _format_grams(row.grams)
    title, body = _copy(
        "sellback_pending_jeweller",
        {"customer_name": _display_name(row.customer), "grams": grams_s},
    )
    notify_user_push(
        row.jeweller,
        title=title,
        body=body,
        url=jeweller_dashboard("txn_ops"),
        tag=f"sellback-pending-j-{row.pk}",
        kind=PortfolioUserNotification.KIND_SELLBACK,
    )


def notify_sellback_awaiting_otp_customer(row: GoldSellbackRequest) -> None:
    title, body = _copy("sellback_otp_customer", {})
    notify_user_activity(
        row.customer,
        title=title,
        body=body,
        link_path=customer_dashboard("redeem_cash"),
        tag=f"sellback-otp-c-{row.pk}",
        kind=PortfolioUserNotification.KIND_OTP,
        category=PortfolioUserNotification.CATEGORY_SECURITY,
    )


def notify_loan_pending_jeweller(row) -> None:
    from apps.accounts.models import GoldLoanRequest

    if not isinstance(row, GoldLoanRequest):
        return
    grams_s = _format_grams(row.grams)
    title, body = _copy(
        "loan_pending_jeweller",
        {"customer_name": _display_name(row.customer), "grams": grams_s},
    )
    notify_user_push(
        row.jeweller,
        title=title,
        body=body,
        url=jeweller_dashboard("txn_ops"),
        tag=f"loan-pending-j-{row.pk}",
        kind=PortfolioUserNotification.KIND_LOAN,
        category=PortfolioUserNotification.CATEGORY_LOAN,
    )


def notify_loan_awaiting_otp_customer(row) -> None:
    from apps.accounts.models import GoldLoanRequest

    if not isinstance(row, GoldLoanRequest):
        return
    title, body = _copy("loan_otp_customer", {})
    notify_user_activity(
        row.customer,
        title=title,
        body=body,
        link_path=customer_dashboard("redeem_loan"),
        tag=f"loan-otp-c-{row.pk}",
        kind=PortfolioUserNotification.KIND_OTP,
        category=PortfolioUserNotification.CATEGORY_SECURITY,
    )


def notify_loan_repayment_pending_jeweller(req) -> None:
    from apps.accounts.models import GoldLoanRepaymentRequest

    if not isinstance(req, GoldLoanRepaymentRequest):
        return
    loan = req.loan
    title, body = _copy(
        "loan_repay_pending_jeweller",
        {
            "customer_name": _display_name(loan.customer),
            "amount_inr": str(req.amount_inr),
            "loan_id": str(loan.pk),
        },
    )
    notify_user_push(
        loan.jeweller,
        title=title,
        body=body,
        url=jeweller_dashboard("txn_ops"),
        tag=f"loan-repay-pending-j-{req.pk}",
        kind=PortfolioUserNotification.KIND_LOAN,
        category=PortfolioUserNotification.CATEGORY_LOAN,
    )


def notify_loan_repayment_awaiting_otp_customer(req) -> None:
    from apps.accounts.models import GoldLoanRepaymentRequest

    if not isinstance(req, GoldLoanRepaymentRequest):
        return
    title, body = _copy("loan_repay_otp_customer", {})
    notify_user_activity(
        req.loan.customer,
        title=title,
        body=body,
        link_path=customer_dashboard("redeem_loan"),
        tag=f"loan-repay-otp-c-{req.pk}",
        kind=PortfolioUserNotification.KIND_OTP,
        category=PortfolioUserNotification.CATEGORY_SECURITY,
    )


def notify_cross_redemption_pending_source(req) -> None:
    from apps.accounts.models import CrossRedemptionRequest

    if not isinstance(req, CrossRedemptionRequest):
        return
    grams_s = _format_grams(req.grams)
    src_title, src_body = _copy(
        "cross_redemption_source_jeweller",
        {
            "grams": grams_s,
            "destination_jeweller": req.destination_jeweller.business_name or "destination",
        },
    )
    notify_user_push(
        req.source_jeweller,
        title=src_title,
        body=src_body,
        url=jeweller_dashboard("txn_ops"),
        tag=f"cr-src-j-{req.pk}",
        kind=PortfolioUserNotification.KIND_CROSS_REDEMPTION,
    )
    dst_title, dst_body = _copy("cross_redemption_dest_jeweller", {"grams": grams_s})
    notify_user_push(
        req.destination_jeweller,
        title=dst_title,
        body=dst_body,
        url=jeweller_dashboard("txn_ops"),
        tag=f"cr-dst-j-{req.pk}",
        kind=PortfolioUserNotification.KIND_CROSS_REDEMPTION,
    )
    c_title, c_body = _copy(
        "cross_redemption_customer",
        {"reference": str(req.public_reference or req.pk)},
    )
    notify_user_activity(
        req.user,
        title=c_title,
        body=c_body,
        link_path=customer_dashboard("redeem_emergency"),
        tag=f"cr-c-{req.pk}",
        kind=PortfolioUserNotification.KIND_CROSS_REDEMPTION,
    )


def notify_fractional_purchase_completed(purchase: FractionalGoldPurchase) -> None:
    grams_s = _format_grams(purchase.grams)
    title, body = _copy(
        "fractional_completed_customer",
        {
            "grams": grams_s,
            "jeweller_name": purchase.jeweller.business_name or "your jeweller",
        },
    )
    notify_inbox(
        purchase.customer,
        kind=PortfolioUserNotification.KIND_HOLDING_ADDED,
        title=title,
        body=body,
        link_path=customer_dashboard("portfolio_holdings"),
        category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
        jeweller_id=purchase.jeweller_id,
        tag=f"frac-done-c-{purchase.pk}",
    )


def notify_gold_deposit_completed(intake: GoldDepositIntake) -> None:
    grams_s = _format_grams(intake.grams)
    title, body = _copy("deposit_completed_customer", {"grams": grams_s})
    notify_inbox(
        intake.customer,
        kind=PortfolioUserNotification.KIND_HOLDING_ADDED,
        title=title,
        body=body,
        link_path=customer_dashboard("portfolio_holdings"),
        category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
        tag=f"dep-done-c-{intake.pk}",
    )


def notify_corridorapay_bill_created(bill: CridoraPayBill) -> None:
    total = format(bill.total_inr, "f").rstrip("0").rstrip(".")
    title, body = _copy(
        "corridorapay_bill_created",
        {
            "jeweller_name": bill.jeweller.business_name or "A jeweller",
            "total_inr": total,
        },
    )
    notify_user_activity(
        bill.customer,
        title=title,
        body=body,
        link_path=customer_dashboard("invest_cridorapay"),
        tag=f"cp-bill-c-{bill.pk}",
        kind=PortfolioUserNotification.KIND_CORRIDORAPAY,
        jeweller_id=bill.jeweller_id,
    )


def notify_corridorapay_customer_reminder(bill: CridoraPayBill) -> None:
    title, body = _copy(
        "corridorapay_bill_reminder",
        {
            "reference": bill.reference,
            "jeweller_name": bill.jeweller.business_name or "a jeweller",
        },
    )
    notify_user_activity(
        bill.customer,
        title=title,
        body=body,
        link_path=customer_dashboard("invest_cridorapay"),
        tag=f"cp-remind-c-{bill.pk}",
        kind=PortfolioUserNotification.KIND_CORRIDORAPAY,
        category=PortfolioUserNotification.CATEGORY_PROMO,
        priority=PortfolioUserNotification.PRIORITY_LOW,
        jeweller_id=bill.jeweller_id,
    )


def notify_corridorapay_upi_selected(bill: CridoraPayBill) -> None:
    title, body = _copy(
        "corridorapay_upi_jeweller",
        {
            "customer_name": _display_name(bill.customer),
            "reference": bill.reference,
            "total_inr": str(bill.total_inr),
        },
    )
    notify_user_push(
        bill.jeweller,
        title=title,
        body=body,
        url=jeweller_dashboard("txn_cridorapay"),
        tag=f"cp-upi-j-{bill.pk}",
        kind=PortfolioUserNotification.KIND_CORRIDORAPAY,
    )


def notify_corridorapay_vault_selected(bill: CridoraPayBill) -> None:
    title, body = _copy(
        "corridorapay_vault_jeweller",
        {"customer_name": _display_name(bill.customer), "reference": bill.reference},
    )
    notify_user_push(
        bill.jeweller,
        title=title,
        body=body,
        url=jeweller_dashboard("txn_cridorapay"),
        tag=f"cp-vault-j-{bill.pk}",
        kind=PortfolioUserNotification.KIND_CORRIDORAPAY,
    )


def notify_corridorapay_otp_issued(bill: CridoraPayBill) -> None:
    title, body = _copy(
        "corridorapay_otp_jeweller",
        {"customer_name": _display_name(bill.customer), "reference": bill.reference},
    )
    notify_user_push(
        bill.jeweller,
        title=title,
        body=body,
        url=jeweller_dashboard("txn_cridorapay"),
        tag=f"cp-otp-j-{bill.pk}",
        kind=PortfolioUserNotification.KIND_OTP,
        category=PortfolioUserNotification.CATEGORY_SECURITY,
    )


def notify_corridorapay_cash_pending(bill: CridoraPayBill) -> None:
    cash = format(bill.cash_payable_inr, "f").rstrip("0").rstrip(".")
    c_title, c_body = _copy(
        "corridorapay_cash_customer",
        {"reference": bill.reference, "cash_inr": cash},
    )
    notify_user_activity(
        bill.customer,
        title=c_title,
        body=c_body,
        link_path=customer_dashboard("invest_cridorapay"),
        tag=f"cp-cash-c-{bill.pk}",
        kind=PortfolioUserNotification.KIND_CORRIDORAPAY,
    )
    j_title, j_body = _copy(
        "corridorapay_cash_jeweller",
        {
            "reference": bill.reference,
            "cash_inr": cash,
            "customer_name": _display_name(bill.customer),
        },
    )
    notify_user_push(
        bill.jeweller,
        title=j_title,
        body=j_body,
        url=jeweller_dashboard("txn_cridorapay"),
        tag=f"cp-cash-j-{bill.pk}",
        kind=PortfolioUserNotification.KIND_CORRIDORAPAY,
    )


def notify_corridorapay_completed(bill: CridoraPayBill) -> None:
    grams_s = _format_grams(bill.weight_grams)
    title, body = _copy(
        "corridorapay_completed_customer",
        {"title": bill.title, "grams": grams_s},
    )
    notify_user_activity(
        bill.customer,
        title=title,
        body=body,
        link_path=customer_dashboard("portfolio_overview", portfolio_tab="personal"),
        tag=f"cp-done-c-{bill.pk}",
        kind=PortfolioUserNotification.KIND_JEWELLER_ADDED_HOLDING,
        category=PortfolioUserNotification.CATEGORY_PORTFOLIO,
        jeweller_id=bill.jeweller_id,
    )
