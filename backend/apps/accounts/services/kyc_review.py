"""KYC/KYB admin review-queue helpers."""

from django.contrib.auth import get_user_model

User = get_user_model()


def customer_in_review_queue(user: User) -> bool:
    """Any customer not yet verified appears in the admin review queue."""
    return (
        user.user_type == User.CUSTOMER and user.kyc_status != User.KYC_VERIFIED
    )


def jeweller_in_review_queue(user: User) -> bool:
    """Any jeweller not yet KYB-verified appears in the admin review queue."""
    return (
        user.user_type == User.JEWELLER and user.kyc_status != User.KYC_VERIFIED
    )
