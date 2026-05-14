"""Side effects for accounts models (admin alerts)."""

from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import AdminNotification, KYDocument
from .webpush_service import send_push_to_platform_admins, webpush_configured

User = get_user_model()


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
