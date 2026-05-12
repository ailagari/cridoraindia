"""KYC/KYB readiness and admin review-queue helpers."""

from django.contrib.auth import get_user_model

from apps.accounts.models import BankAccount, KYDocument

User = get_user_model()

JEWELLER_ESSENTIAL = [
    KYDocument.GST_CERTIFICATE,
    KYDocument.PAN_BUSINESS,
    KYDocument.SHOP_ESTABLISHMENT,
    KYDocument.TRADE_LICENSE,
    KYDocument.ADDRESS_PROOF_SHOP,
    KYDocument.PROPRIETOR_AADHAAR,
]


def customer_ready_for_kyc_approval(user: User) -> tuple[bool, str]:
    if user.user_type != User.CUSTOMER:
        return False, "Not a customer account."
    uploads = set(user.kyc_documents.values_list("doc_type", flat=True))
    for dt in KYDocument.CUSTOMER_DOC_TYPES:
        if dt not in uploads:
            return False, f"Missing document type: {dt}."
    try:
        user.bank_account
    except BankAccount.DoesNotExist:
        return False, "Bank details not submitted."
    return True, ""


def jeweller_ready_for_kyb_approval(user: User) -> tuple[bool, str]:
    if user.user_type != User.JEWELLER:
        return False, "Not a jeweller account."
    uploads = set(user.kyc_documents.values_list("doc_type", flat=True))
    for dt in JEWELLER_ESSENTIAL:
        if dt not in uploads:
            return False, f"Missing KYB document: {dt}."
    return True, ""


def customer_in_review_queue(user: User) -> bool:
    if user.user_type != User.CUSTOMER or user.kyc_status == User.KYC_VERIFIED:
        return False
    if BankAccount.objects.filter(user=user).exists():
        return True
    return user.kyc_documents.exists()


def jeweller_in_review_queue(user: User) -> bool:
    if user.user_type != User.JEWELLER or user.kyc_status == User.KYC_VERIFIED:
        return False
    return user.kyc_documents.exists()
