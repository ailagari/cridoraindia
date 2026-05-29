from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.dispatch import receiver
from django.db.models.signals import post_save


class User(AbstractUser):
    """Platform user: customer, jeweller (KYB), or admin."""

    CUSTOMER = "customer"
    JEWELLER = "jeweller"
    ADMIN = "admin"
    USER_TYPE_CHOICES = [
        (CUSTOMER, "Customer"),
        (JEWELLER, "Jeweller"),
        (ADMIN, "Admin"),
    ]

    KYC_PENDING = "pending"
    KYC_VERIFIED = "verified"
    KYC_REJECTED = "rejected"
    KYC_STATUS_CHOICES = [
        (KYC_PENDING, "Pending"),
        (KYC_VERIFIED, "Verified"),
        (KYC_REJECTED, "Rejected"),
    ]

    user_type = models.CharField(
        max_length=20, choices=USER_TYPE_CHOICES, default=CUSTOMER
    )
    phone = models.CharField(max_length=20, blank=True)
    profile_photo_url = models.URLField(
        max_length=512,
        blank=True,
        help_text="Optional profile photo shown in dashboards and menus.",
    )

    # Jeweller / KYB profile (India)
    business_name = models.CharField(max_length=255, blank=True)
    gstin = models.CharField(max_length=15, blank=True)
    shop_address = models.CharField(max_length=512, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=10, blank=True)

    kyc_status = models.CharField(
        max_length=20, choices=KYC_STATUS_CHOICES, default=KYC_PENDING
    )
    kyc_verified_at = models.DateTimeField(null=True, blank=True)

    cridora_member_id = models.CharField(
        max_length=32,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        help_text="Permanent platform id (CRI…); assigned on first save.",
    )
    gold_handle_local = models.CharField(
        max_length=64,
        blank=True,
        help_text="GoldUPI local part before @ (alphanumeric / underscore).",
    )
    gold_routing_code = models.CharField(
        max_length=10,
        unique=True,
        null=True,
        blank=True,
        editable=False,
        help_text="Random 10-digit primary vault routing code (share as code@cridora).",
    )
    gold_upi = models.CharField(
        max_length=130,
        unique=True,
        null=True,
        blank=True,
        help_text="Normalized GoldUPI username@jewellercode (lowercase).",
    )
    payout_upi_vpa = models.CharField(
        max_length=128,
        blank=True,
        help_text="Customer UPI ID for sellback cash payouts.",
    )
    jeweller_code = models.CharField(
        max_length=40,
        blank=True,
        help_text="Public storefront slug for KYB-verified jewellers (GoldUPI suffix).",
    )
    jeweller_referral_code = models.CharField(
        max_length=6,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="6-digit code for customer signup onboarding (verified jewellers only).",
    )
    default_jeweller = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="default_for_customers",
        limit_choices_to={"user_type": JEWELLER},
        help_text="Primary default jeweller (routing, transfers, marketplace).",
    )
    onboarded_by_jeweller = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="onboarded_customers",
        limit_choices_to={"user_type": JEWELLER},
        help_text="Jeweller who referred or onboarded this customer at signup.",
    )
    jeweller_pref_nearby = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="nearby_pref_for_customers",
        limit_choices_to={"user_type": JEWELLER},
    )
    jeweller_pref_ornament = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ornament_pref_for_customers",
        limit_choices_to={"user_type": JEWELLER},
    )
    jeweller_pref_redemption = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="redemption_pref_for_customers",
        limit_choices_to={"user_type": JEWELLER},
    )

    class Meta:
        verbose_name = "User"

    def __str__(self):
        return self.email or self.username


@receiver(post_save, sender=User)
def _assign_cridora_member_id(sender, instance, **kwargs):
    if instance.cridora_member_id:
        return
    cid = f"CRI{instance.pk:010d}"
    User.objects.filter(pk=instance.pk).update(cridora_member_id=cid)

class BankAccount(models.Model):
    """Linked bank account for customer KYC (settlements / payouts)."""

    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (VERIFIED, "Verified"),
        (REJECTED, "Rejected"),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="bank_account"
    )
    account_holder_name = models.CharField(max_length=255)
    account_number = models.CharField(max_length=32)
    ifsc_code = models.CharField(max_length=11)
    bank_name = models.CharField(max_length=255, blank=True)
    branch = models.CharField(max_length=255, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"BankAccount({self.user_id})"


class KYDocument(models.Model):
    """
    KYC (customer) or KYB (jeweller) uploads. Admin reviews in Django admin / future APIs.
    """

    DOC_PENDING = "pending"
    DOC_VERIFIED = "verified"
    DOC_REJECTED = "rejected"
    DOC_STATUS = [
        (DOC_PENDING, "Pending"),
        (DOC_VERIFIED, "Verified"),
        (DOC_REJECTED, "Rejected"),
    ]

    # Customer KYC — identity & tax
    AADHAAR = "aadhaar"
    PAN = "pan"
    SELFIE = "selfie_photo"

    # Jeweller KYB — typical India jewellery business compliance
    PAN_BUSINESS = "pan_business"
    GST_CERTIFICATE = "gst_certificate"
    SHOP_ESTABLISHMENT = "shop_establishment"
    TRADE_LICENSE = "trade_license"
    BIS_HALLMARK = "bis_hallmark"
    INCORPORATION_CERT = "incorporation_certificate"
    PARTNERSHIP_DEED = "partnership_deed"
    ADDRESS_PROOF_SHOP = "address_proof_shop"
    PROPRIETOR_AADHAAR = "proprietor_aadhaar"
    PROPRIETOR_PAN = "proprietor_pan"
    MSME_UDYAM = "msme_udyam"
    IEC_IMPORT_EXPORT = "iec_import_export"

    CUSTOMER_DOC_TYPES = [AADHAAR, PAN, SELFIE]
    JEWELLER_DOC_TYPES = [
        PAN_BUSINESS,
        GST_CERTIFICATE,
        SHOP_ESTABLISHMENT,
        TRADE_LICENSE,
        BIS_HALLMARK,
        INCORPORATION_CERT,
        PARTNERSHIP_DEED,
        ADDRESS_PROOF_SHOP,
        PROPRIETOR_AADHAAR,
        PROPRIETOR_PAN,
        MSME_UDYAM,
        IEC_IMPORT_EXPORT,
    ]

    DOC_TYPE_CHOICES = [
        (AADHAAR, "Aadhaar card"),
        (PAN, "PAN card"),
        (SELFIE, "Live selfie / photograph"),
        (PAN_BUSINESS, "Business PAN"),
        (GST_CERTIFICATE, "GST registration certificate"),
        (SHOP_ESTABLISHMENT, "Shop & Establishment registration"),
        (TRADE_LICENSE, "Municipal trade / shop license"),
        (BIS_HALLMARK, "BIS hallmark license / registration"),
        (INCORPORATION_CERT, "Certificate of incorporation (Company)"),
        (PARTNERSHIP_DEED, "Partnership deed / LLP agreement"),
        (ADDRESS_PROOF_SHOP, "Business address proof"),
        (PROPRIETOR_AADHAAR, "Proprietor / partner Aadhaar"),
        (PROPRIETOR_PAN, "Proprietor / partner PAN"),
        (MSME_UDYAM, "MSME Udyam registration (optional)"),
        (IEC_IMPORT_EXPORT, "IEC (import-export code, if applicable)"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="kyc_documents"
    )
    doc_type = models.CharField(max_length=40, choices=DOC_TYPE_CHOICES)
    file = models.FileField(upload_to="kyc_uploads/%Y/%m/")
    original_filename = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=DOC_STATUS, default=DOC_PENDING)
    rejection_reason = models.TextField(blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-uploaded_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "doc_type"],
                name="unique_user_doc_type",
            )
        ]

    def __str__(self):
        return f"{self.doc_type} ({self.user_id})"


class GoldBalance(models.Model):
    """Per-customer redeemable gold balance in grams (credited via purchases and transfers)."""

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="gold_balance"
    )
    balance_grams = models.DecimalField(max_digits=16, decimal_places=6, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Gold balance"

    def __str__(self):
        return f"GoldBalance({self.user_id}, {self.balance_grams}g)"


class GoldVault(models.Model):
    """Customer gold held with a specific custodian jeweller (random vault card ID)."""

    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="gold_vaults_owned",
        limit_choices_to={"user_type": User.CUSTOMER},
    )
    custodian = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="gold_vaults_custodied",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    vault_public_id = models.CharField(
        max_length=160,
        unique=True,
        null=True,
        blank=True,
        help_text="Public routing ID, e.g. 8472910536@cridora (random, not derived from handle).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["owner", "custodian"],
                name="uniq_goldvault_owner_custodian",
            ),
        ]

    def __str__(self):
        return f"GoldVault({self.owner_id}@{self.custodian_id})"


class VaultHolding(models.Model):
    """Gram balance inside a vault by MVP holding type."""

    FRACTIONAL = "fractional"
    DEPOSIT = "deposit"
    GOLDEN_SCHEME = "golden_scheme"
    LOAN_COLLATERAL = "loan_collateral"
    HOLDING_TYPE_CHOICES = [
        (FRACTIONAL, "Fractional gold"),
        (DEPOSIT, "Gold deposit"),
        (GOLDEN_SCHEME, "Golden scheme"),
        (LOAN_COLLATERAL, "Loan collateral (locked)"),
    ]

    vault = models.ForeignKey(
        GoldVault,
        on_delete=models.CASCADE,
        related_name="holdings",
    )
    holding_type = models.CharField(
        max_length=24,
        choices=HOLDING_TYPE_CHOICES,
        default=FRACTIONAL,
    )
    balance_grams = models.DecimalField(max_digits=16, decimal_places=6, default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["vault", "holding_type"],
                name="uniq_vault_holding_type",
            ),
        ]

    def __str__(self):
        return f"VaultHolding({self.vault_id}, {self.holding_type})"


class PhoneOTPChallenge(models.Model):
    """Short-lived SMS OTP (integration-ready; codes verified server-side)."""

    phone_normalized = models.CharField(max_length=16, db_index=True)
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField(db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"OTP({self.phone_normalized})"


class GoldTransfer(models.Model):
    """P2P gold gram movement for testing GoldUPI routing metadata."""

    from_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="gold_transfers_out"
    )
    to_user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="gold_transfers_in"
    )
    grams = models.DecimalField(max_digits=16, decimal_places=6)
    from_custodian = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transfer_custodian_from",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    to_custodian = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transfer_custodian_to",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"GoldTransfer({self.from_user_id}→{self.to_user_id}, {self.grams}g)"


class FractionalGoldPurchase(models.Model):
    """Customer buys fractional gold from a jeweller; counter sales need jeweller verification before credit."""

    PENDING_PAYMENT = "pending_payment"
    SIGNAL_RECEIVED = "signal_received"
    AWAITING_COUNTER = "awaiting_counter"
    AWAITING_UTR_VERIFY = "awaiting_utr_verify"
    PENDING_REVIEW = "pending_review"
    NEEDS_MANUAL_VERIFICATION = "needs_manual_verification"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    PROOF_REJECTED = "proof_rejected"
    ON_HOLD = "on_hold"

    STATUS_CHOICES = [
        (PENDING_PAYMENT, "Pending payment"),
        (SIGNAL_RECEIVED, "Payment signal received"),
        (AWAITING_COUNTER, "Awaiting counter confirmation"),
        (AWAITING_UTR_VERIFY, "Awaiting UTR verification"),
        (PENDING_REVIEW, "Pending jeweller review"),
        (NEEDS_MANUAL_VERIFICATION, "Needs manual verification"),
        (COMPLETED, "Completed"),
        (REJECTED, "Rejected"),
        (CANCELLED, "Cancelled"),
        (PROOF_REJECTED, "Proof rejected — reupload required"),
        (ON_HOLD, "On hold — visit jeweller"),
    ]

    PAY_UPI = "upi"
    PAY_COUNTER = "counter"
    PAYMENT_CHOICES = [(PAY_UPI, "UPI"), (PAY_COUNTER, "Pay at counter")]

    customer = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="fractional_purchases"
    )
    jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="fractional_sales",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    metal_rate_inr_per_gram = models.DecimalField(max_digits=12, decimal_places=2)
    grams = models.DecimalField(max_digits=16, decimal_places=6)
    gold_value_inr_pre_gst = models.DecimalField(max_digits=14, decimal_places=2)
    gst_percent = models.DecimalField(max_digits=6, decimal_places=3, default=3)
    gst_inr = models.DecimalField(max_digits=14, decimal_places=2)
    total_inr = models.DecimalField(max_digits=14, decimal_places=2)
    payment_method = models.CharField(max_length=16, choices=PAYMENT_CHOICES)
    status = models.CharField(
        max_length=32, choices=STATUS_CHOICES, default=PENDING_PAYMENT
    )
    jeweller_verified_at = models.DateTimeField(null=True, blank=True)
    customer_note = models.CharField(max_length=255, blank=True)
    payee_upi_vpa = models.CharField(
        max_length=128,
        blank=True,
        help_text="Snapshot of jeweller UPI VPA when the order was created.",
    )
    payment_note = models.CharField(
        max_length=128,
        blank=True,
        help_text="UPI transaction note, e.g. Cridora FR-42.",
    )
    payment_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When an unfunded UPI order should expire.",
    )
    upi_utr = models.CharField(
        max_length=32,
        null=True,
        blank=True,
        unique=True,
        help_text="Customer-submitted UPI reference number.",
    )
    utr_submitted_at = models.DateTimeField(null=True, blank=True)
    reconciliation_score = models.PositiveSmallIntegerField(null=True, blank=True)
    reconciliation_flags = models.JSONField(default=dict, blank=True)
    reconciled_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="fractional_purchases_confirmed",
    )
    best_payment_signal = models.ForeignKey(
        "PaymentSignal",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    payment_signal_at = models.DateTimeField(null=True, blank=True)
    upi_proof_file = models.FileField(upload_to="upi_proofs/%Y/%m/", blank=True)
    upi_rejection_count = models.PositiveSmallIntegerField(default=0)
    upi_last_rejection_remark = models.TextField(blank=True)
    upi_fraud_reported = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def order_reference(self) -> str:
        return f"CR-{self.pk}"

    def __str__(self):
        return f"FractionalGoldPurchase({self.customer_id}, {self.grams}g, {self.status})"


class PaymentSignal(models.Model):
    """Inbound payment evidence for UPI reconciliation."""

    SOURCE_UPI_INTENT = "upi_intent"
    SOURCE_USER_INPUT = "user_input"
    SOURCE_SMS_PARSE = "sms_parse"
    SOURCE_JEWELLER_CONFIRMATION = "jeweller_confirmation"

    SOURCE_CHOICES = [
        (SOURCE_UPI_INTENT, "UPI intent metadata"),
        (SOURCE_USER_INPUT, "User input"),
        (SOURCE_SMS_PARSE, "SMS parse"),
        (SOURCE_JEWELLER_CONFIRMATION, "Jeweller confirmation"),
    ]

    fractional_purchase = models.ForeignKey(
        FractionalGoldPurchase,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="payment_signals",
    )
    loan_repayment = models.ForeignKey(
        "GoldLoanRepaymentRequest",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="payment_signals",
    )
    order_id_hint = models.CharField(
        max_length=32,
        blank=True,
        help_text="Unmatched SMS hint, e.g. CR-42 or LRP-7.",
    )
    amount_inr = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    timestamp = models.DateTimeField()
    upi_vpa = models.CharField(max_length=128, blank=True)
    utr = models.CharField(max_length=32, blank=True)
    sms_reference = models.TextField(blank=True)
    source = models.CharField(max_length=32, choices=SOURCE_CHOICES)
    parsed_payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class PlatformSettlementBatch(models.Model):
    """Aggregated platform fee settlement period per jeweller."""

    jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="platform_settlement_batches",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    period_label = models.CharField(max_length=64)
    net_payable_inr = models.DecimalField(max_digits=18, decimal_places=2)
    settled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class PlatformCommercialLedgerEntry(models.Model):
    """Cridora platform spread/fee owed by jeweller (separate from operational gram ledger)."""

    KIND_SPREAD_FEE = "spread_fee"
    KIND_CROSS_PLATFORM_FEE = "cross_platform_fee"

    KIND_CHOICES = [
        (KIND_SPREAD_FEE, "Spread fee"),
        (KIND_CROSS_PLATFORM_FEE, "Cross-platform fee"),
    ]

    STATUS_PENDING_SETTLEMENT = "pending_settlement"
    STATUS_SETTLED = "settled"

    STATUS_CHOICES = [
        (STATUS_PENDING_SETTLEMENT, "Pending settlement"),
        (STATUS_SETTLED, "Settled"),
    ]

    jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="platform_commercial_entries",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    fractional_purchase = models.ForeignKey(
        FractionalGoldPurchase,
        on_delete=models.CASCADE,
        related_name="platform_commercial_entries",
        null=True,
        blank=True,
    )
    vault_product_redemption = models.ForeignKey(
        "VaultProductRedemption",
        on_delete=models.CASCADE,
        related_name="platform_commercial_entries",
        null=True,
        blank=True,
    )
    amount_inr = models.DecimalField(max_digits=14, decimal_places=2)
    kind = models.CharField(max_length=32, choices=KIND_CHOICES, default=KIND_SPREAD_FEE)
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING_SETTLEMENT,
    )
    settlement_batch = models.ForeignKey(
        PlatformSettlementBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class PlatformSettlementPayment(models.Model):
    """Manual settlement payment with receipt upload (jeweller↔platform)."""

    DIR_JEWELLER_TO_PLATFORM = "jeweller_to_platform"
    DIR_PLATFORM_TO_JEWELLER = "platform_to_jeweller"
    DIRECTION_CHOICES = [
        (DIR_JEWELLER_TO_PLATFORM, "Jeweller to platform"),
        (DIR_PLATFORM_TO_JEWELLER, "Platform to jeweller"),
    ]

    PAY_UPI = "upi"
    PAY_OTP = "otp"
    PAYMENT_METHOD_CHOICES = [
        (PAY_UPI, "UPI"),
        (PAY_OTP, "OTP"),
    ]

    STATUS_PENDING_PROOF = "pending_proof"
    STATUS_SUBMITTED = "submitted"
    STATUS_CONFIRMED = "confirmed"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING_PROOF, "Pending proof"),
        (STATUS_SUBMITTED, "Submitted"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_REJECTED, "Rejected"),
    ]

    direction = models.CharField(max_length=32, choices=DIRECTION_CHOICES)
    jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="platform_settlement_payments",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    settlement_batch = models.ForeignKey(
        PlatformSettlementBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
    )
    amount_inr = models.DecimalField(max_digits=18, decimal_places=2)
    payment_method = models.CharField(
        max_length=16,
        choices=PAYMENT_METHOD_CHOICES,
        default=PAY_UPI,
    )
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING_PROOF,
    )
    paid_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="platform_settlement_payments_paid",
    )
    receipt_file = models.FileField(upload_to="settlement_receipts/%Y/%m/", blank=True)
    reference_note = models.CharField(max_length=256, blank=True)
    utr = models.CharField(max_length=64, blank=True)
    confirmed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="platform_settlement_payments_confirmed",
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.CharField(max_length=512, blank=True)
    upi_rejection_count = models.PositiveSmallIntegerField(default=0)
    upi_last_rejection_remark = models.TextField(blank=True)
    upi_fraud_reported = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class PlatformSettlementOtp(models.Model):
    """Offline settlement OTP — payer generates, receiver verifies."""

    payment = models.OneToOneField(
        PlatformSettlementPayment,
        on_delete=models.CASCADE,
        related_name="settlement_otp",
    )
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField(db_index=True)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class GoldSellbackRequest(models.Model):
    """Customer sells fractional vault gold back to the custodian jeweller (cash or UPI payout)."""

    STATUS_PENDING_JEWELLER = "pending_jeweller"
    STATUS_REJECTED = "rejected"
    STATUS_ACCEPTED_AWAITING_OTP = "accepted_awaiting_otp"
    STATUS_AWAITING_UTR_VERIFY = "awaiting_utr_verify"
    STATUS_PENDING_REVIEW = "pending_review"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_PROOF_REJECTED = "proof_rejected"
    STATUS_ON_HOLD = "on_hold"

    STATUS_CHOICES = [
        (STATUS_PENDING_JEWELLER, "Pending jeweller"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_ACCEPTED_AWAITING_OTP, "Accepted awaiting OTP"),
        (STATUS_AWAITING_UTR_VERIFY, "Awaiting UTR verification"),
        (STATUS_PENDING_REVIEW, "Pending customer review"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_PROOF_REJECTED, "Proof rejected — reupload required"),
        (STATUS_ON_HOLD, "On hold — visit customer"),
    ]

    PAY_CASH = "cash"
    PAY_UPI = "upi"
    PAYMENT_CHOICES = [
        (PAY_CASH, "Cash at counter"),
        (PAY_UPI, "UPI"),
    ]

    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="gold_sellbacks",
        limit_choices_to={"user_type": User.CUSTOMER},
    )
    jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="gold_sellbacks_as_jeweller",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    grams = models.DecimalField(max_digits=16, decimal_places=6)
    reference_metal_inr_per_gram_snapshot = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Jeweller reference 22K metal ₹/g at quote time (before sellback spread).",
    )
    buyback_inr_per_gram_snapshot = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Indicative buyback ₹/g credited to customer (policy + headline rules).",
    )
    cash_estimate_inr = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        help_text="grams × buyback ₹/g at execution.",
    )
    payment_method = models.CharField(
        max_length=16,
        choices=PAYMENT_CHOICES,
        default=PAY_CASH,
    )
    payout_upi_vpa = models.CharField(
        max_length=128,
        blank=True,
        help_text="Snapshot of customer UPI VPA for online payout.",
    )
    payment_note = models.CharField(
        max_length=128,
        blank=True,
        help_text="UPI transaction note, e.g. Cridora SB-42.",
    )
    payout_expires_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When an unfunded UPI payout should expire.",
    )
    upi_utr = models.CharField(
        max_length=32,
        null=True,
        blank=True,
        unique=True,
        help_text="Jeweller-submitted UPI reference after paying customer.",
    )
    utr_submitted_at = models.DateTimeField(null=True, blank=True)
    upi_proof_file = models.FileField(upload_to="upi_proofs/%Y/%m/", blank=True)
    upi_rejection_count = models.PositiveSmallIntegerField(default=0)
    upi_last_rejection_remark = models.TextField(blank=True)
    upi_fraud_reported = models.BooleanField(default=False)
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING_JEWELLER,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]

    def __str__(self):
        return f"GoldSellbackRequest({self.customer_id}, {self.jeweller_id}, {self.grams}g)"


class GoldLoanRequest(models.Model):
    """Customer pledges custodied vault gold for a cash loan from the custodian jeweller."""

    STATUS_PENDING_JEWELLER = "pending_jeweller"
    STATUS_REJECTED = "rejected"
    STATUS_ACCEPTED_AWAITING_OTP = "accepted_awaiting_otp"
    STATUS_DISBURSED = "disbursed"
    STATUS_REPAID = "repaid"
    STATUS_CANCELLED = "cancelled"
    # Legacy alias kept for old rows until migrated
    STATUS_APPROVED = STATUS_ACCEPTED_AWAITING_OTP

    STATUS_CHOICES = [
        (STATUS_PENDING_JEWELLER, "Pending jeweller"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_ACCEPTED_AWAITING_OTP, "Accepted awaiting OTP"),
        (STATUS_DISBURSED, "Disbursed"),
        (STATUS_REPAID, "Repaid"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    PAY_CASH = "cash"
    PAYMENT_CHOICES = [
        (PAY_CASH, "Cash at counter"),
    ]

    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="gold_loans",
        limit_choices_to={"user_type": User.CUSTOMER},
    )
    jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="gold_loans_as_jeweller",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    grams = models.DecimalField(max_digits=16, decimal_places=6)
    reference_metal_inr_per_gram_snapshot = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Jeweller reference 22K metal ₹/g at quote time.",
    )
    collateral_value_inr_snapshot = models.DecimalField(max_digits=16, decimal_places=2)
    ltv_percent_snapshot = models.DecimalField(max_digits=8, decimal_places=3)
    gross_principal_inr_snapshot = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        help_text="Loan principal before processing fee (collateral × LTV%).",
    )
    processing_fee_percent_snapshot = models.DecimalField(max_digits=8, decimal_places=3)
    processing_fee_inr_snapshot = models.DecimalField(max_digits=16, decimal_places=2)
    processing_fee_jeweller_share_inr_snapshot = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        default=Decimal("0"),
    )
    net_disbursement_inr_snapshot = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        help_text="Cash to customer after processing fee deduction.",
    )
    payment_method = models.CharField(
        max_length=16,
        choices=PAYMENT_CHOICES,
        default=PAY_CASH,
    )
    term_months = models.PositiveSmallIntegerField(
        default=12,
        help_text="Loan tenure in months (1–platform max, typically 12).",
    )
    collateral_fractional_grams = models.DecimalField(
        max_digits=16,
        decimal_places=6,
        default=Decimal("0"),
    )
    collateral_deposit_grams = models.DecimalField(
        max_digits=16,
        decimal_places=6,
        default=Decimal("0"),
    )
    principal_paid_inr = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        default=Decimal("0"),
        help_text="Cumulative principal repaid in INR.",
    )
    disbursed_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING_JEWELLER,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]

    @property
    def principal_outstanding_inr(self) -> Decimal:
        owed = self.gross_principal_inr_snapshot - self.principal_paid_inr
        return owed if owed > 0 else Decimal("0")

    def __str__(self):
        return f"GoldLoanRequest({self.customer_id}, {self.jeweller_id}, {self.grams}g)"


class GoldLoanRepayment(models.Model):
    """Customer repayment (partial or full) against an active gold loan."""

    loan = models.ForeignKey(
        GoldLoanRequest,
        on_delete=models.CASCADE,
        related_name="repayments",
    )
    amount_inr = models.DecimalField(max_digits=16, decimal_places=2)
    principal_after_inr = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        help_text="Principal outstanding immediately after this payment.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"GoldLoanRepayment(loan={self.loan_id}, ₹{self.amount_inr})"


class GoldLoanRepaymentRequest(models.Model):
    """Customer-initiated repayment (cash OTP or UPI reconciliation)."""

    STATUS_PENDING_PAYMENT = "pending_payment"
    STATUS_SIGNAL_RECEIVED = "signal_received"
    STATUS_PENDING_JEWELLER = "pending_jeweller"
    STATUS_PENDING_REVIEW = "pending_review"
    STATUS_NEEDS_MANUAL_VERIFICATION = "needs_manual_verification"
    STATUS_REJECTED = "rejected"
    STATUS_ACCEPTED_AWAITING_OTP = "accepted_awaiting_otp"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_PROOF_REJECTED = "proof_rejected"
    STATUS_ON_HOLD = "on_hold"

    STATUS_CHOICES = [
        (STATUS_PENDING_PAYMENT, "Pending UPI payment"),
        (STATUS_SIGNAL_RECEIVED, "Payment signal received"),
        (STATUS_PENDING_JEWELLER, "Pending jeweller"),
        (STATUS_PENDING_REVIEW, "Pending jeweller review"),
        (STATUS_NEEDS_MANUAL_VERIFICATION, "Needs manual verification"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_ACCEPTED_AWAITING_OTP, "Accepted awaiting OTP"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_PROOF_REJECTED, "Proof rejected — reupload required"),
        (STATUS_ON_HOLD, "On hold — visit jeweller"),
    ]

    PAY_CASH = "cash"
    PAY_UPI = "upi"
    PAYMENT_CHOICES = [(PAY_CASH, "Cash"), (PAY_UPI, "UPI")]

    loan = models.ForeignKey(
        GoldLoanRequest,
        on_delete=models.CASCADE,
        related_name="repayment_requests",
    )
    amount_inr = models.DecimalField(max_digits=16, decimal_places=2)
    payment_method = models.CharField(
        max_length=16,
        choices=PAYMENT_CHOICES,
        default=PAY_CASH,
    )
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING_JEWELLER,
    )
    payee_upi_vpa = models.CharField(max_length=128, blank=True)
    payment_note = models.CharField(max_length=128, blank=True)
    payment_expires_at = models.DateTimeField(null=True, blank=True)
    upi_utr = models.CharField(max_length=32, blank=True)
    utr_submitted_at = models.DateTimeField(null=True, blank=True)
    reconciliation_score = models.PositiveSmallIntegerField(null=True, blank=True)
    reconciliation_flags = models.JSONField(default=dict, blank=True)
    reconciled_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="loan_repayments_confirmed",
    )
    best_payment_signal = models.ForeignKey(
        PaymentSignal,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    payment_signal_at = models.DateTimeField(null=True, blank=True)
    upi_proof_file = models.FileField(upload_to="upi_proofs/%Y/%m/", blank=True)
    upi_rejection_count = models.PositiveSmallIntegerField(default=0)
    upi_last_rejection_remark = models.TextField(blank=True)
    upi_fraud_reported = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]

    @property
    def order_reference(self) -> str:
        return f"LRP-{self.pk}"

    def __str__(self):
        return f"GoldLoanRepaymentRequest(loan={self.loan_id}, ₹{self.amount_inr})"


class GoldLoanRepaymentOtp(models.Model):
    """OTP customer shares with jeweller after paying cash toward a loan."""

    repayment_request = models.OneToOneField(
        GoldLoanRepaymentRequest,
        on_delete=models.CASCADE,
        related_name="settlement_otp",
    )
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField(db_index=True)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Gold loan repayment OTP"

    def __str__(self):
        return f"GoldLoanRepaymentOtp(request={self.repayment_request_id})"


class GoldLoanOtp(models.Model):
    """OTP customer shares with jeweller after receiving cash loan disbursement."""

    loan = models.OneToOneField(
        GoldLoanRequest,
        on_delete=models.CASCADE,
        related_name="settlement_otp",
    )
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField(db_index=True)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Gold loan settlement OTP"

    def __str__(self):
        return f"GoldLoanOtp(loan={self.loan_id})"


class GoldSellbackOtp(models.Model):
    """OTP customer shares with jeweller after offline cash payout to settle vault debit."""

    sellback = models.OneToOneField(
        GoldSellbackRequest,
        on_delete=models.CASCADE,
        related_name="settlement_otp",
    )
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField(db_index=True)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"GoldSellbackOtp(sellback={self.sellback_id})"


class FractionalCounterOtp(models.Model):
    """In-app OTP for pay-at-counter fractional purchases; jeweller enters plaintext code."""

    purchase = models.OneToOneField(
        FractionalGoldPurchase,
        on_delete=models.CASCADE,
        related_name="counter_otp",
    )
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField(db_index=True)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"FractionalCounterOtp(purchase={self.purchase_id})"


class GoldDepositIntake(models.Model):
    """Physical gold deposit at jeweller counter; customer OTP confirms before vault credit."""

    AWAITING_CUSTOMER_OTP = "awaiting_customer_otp"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (AWAITING_CUSTOMER_OTP, "Awaiting customer OTP"),
        (COMPLETED, "Completed"),
        (CANCELLED, "Cancelled"),
    ]

    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="gold_deposit_intakes",
        limit_choices_to={"user_type": User.CUSTOMER},
    )
    jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="gold_deposit_intakes_as_jeweller",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    grams = models.DecimalField(max_digits=16, decimal_places=6)
    purity_karat = models.CharField(
        max_length=32,
        default="22",
        help_text="Declared purity (e.g. 22, 916 BIS) after verification.",
    )
    reference_metal_inr_per_gram = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Jeweller reference 22K metal ₹/g at intake.",
    )
    estimated_value_inr = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        help_text="grams × reference rate (indicative).",
    )
    jeweller_note = models.CharField(max_length=500, blank=True, default="")
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default=AWAITING_CUSTOMER_OTP,
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"GoldDepositIntake({self.customer_id}, {self.grams}g, {self.status})"


class GoldDepositCounterOtp(models.Model):
    """In-app OTP for gold deposit intake; jeweller enters plaintext code."""

    intake = models.OneToOneField(
        GoldDepositIntake,
        on_delete=models.CASCADE,
        related_name="counter_otp",
    )
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField(db_index=True)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"GoldDepositCounterOtp(intake={self.intake_id})"


class VaultProductRedemption(models.Model):
    """Marketplace SKU paid by debiting the customer's vault at the listing jeweller."""

    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="vault_product_redemptions",
        limit_choices_to={"user_type": User.CUSTOMER},
    )
    jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="vault_product_redemptions_as_jeweller",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    product = models.ForeignKey(
        "marketplace.MarketplaceProduct",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vault_redemptions",
    )
    product_name = models.CharField(max_length=255)
    grams_charged = models.DecimalField(max_digits=16, decimal_places=6)
    final_invoice_inr = models.DecimalField(max_digits=16, decimal_places=2)
    jeweller_subtotal_inr = models.DecimalField(max_digits=16, decimal_places=2)
    metal_rate_inr_per_gram = models.DecimalField(max_digits=12, decimal_places=2)
    same_store_checkout = models.BooleanField(default=False)
    cross_platform_fee_inr = models.DecimalField(
        max_digits=12, decimal_places=2, default=0
    )
    cash_paid_inr = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        default=0,
        help_text="Cash/UPI collected at checkout (balance after vault grams).",
    )
    cash_payment_method = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="counter_cash, counter_upi, card_demo, etc.",
    )
    gst_on_gold_saved_inr = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="GST on gold not charged because metal was paid from taxed vault.",
    )
    cross_redemption_request = models.ForeignKey(
        "CrossRedemptionRequest",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vault_product_redemptions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"VaultProductRedemption({self.customer_id}, {self.product_name[:40]})"


class CridoraPayBill(models.Model):
    """Jeweller counter bill — customer pays via vault and/or UPI; completes as one personal holding."""

    STATUS_AWAITING_CUSTOMER = "awaiting_customer"
    STATUS_UPI_PENDING = "upi_pending"
    STATUS_VAULT_OTP_PENDING = "vault_otp_pending"
    STATUS_CASH_PENDING = "cash_pending"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_EXPIRED = "expired"
    STATUS_PENDING_REVIEW = "pending_review"
    STATUS_PROOF_REJECTED = "proof_rejected"
    STATUS_ON_HOLD = "on_hold"

    STATUS_CHOICES = [
        (STATUS_AWAITING_CUSTOMER, "Awaiting customer"),
        (STATUS_UPI_PENDING, "UPI pending"),
        (STATUS_VAULT_OTP_PENDING, "Vault OTP pending"),
        (STATUS_CASH_PENDING, "Cash pending"),
        (STATUS_PENDING_REVIEW, "Pending jeweller review"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_EXPIRED, "Expired"),
        (STATUS_PROOF_REJECTED, "Proof rejected — reupload required"),
        (STATUS_ON_HOLD, "On hold — visit jeweller"),
    ]

    PAY_VAULT = "vault"
    PAY_UPI = "upi"
    PAYMENT_CHOICES = [(PAY_VAULT, "Vault"), (PAY_UPI, "UPI")]

    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="cridorapay_bills",
        limit_choices_to={"user_type": User.CUSTOMER},
    )
    jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="cridorapay_bills_as_jeweller",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    title = models.CharField(max_length=255, default="Shop purchase")
    category = models.CharField(
        max_length=24,
        default="ornament",
    )
    weight_grams = models.DecimalField(max_digits=16, decimal_places=6)
    purity = models.CharField(max_length=64, default="BIS 916")
    total_inr = models.DecimalField(max_digits=16, decimal_places=2)
    metal_rate_inr_per_gram = models.DecimalField(max_digits=12, decimal_places=2)
    jeweller_note = models.CharField(max_length=500, blank=True)
    status = models.CharField(
        max_length=32,
        choices=STATUS_CHOICES,
        default=STATUS_AWAITING_CUSTOMER,
    )
    payment_method = models.CharField(max_length=16, choices=PAYMENT_CHOICES, blank=True, default="")
    vault_grams_chosen = models.DecimalField(max_digits=16, decimal_places=6, default=0)
    vault_inr_applied = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    cash_payable_inr = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    vault_debited = models.BooleanField(default=False)
    payee_upi_vpa = models.CharField(max_length=128, blank=True, default="")
    payment_note = models.CharField(max_length=128, blank=True, default="")
    upi_utr = models.CharField(max_length=32, blank=True, default="")
    utr_submitted_at = models.DateTimeField(null=True, blank=True)
    upi_proof_file = models.FileField(upload_to="upi_proofs/%Y/%m/", blank=True)
    upi_rejection_count = models.PositiveSmallIntegerField(default=0)
    upi_last_rejection_remark = models.TextField(blank=True)
    upi_fraud_reported = models.BooleanField(default=False)
    purchase_invoice = models.FileField(upload_to="cridorapay_invoices/%Y/%m/", blank=True)
    purchase_invoice_filename = models.CharField(max_length=255, blank=True, default="")
    personal_holding = models.ForeignKey(
        "PersonalGoldHolding",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cridorapay_bills",
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def reference(self) -> str:
        return f"CP-{self.pk}"

    def __str__(self):
        return f"CridoraPayBill({self.reference}, {self.customer_id})"


class CridoraPayOtp(models.Model):
    bill = models.OneToOneField(
        CridoraPayBill,
        on_delete=models.CASCADE,
        related_name="settlement_otp",
    )
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "CridoraPay OTP"

    def __str__(self):
        return f"CridoraPayOtp(bill={self.bill_id})"


class PlatformOperationalSettings(models.Model):
    """Singleton (pk=1): runtime operational limits configurable without redeploy."""

    fractional_counter_otp_ttl_seconds = models.PositiveIntegerField(
        default=900,
        validators=[MinValueValidator(60), MaxValueValidator(86400)],
        help_text="Counter fractional OTP validity window (60–86400 seconds).",
    )
    fractional_markup_percent = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
        help_text="Platform markup on fractional purchase metal rate (0–100%).",
    )
    feature_flags = models.JSONField(
        default=dict,
        blank=True,
        help_text="Admin overrides for platform feature rollout (key -> bool).",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Platform operational settings"
        verbose_name_plural = "Platform operational settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        return None

    def __str__(self):
        return "Platform operational settings"

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class JewellerLiabilityBalance(models.Model):
    """Aggregate custodial gold grams the jeweller owes Cridora customers (vault-backed)."""

    jeweller = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="custodial_liability_balance",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    liability_grams = models.DecimalField(max_digits=16, decimal_places=6, default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"JewellerLiabilityBalance({self.jeweller_id}, {self.liability_grams}g)"


class JewellerLiabilityLedgerEntry(models.Model):
    """Audit row: liability credits on fractional sales and releases on customer sellback."""

    LEDGER_KIND_FRACTIONAL_CREDIT = "fractional_credit"
    LEDGER_KIND_SELLBACK_RELEASE = "sellback_release"
    LEDGER_KIND_DEPOSIT_CREDIT = "deposit_credit"
    LEDGER_KIND_REDEMPTION_PURCHASE_RELEASE = "redemption_purchase_release"
    LEDGER_KIND_CROSS_REDEMPTION_SOURCE_RELEASE = "cross_redemption_source_release"
    LEDGER_KIND_CROSS_REDEMPTION_DEST_ASSUME = "cross_redemption_dest_assume"
    LEDGER_KIND_CROSS_REDEMPTION_SOURCE_ROLLBACK = "cr_xr_src_rel_rb"
    LEDGER_KIND_CROSS_REDEMPTION_DEST_ROLLBACK = "cr_xr_dst_asm_rb"
    LEDGER_KIND_CORRIDORAPAY_RELEASE = "corridorapay_release"
    LEDGER_KIND_CHOICES = [
        (LEDGER_KIND_FRACTIONAL_CREDIT, "Fractional credit"),
        (LEDGER_KIND_SELLBACK_RELEASE, "Sellback release"),
        (LEDGER_KIND_DEPOSIT_CREDIT, "Gold deposit credit"),
        (LEDGER_KIND_REDEMPTION_PURCHASE_RELEASE, "Vault redemption purchase"),
        (LEDGER_KIND_CROSS_REDEMPTION_SOURCE_RELEASE, "Cross redemption source release"),
        (LEDGER_KIND_CROSS_REDEMPTION_DEST_ASSUME, "Cross redemption destination assume"),
        (LEDGER_KIND_CROSS_REDEMPTION_SOURCE_ROLLBACK, "Cross redemption source rollback"),
        (LEDGER_KIND_CROSS_REDEMPTION_DEST_ROLLBACK, "Cross redemption dest rollback"),
        (LEDGER_KIND_CORRIDORAPAY_RELEASE, "CridoraPay vault release"),
    ]

    jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="custodial_liability_entries",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    customer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="jeweller_liability_entries_as_customer",
        limit_choices_to={"user_type": User.CUSTOMER},
    )
    grams = models.DecimalField(max_digits=16, decimal_places=6)
    kind = models.CharField(
        max_length=32,
        choices=LEDGER_KIND_CHOICES,
        default=LEDGER_KIND_FRACTIONAL_CREDIT,
    )
    fractional_purchase = models.ForeignKey(
        FractionalGoldPurchase,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="liability_entries",
    )
    gold_sellback = models.ForeignKey(
        GoldSellbackRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sellback_liability_entries",
    )
    gold_deposit_intake = models.ForeignKey(
        "GoldDepositIntake",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="liability_entries",
    )
    vault_product_redemption = models.ForeignKey(
        "VaultProductRedemption",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="liability_entries",
    )
    cross_redemption_request = models.ForeignKey(
        "CrossRedemptionRequest",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="liability_entries",
    )
    corridorapay_bill = models.ForeignKey(
        "CridoraPayBill",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="liability_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"JewellerLiabilityLedgerEntry(j={self.jeweller_id}, {self.grams}g)"


class JewellerRevenueBalance(models.Model):
    """Running total of recorded jeweller revenue (INR) from platform transactions."""

    jeweller = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="revenue_balance",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    total_revenue_inr = models.DecimalField(max_digits=16, decimal_places=2, default=Decimal("0"))
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"JewellerRevenueBalance({self.jeweller_id}, ₹{self.total_revenue_inr})"


class JewellerRevenueLedgerEntry(models.Model):
    """INR revenue credited to a jeweller (sales, loan fees, ornament checkout, etc.)."""

    KIND_FRACTIONAL_SALE = "fractional_sale"
    KIND_LOAN_PROCESSING_FEE = "loan_processing_fee"
    KIND_ORNAMENT_SALE = "ornament_sale"
    KIND_DEPOSIT_INTAKE = "deposit_intake"

    KIND_CHOICES = [
        (KIND_FRACTIONAL_SALE, "Fractional gold sale"),
        (KIND_LOAN_PROCESSING_FEE, "Gold loan processing fee share"),
        (KIND_ORNAMENT_SALE, "Ornament / vault product sale"),
        (KIND_DEPOSIT_INTAKE, "Gold deposit intake"),
    ]

    jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="revenue_ledger_entries",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    customer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="jeweller_revenue_entries_as_customer",
        limit_choices_to={"user_type": User.CUSTOMER},
    )
    amount_inr = models.DecimalField(max_digits=16, decimal_places=2)
    kind = models.CharField(max_length=32, choices=KIND_CHOICES)
    reference_label = models.CharField(max_length=64, blank=True)
    fractional_purchase = models.ForeignKey(
        FractionalGoldPurchase,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="revenue_entries",
    )
    gold_loan = models.ForeignKey(
        "GoldLoanRequest",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="revenue_entries",
    )
    vault_product_redemption = models.ForeignKey(
        VaultProductRedemption,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="revenue_entries",
    )
    gold_deposit_intake = models.ForeignKey(
        "GoldDepositIntake",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="revenue_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["gold_loan", "kind"],
                condition=models.Q(gold_loan__isnull=False, kind="loan_processing_fee"),
                name="uniq_jeweller_revenue_loan_fee",
            ),
        ]

    def __str__(self):
        return f"JewellerRevenueLedgerEntry(j={self.jeweller_id}, ₹{self.amount_inr}, {self.kind})"


class JewellerCrossPolicy(models.Model):
    """Per-jeweller cross-redemption caps, reserve, and optional source-approval gate (MVP)."""

    jeweller = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="cross_redemption_policy",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    require_source_approval = models.BooleanField(
        default=False,
        help_text="When true, every cross-redemption from this jeweller needs manual source approval.",
    )
    instant_enabled = models.BooleanField(default=False)
    allow_cross_redemption = models.BooleanField(default=True)
    auto_cross_grams_per_day = models.DecimalField(
        max_digits=12, decimal_places=4, default=20,
        help_text="Max grams/day auto-approved at source (0 = no auto cap).",
    )
    auto_cross_inr_per_day = models.DecimalField(
        max_digits=18, decimal_places=2, default=200_000,
        help_text="Max INR/day auto-approved at source (0 = no auto cap).",
    )
    single_txn_gram_limit = models.DecimalField(
        max_digits=12, decimal_places=4, default=10,
        help_text="Above this grams per txn → manual approval (0 = off).",
    )
    single_txn_inr_limit = models.DecimalField(
        max_digits=18, decimal_places=2, default=100_000,
        help_text="Above this INR per txn → manual approval (0 = off).",
    )
    daily_txn_count_limit = models.PositiveIntegerField(
        default=25,
        help_text="Above this count/day → manual approval (0 = off).",
    )
    auth_expiry_minutes = models.PositiveIntegerField(
        default=15,
        help_text="Minutes before pending source approval expires.",
    )
    trust_tier = models.PositiveSmallIntegerField(default=0)
    settlement_delay_hours = models.PositiveIntegerField(default=24)
    max_daily_exposure_inr = models.DecimalField(max_digits=18, decimal_places=2, default=500_000)
    max_pending_liability_inr = models.DecimalField(max_digits=18, decimal_places=2, default=10_000_000)
    reserve_balance_inr = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    risk_multiplier = models.DecimalField(max_digits=8, decimal_places=2, default=3)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Jeweller cross-redemption policy"

    def __str__(self):
        return f"JewellerCrossPolicy(j={self.jeweller_id})"


class CrossRedemptionRequest(models.Model):
    """Cross-jeweller redemption authorization + saga (grams move only after fulfillment checkpoint)."""

    class LifecycleStage(models.TextChoices):
        AUTH = "auth", "Auth"
        FULFILLMENT = "fulfillment", "Fulfillment"
        SETTLEMENT = "settlement", "Settlement"
        CLOSED = "closed", "Closed"

    class Outcome(models.TextChoices):
        SUCCESS = "success", "Success"
        FAILURE = "failure", "Failure"

    class CloseReason(models.TextChoices):
        TIMEOUT = "timeout", "Timeout"
        REJECT = "reject", "Reject"
        RISK_BLOCK = "risk_block", "Risk block"
        USER_CANCEL = "user_cancel", "User cancel"
        SYSTEM_KILL_SWITCH = "system_kill_switch", "System kill switch"

    class SagaStatus(models.TextChoices):
        IDLE = "idle", "Idle"
        IN_PROGRESS = "in_progress", "In progress"
        COMMITTED = "committed", "Committed"
        COMPENSATING = "compensating", "Compensating"
        ABORTED = "aborted", "Aborted"

    class WorkflowState(models.TextChoices):
        AWAITING_DESTINATION = "awaiting_destination", "Awaiting destination"
        AWAITING_SOURCE = "awaiting_source", "Awaiting source"
        SAGA_PENDING = "saga_pending", "Saga pending"
        SAGA_DONE = "saga_done", "Saga done"

    class AuthTier(models.TextChoices):
        AUTO = "auto", "Auto"
        MANUAL = "manual", "Manual"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="cross_redemption_requests",
        limit_choices_to={"user_type": User.CUSTOMER},
    )
    source_jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="cross_redemption_requests_as_source",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    destination_jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="cross_redemption_requests_as_destination",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    grams = models.DecimalField(max_digits=16, decimal_places=6)
    estimated_value_snapshot_inr = models.DecimalField(max_digits=18, decimal_places=2)
    public_reference = models.CharField(max_length=32, blank=True, db_index=True)
    auth_tier = models.CharField(
        max_length=16,
        choices=AuthTier.choices,
        default=AuthTier.MANUAL,
    )
    auth_expires_at = models.DateTimeField(null=True, blank=True)
    lifecycle_stage = models.CharField(
        max_length=16,
        choices=LifecycleStage.choices,
        default=LifecycleStage.AUTH,
    )
    outcome = models.CharField(
        max_length=16,
        choices=Outcome.choices,
        null=True,
        blank=True,
    )
    close_reason_code = models.CharField(
        max_length=32,
        choices=CloseReason.choices,
        null=True,
        blank=True,
    )
    workflow_state = models.CharField(
        max_length=32,
        choices=WorkflowState.choices,
        default=WorkflowState.AWAITING_SOURCE,
    )
    ux_lane = models.CharField(
        max_length=16,
        blank=True,
        default="",
        help_text="instant | delayed — drives public UX mapping only.",
    )
    deadline_at = models.DateTimeField(null=True, blank=True)
    lease_holder = models.CharField(max_length=64, blank=True, default="")
    lease_until = models.DateTimeField(null=True, blank=True)
    checkpoint_seq = models.PositiveIntegerField(default=0)
    last_completed_step = models.CharField(max_length=64, blank=True, default="")
    saga_status = models.CharField(
        max_length=20,
        choices=SagaStatus.choices,
        default=SagaStatus.IDLE,
    )
    fulfillment_committed_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["deadline_at", "lifecycle_stage"]),
            models.Index(fields=["destination_jeweller", "workflow_state"]),
            models.Index(fields=["source_jeweller", "workflow_state"]),
        ]

    def __str__(self):
        ref = self.public_reference or f"#{self.pk}"
        return f"CrossRedemptionRequest({ref}, {self.lifecycle_stage})"


class CrossRedemptionApprovalOtp(models.Model):
    """One active OTP per cross-redemption request for manual source approval."""

    request = models.OneToOneField(
        CrossRedemptionRequest,
        on_delete=models.CASCADE,
        related_name="source_approval_otp",
    )
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Cross-redemption source approval OTP"


class CrossRedemptionEvent(models.Model):
    """Append-only audit log for cross-redemption."""

    class Actor(models.TextChoices):
        USER = "user", "User"
        JEWELLER_SOURCE = "jeweller_source", "Jeweller source"
        JEWELLER_DEST = "jeweller_dest", "Jeweller destination"
        SYSTEM = "system", "System"
        ADMIN = "admin", "Admin"

    request = models.ForeignKey(
        CrossRedemptionRequest,
        on_delete=models.CASCADE,
        related_name="events",
    )
    actor = models.CharField(max_length=20, choices=Actor.choices)
    event_type = models.CharField(max_length=64)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"CrossRedemptionEvent({self.request_id}, {self.event_type})"


class ExposureReservation(models.Model):
    """Time-bounded exposure hold (reversible); grams are NOT moved while ACTIVE."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        RELEASED = "released", "Released"
        CONSUMED = "consumed", "Consumed"

    request = models.OneToOneField(
        CrossRedemptionRequest,
        on_delete=models.CASCADE,
        related_name="exposure_reservation",
    )
    source_jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="cross_exposure_reservations_as_source",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    destination_jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="cross_exposure_reservations_as_dest",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    reserved_value_inr = models.DecimalField(max_digits=18, decimal_places=2)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ExposureReservation(r={self.request_id}, {self.status})"


class CrossRedemptionSagaStep(models.Model):
    """Idempotent saga step log (forward / compensation)."""

    class Direction(models.TextChoices):
        FWD = "fwd", "Forward"
        REV = "rev", "Reverse"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"
        SKIPPED = "skipped", "Skipped"

    request = models.ForeignKey(
        CrossRedemptionRequest,
        on_delete=models.CASCADE,
        related_name="saga_steps",
    )
    step_name = models.CharField(max_length=64)
    direction = models.CharField(max_length=8, choices=Direction.choices)
    idempotency_key = models.CharField(max_length=128, unique=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    error_detail = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"SagaStep({self.request_id}, {self.step_name}, {self.direction})"


class IntegrationOutbox(models.Model):
    """Out-of-band side effects; never call HTTP inside DB transactions."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PROCESSING = "processing", "Processing"
        DONE = "done", "Done"
        FAILED = "failed", "Failed"

    idempotency_key = models.CharField(max_length=128, unique=True)
    message_type = models.CharField(max_length=64)
    payload = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    available_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"Outbox({self.message_type}, {self.status})"


class SettlementBatch(models.Model):
    """MVP batch marker (no payment gateway)."""

    summary = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"SettlementBatch({self.pk})"


class SettlementObligation(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        SETTLED = "settled", "Settled"
        FAILED = "failed", "Failed"

    from_jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="settlement_obligations_from",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    to_jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="settlement_obligations_to",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    amount_inr = models.DecimalField(max_digits=18, decimal_places=2)
    grams_equivalent = models.DecimalField(max_digits=16, decimal_places=6)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
    )
    batch = models.ForeignKey(
        SettlementBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="obligations",
    )
    linked_requests = models.ManyToManyField(
        CrossRedemptionRequest,
        related_name="settlement_obligations",
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "from_jeweller"]),
        ]

    def __str__(self):
        return f"SettlementObligation({self.from_jeweller_id}→{self.to_jeweller_id}, {self.status})"


class WebPushSubscription(models.Model):
    """Browser Web Push subscription (VAPID); one row per push endpoint."""

    user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="web_push_subscriptions",
    )
    endpoint = models.TextField(unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=512, blank=True, default="")
    preferred_locale = models.CharField(max_length=8, blank=True, default="en")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return "WebPushSubscription(anonymous)" if self.user_id is None else f"WebPushSubscription(user={self.user_id})"


class NativePushToken(models.Model):
    """FCM/APNs device token for Capacitor native apps."""

    PLATFORM_ANDROID = "android"
    PLATFORM_IOS = "ios"
    PLATFORM_CHOICES = [
        (PLATFORM_ANDROID, "Android"),
        (PLATFORM_IOS, "iOS"),
    ]

    user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="native_push_tokens",
    )
    platform = models.CharField(max_length=16, choices=PLATFORM_CHOICES)
    token = models.TextField(unique=True)
    user_agent = models.CharField(max_length=512, blank=True, default="")
    preferred_locale = models.CharField(max_length=8, blank=True, default="en")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"NativePushToken({self.platform}, user={self.user_id})"


class AdminNotification(models.Model):
    """In-app admin feed + source for push metadata (KYC/KYB review prompts)."""

    KIND_KYC_UPLOAD = "kyc_upload"
    KIND_KYB_UPLOAD = "kyb_upload"
    KIND_FESTIVAL_BROADCAST_SENT = "festival_broadcast_sent"
    KIND_CHOICES = [
        (KIND_KYC_UPLOAD, "Customer KYC upload"),
        (KIND_KYB_UPLOAD, "Jeweller KYB upload"),
        (KIND_FESTIVAL_BROADCAST_SENT, "Festival broadcast sent"),
    ]

    kind = models.CharField(max_length=32, choices=KIND_CHOICES)
    title = models.CharField(max_length=180)
    body = models.TextField()
    link_path = models.CharField(max_length=512)
    actor = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"AdminNotification({self.kind}, {self.created_at})"


class AdminNotificationRead(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="+")
    notification = models.ForeignKey(
        AdminNotification, on_delete=models.CASCADE, related_name="reads"
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "notification"], name="uniq_admin_notification_read"
            ),
        ]


class FestivalBroadcastNotification(models.Model):
    """Admin-scheduled Web Push broadcast (e.g. festival message) to all subscribed devices."""

    TARGET_ALL_USERS = "ALL_USERS"
    TARGET_ALL_APP_INSTALLS = "ALL_APP_INSTALLS"
    TARGET_SPECIFIC_JEWELLER_USERS = "SPECIFIC_JEWELLER_USERS"
    TARGET_DEFAULT_JEWELLER_USERS = "DEFAULT_JEWELLER_USERS"
    TARGET_SPECIFIC_USERS = "SPECIFIC_USERS"
    TARGET_CHOICES = [
        (TARGET_ALL_USERS, "All customers"),
        (TARGET_ALL_APP_INSTALLS, "All app installs"),
        (TARGET_SPECIFIC_JEWELLER_USERS, "Jeweller customers"),
        (TARGET_DEFAULT_JEWELLER_USERS, "Default jeweller customers"),
        (TARGET_SPECIFIC_USERS, "Specific users"),
    ]

    STATUS_PENDING = "pending"
    STATUS_SENT = "sent"
    STATUS_CANCELLED = "cancelled"
    STATUS_FAILED = "failed"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_SENT, "Sent"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_FAILED, "Failed"),
    ]

    title = models.CharField(
        max_length=120,
        default="Cridora",
        help_text="Notification title shown on the device.",
    )
    body = models.TextField(help_text="Main message body.")
    image_url = models.URLField(
        max_length=512,
        blank=True,
        default="",
        help_text="Optional HTTPS image shown in the push notification.",
    )
    scheduled_at = models.DateTimeField(
        db_index=True,
        help_text="When to send (UTC in DB; use aware datetimes from the API).",
    )
    expires_at = models.DateTimeField(null=True, blank=True)
    target_type = models.CharField(
        max_length=32,
        choices=TARGET_CHOICES,
        default=TARGET_ALL_USERS,
    )
    target_metadata = models.JSONField(default=dict, blank=True)
    logo_url = models.URLField(max_length=512, blank=True, default="")
    created_by_jeweller = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="jeweller_campaign_broadcasts",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )
    sent_at = models.DateTimeField(null=True, blank=True)
    push_recipient_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Number of push endpoints successfully targeted when sent.",
    )
    error_message = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="festival_broadcasts_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"FestivalBroadcast({self.scheduled_at}, {self.status})"


class PersonalGoldHolding(models.Model):
    """Off-vault physical gold tracking & records — MVP: not transferable / redeemable / loanable."""

    PERSONAL = "personal"
    HOLDING_TYPE_CHOICES = [(PERSONAL, "Personal")]

    CATEGORY_ORNAMENT = "ornament"
    CATEGORY_COIN = "coin"
    CATEGORY_BAR = "bar"
    CATEGORY_OTHER = "other"
    CATEGORY_CHOICES = [
        (CATEGORY_ORNAMENT, "Ornament"),
        (CATEGORY_COIN, "Coin"),
        (CATEGORY_BAR, "Bar"),
        (CATEGORY_OTHER, "Other"),
    ]

    SELF_DECLARED = "self_declared"
    JEWELLER_ADDED = "jeweller_added"
    VERIFIED = "verified"
    VERIFICATION_STATUS_CHOICES = [
        (SELF_DECLARED, "Self declared"),
        (JEWELLER_ADDED, "Jeweller added"),
        (VERIFIED, "Verified"),
    ]

    CREATED_BY_USER = "user"
    CREATED_BY_JEWELLER = "jeweller"
    CREATED_BY_ADMIN = "admin"
    CREATED_BY_TYPE_CHOICES = [
        (CREATED_BY_USER, "User"),
        (CREATED_BY_JEWELLER, "Jeweller"),
        (CREATED_BY_ADMIN, "Admin"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="personal_gold_holdings",
        limit_choices_to={"user_type": User.CUSTOMER},
    )
    jeweller = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="personal_holdings_added_for_customers",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    holding_type = models.CharField(
        max_length=24,
        choices=HOLDING_TYPE_CHOICES,
        default=PERSONAL,
    )
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=24, choices=CATEGORY_CHOICES)
    weight_grams = models.DecimalField(
        max_digits=16,
        decimal_places=6,
        validators=[MinValueValidator(Decimal("0.000001"))],
    )
    purity = models.CharField(max_length=64, default="BIS 916")
    purchase_date = models.DateField(null=True, blank=True)
    purchase_source = models.CharField(max_length=512, blank=True)
    purchase_price_inr_per_gram = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Optional: what you paid per gram (₹/g) — used for indicative gain vs reference mark.",
    )
    estimated_current_value_inr = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=0,
        help_text="Snapshot at last save: reference 22K ₹/g × weight (MVP).",
    )
    is_self_declared = models.BooleanField(default=True)
    verification_status = models.CharField(
        max_length=24,
        choices=VERIFICATION_STATUS_CHOICES,
        default=SELF_DECLARED,
    )
    created_by_type = models.CharField(max_length=16, choices=CREATED_BY_TYPE_CHOICES)
    created_by_id = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    is_removed = models.BooleanField(default=False, db_index=True)
    removed_at = models.DateTimeField(null=True, blank=True)
    removed_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="personal_holdings_removed",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["user", "is_removed"]),
        ]

    def __str__(self):
        return f"PersonalGoldHolding({self.user_id}, {self.title})"


class PersonalHoldingDocument(models.Model):
    PURCHASE_INVOICE = "purchase_invoice"
    GOLD_CERTIFICATE = "gold_certificate"
    PURITY_CERTIFICATE = "purity_certificate"
    VALUATION_DOCUMENT = "valuation_document"
    WARRANTY_CARD = "warranty_card"
    PRODUCT_IMAGE = "product_image"
    OTHER = "other"
    DOCUMENT_TYPE_CHOICES = [
        (PURCHASE_INVOICE, "Purchase invoice"),
        (GOLD_CERTIFICATE, "Gold certificate"),
        (PURITY_CERTIFICATE, "Purity certificate"),
        (VALUATION_DOCUMENT, "Valuation document"),
        (WARRANTY_CARD, "Warranty card"),
        (PRODUCT_IMAGE, "Product image"),
        (OTHER, "Other"),
    ]

    UPLOADED_BY_USER = "user"
    UPLOADED_BY_JEWELLER = "jeweller"
    UPLOADED_BY_ADMIN = "admin"
    UPLOADED_BY_TYPE_CHOICES = [
        (UPLOADED_BY_USER, "User"),
        (UPLOADED_BY_JEWELLER, "Jeweller"),
        (UPLOADED_BY_ADMIN, "Admin"),
    ]

    holding = models.ForeignKey(
        PersonalGoldHolding,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    document_type = models.CharField(max_length=32, choices=DOCUMENT_TYPE_CHOICES)
    file = models.FileField(upload_to="personal_holding_docs/%Y/%m/")
    original_filename = models.CharField(max_length=255, blank=True)
    uploaded_by_type = models.CharField(max_length=16, choices=UPLOADED_BY_TYPE_CHOICES)
    uploaded_by_id = models.PositiveIntegerField(null=True, blank=True)
    invoice_number = models.CharField(max_length=120, blank=True)
    document_title = models.CharField(max_length=255, blank=True)
    remarks = models.TextField(blank=True)
    is_removed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"PersonalHoldingDocument({self.holding_id}, {self.document_type})"


class PersonalPortfolioAuditLog(models.Model):
    ACTION_CREATE_HOLDING = "holding_create"
    ACTION_UPDATE_HOLDING = "holding_update"
    ACTION_DELETE_HOLDING = "holding_delete"
    ACTION_UPLOAD_DOCUMENT = "document_upload"
    ACTION_DELETE_DOCUMENT = "document_delete"
    ACTION_JEWELLER_ADD = "jeweller_add"
    ACTION_ADMIN_REMOVE = "admin_remove"
    ACTION_VERIFICATION_CHANGE = "verification_change"
    ACTION_CHOICES = [
        (ACTION_CREATE_HOLDING, "Holding created"),
        (ACTION_UPDATE_HOLDING, "Holding updated"),
        (ACTION_DELETE_HOLDING, "Holding deleted"),
        (ACTION_UPLOAD_DOCUMENT, "Document uploaded"),
        (ACTION_DELETE_DOCUMENT, "Document deleted"),
        (ACTION_JEWELLER_ADD, "Jeweller added holding"),
        (ACTION_ADMIN_REMOVE, "Admin removed"),
        (ACTION_VERIFICATION_CHANGE, "Verification changed"),
    ]

    subject_user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="personal_portfolio_audit_logs",
    )
    holding = models.ForeignKey(
        PersonalGoldHolding,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
    )
    document = models.ForeignKey(
        PersonalHoldingDocument,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
    )
    actor_type = models.CharField(max_length=16, blank=True)
    actor_id = models.PositiveIntegerField(null=True, blank=True)
    action = models.CharField(max_length=32, choices=ACTION_CHOICES)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"PersonalPortfolioAuditLog({self.action}, u={self.subject_user_id})"


class PortfolioUserNotification(models.Model):
    KIND_HOLDING_ADDED = "holding_added"
    KIND_JEWELLER_ADDED_HOLDING = "jeweller_added_holding"
    KIND_DOCUMENT_UPLOADED = "document_uploaded"
    KIND_VERIFICATION_UPDATED = "verification_updated"
    KIND_FRACTIONAL = "fractional"
    KIND_DEPOSIT = "deposit"
    KIND_SELLBACK = "sellback"
    KIND_LOAN = "loan"
    KIND_CORRIDORAPAY = "corridorapay"
    KIND_CROSS_REDEMPTION = "cross_redemption"
    KIND_OTP = "otp"
    KIND_SYSTEM = "system"
    KIND_CHOICES = [
        (KIND_HOLDING_ADDED, "Holding added"),
        (KIND_JEWELLER_ADDED_HOLDING, "Jeweller added holding"),
        (KIND_DOCUMENT_UPLOADED, "Document uploaded"),
        (KIND_VERIFICATION_UPDATED, "Verification updated"),
        (KIND_FRACTIONAL, "Fractional gold"),
        (KIND_DEPOSIT, "Gold deposit"),
        (KIND_SELLBACK, "Sellback"),
        (KIND_LOAN, "Loan"),
        (KIND_CORRIDORAPAY, "CridoraPay"),
        (KIND_CROSS_REDEMPTION, "Cross redemption"),
        (KIND_OTP, "OTP workflow"),
        (KIND_SYSTEM, "System"),
    ]

    CATEGORY_TRANSACTION = "transaction"
    CATEGORY_PORTFOLIO = "portfolio"
    CATEGORY_SECURITY = "security"
    CATEGORY_PROMO = "promo"
    CATEGORY_LOAN = "loan"
    CATEGORY_SYSTEM = "system"
    CATEGORY_CHOICES = [
        (CATEGORY_TRANSACTION, "Transaction"),
        (CATEGORY_PORTFOLIO, "Portfolio"),
        (CATEGORY_SECURITY, "Security"),
        (CATEGORY_PROMO, "Promo"),
        (CATEGORY_LOAN, "Loan"),
        (CATEGORY_SYSTEM, "System"),
    ]

    PRIORITY_HIGH = "high"
    PRIORITY_MEDIUM = "medium"
    PRIORITY_LOW = "low"
    PRIORITY_CHOICES = [
        (PRIORITY_HIGH, "High"),
        (PRIORITY_MEDIUM, "Medium"),
        (PRIORITY_LOW, "Low"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="portfolio_notifications",
    )
    kind = models.CharField(max_length=32, choices=KIND_CHOICES)
    category = models.CharField(
        max_length=24,
        choices=CATEGORY_CHOICES,
        default=CATEGORY_PORTFOLIO,
    )
    priority = models.CharField(
        max_length=16,
        choices=PRIORITY_CHOICES,
        default=PRIORITY_MEDIUM,
    )
    notification_type = models.CharField(max_length=32, blank=True, default="")
    title = models.CharField(max_length=180)
    body = models.TextField()
    link_path = models.CharField(max_length=512, blank=True)
    jeweller = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        limit_choices_to={"user_type": User.JEWELLER},
    )
    image_url = models.URLField(max_length=512, blank=True, default="")
    logo_url = models.URLField(max_length=512, blank=True, default="")
    read_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "read_at"])]

    def __str__(self):
        return f"PortfolioUserNotification({self.kind}, {self.user_id})"


class NotificationTemplate(models.Model):
    """Reusable notification copy for admin campaigns."""

    name = models.CharField(max_length=120, unique=True)
    category = models.CharField(max_length=24, default="promo")
    tone = models.CharField(max_length=24, blank=True, default="")
    title_template = models.CharField(max_length=180)
    body_template = models.TextField()
    variables = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class NotificationEventLog(models.Model):
    """Append-only delivery/click analytics (survives inbox delete-on-read)."""

    EVENT_DELIVERED = "delivered"
    EVENT_CLICKED = "clicked"
    EVENT_CHOICES = [
        (EVENT_DELIVERED, "Delivered"),
        (EVENT_CLICKED, "Clicked"),
    ]

    user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notification_events",
    )
    event_type = models.CharField(max_length=16, choices=EVENT_CHOICES)
    category = models.CharField(max_length=24, blank=True, default="")
    kind = models.CharField(max_length=32, blank=True, default="")
    title = models.CharField(max_length=180, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["event_type", "created_at"]),
            models.Index(fields=["user", "event_type"]),
        ]


class NotificationPreference(models.Model):
    """Per-user notification delivery preferences."""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="notification_preference",
    )
    allow_promotional = models.BooleanField(default=True)
    allow_gold_alerts = models.BooleanField(default=True)
    allow_portfolio_alerts = models.BooleanField(default=True)
    allow_jeweller_campaigns = models.BooleanField(default=True)
    allow_festival_alerts = models.BooleanField(default=True)
    allow_push_notifications = models.BooleanField(default=True)
    allow_sound = models.BooleanField(default=True)
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"NotificationPreference(user={self.user_id})"


class UpiPaymentProofSubmission(models.Model):
    """Audit trail for UTR / screenshot proof on any fiat UPI payment."""

    PROOF_UTR = "utr"
    PROOF_SCREENSHOT = "screenshot"
    PROOF_CHOICES = [
        (PROOF_UTR, "UTR"),
        (PROOF_SCREENSHOT, "Screenshot"),
    ]

    content_type = models.ForeignKey(
        "contenttypes.ContentType",
        on_delete=models.CASCADE,
    )
    object_id = models.PositiveIntegerField()
    proof_kind = models.CharField(max_length=16, choices=PROOF_CHOICES)
    utr = models.CharField(max_length=32, blank=True)
    proof_file = models.FileField(upload_to="upi_proofs/%Y/%m/", blank=True)
    submitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="upi_proof_submissions",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    rejection_remark = models.TextField(blank=True)

    class Meta:
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
        ]

    def __str__(self):
        return f"UpiPaymentProofSubmission({self.content_type_id}:{self.object_id}, {self.proof_kind})"


class UpiFraudReport(models.Model):
    """Jeweller/customer fraud reports surfaced in admin treasury."""

    STATUS_OPEN = "open"
    STATUS_REVIEWED = "reviewed"
    STATUS_CHOICES = [
        (STATUS_OPEN, "Open"),
        (STATUS_REVIEWED, "Reviewed"),
    ]

    content_type = models.ForeignKey(
        "contenttypes.ContentType",
        on_delete=models.CASCADE,
    )
    object_id = models.PositiveIntegerField()
    reported_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="upi_fraud_reports_filed",
    )
    note = models.TextField()
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_OPEN,
    )
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="upi_fraud_reports_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["content_type", "object_id"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return f"UpiFraudReport({self.content_type_id}:{self.object_id}, {self.status})"
