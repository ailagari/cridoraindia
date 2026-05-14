"""Side effects for accounts models (admin alerts)."""

import logging

from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import AdminNotification, FractionalGoldPurchase, KYDocument
from .webpush_service import (
    send_push_to_platform_admins,
    send_push_to_user,
    webpush_configured,
)

User = get_user_model()
logger = logging.getLogger(__name__)


def _doc_label(doc_type: str) -> str:
    return dict(KYDocument.DOC_TYPE_CHOICES).get(
        doc_type, doc_type.replace("_", " ").title()
    )


@receiver(post_save, sender=KYDocument)
def admin_notify_on_pending_kyc_document(sender, instance, **kwargs):
    """Create admin feed row + optional Web Push when a document awaits review."""
    if instance.status != KYDocument.DOC_PENDING:
        return
    actor = instance.user
    if actor.user_type == User.CUSTOMER:
        kind = AdminNotification.KIND_KYC_UPLOAD
        title = "KYC document needs review"
        link = "/dashboard/admin?section=ap_kyc"
        tag = "cridora-admin-kyc"
    elif actor.user_type == User.JEWELLER:
        kind = AdminNotification.KIND_KYB_UPLOAD
        title = "KYB document needs review"
        link = "/dashboard/admin?section=ap_kyb"
        tag = "cridora-admin-kyb"
    else:
        return

    label = _doc_label(instance.doc_type)
    body = f"{actor.email} · {label}"

    notif = AdminNotification.objects.create(
        kind=kind,
        title=title,
        body=body,
        link_path=link,
        actor=actor,
    )

    if webpush_configured():
        send_push_to_platform_admins(
            {
                "title": title,
                "body": body,
                "url": link,
                "tag": tag,
            }
        )


def _fractional_customer_label(customer) -> str:
    name = f"{customer.first_name} {customer.last_name}".strip()
    return name or customer.email or f"Customer #{customer.pk}"


def _format_grams_trimmed(grams) -> str:
    text = format(grams, "f").rstrip("0").rstrip(".")
    return text or "0"


@receiver(post_save, sender=FractionalGoldPurchase)
def jeweller_push_on_counter_fractional_order(sender, instance, created, **kwargs):
    """Notify jeweller by Web Push when a customer places a pay-at-counter fractional order."""
    if not created:
        return
    if instance.payment_method != FractionalGoldPurchase.PAY_COUNTER:
        return
    if instance.status != FractionalGoldPurchase.AWAITING_COUNTER:
        return
    if not webpush_configured():
        return
    try:
        customer = instance.customer
        jeweller = instance.jeweller
        label = _fractional_customer_label(customer)
        grams_s = _format_grams_trimmed(instance.grams)
        total_s = f"{instance.total_inr:.2f}"
        title = "Confirm counter gold payment"
        body = f"{label} · {grams_s} g · ₹{total_s} — open Purchases to confirm."
        send_push_to_user(
            jeweller,
            {
                "title": title,
                "body": body,
                "url": "/dashboard/jeweller?section=txn_purchases",
                "tag": f"cridora-counter-frac-{instance.pk}",
            },
        )
    except Exception:
        logger.exception(
            "Jeweller Web Push failed for counter fractional order purchase_id=%s",
            getattr(instance, "pk", None),
        )
