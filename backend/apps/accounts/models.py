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
    gold_upi = models.CharField(
        max_length=130,
        unique=True,
        null=True,
        blank=True,
        help_text="Normalized GoldUPI username@jewellercode (lowercase).",
    )
    jeweller_code = models.CharField(
        max_length=40,
        blank=True,
        help_text="Public storefront slug for KYB-verified jewellers (GoldUPI suffix).",
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
    """Customer gold held with a specific custodian jeweller (vault ID: handle.jewellercode@cridora)."""

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
        help_text="Public routing ID, e.g. rahul4821.goldhousekochi@cridora",
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
    HOLDING_TYPE_CHOICES = [
        (FRACTIONAL, "Fractional gold"),
        (DEPOSIT, "Gold deposit"),
        (GOLDEN_SCHEME, "Golden scheme"),
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
    AWAITING_COUNTER = "awaiting_counter"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

    STATUS_CHOICES = [
        (PENDING_PAYMENT, "Pending payment"),
        (AWAITING_COUNTER, "Awaiting counter confirmation"),
        (COMPLETED, "Completed"),
        (CANCELLED, "Cancelled"),
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
        max_length=24, choices=STATUS_CHOICES, default=PENDING_PAYMENT
    )
    jeweller_verified_at = models.DateTimeField(null=True, blank=True)
    customer_note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"FractionalGoldPurchase({self.customer_id}, {self.grams}g, {self.status})"


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


class PlatformOperationalSettings(models.Model):
    """Singleton (pk=1): runtime operational limits configurable without redeploy."""

    fractional_counter_otp_ttl_seconds = models.PositiveIntegerField(
        default=900,
        validators=[MinValueValidator(60), MaxValueValidator(86400)],
        help_text="Counter fractional OTP validity window (60–86400 seconds).",
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
    """Audit row: liability increased when customer fractional grams are credited at this jeweller."""

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
    fractional_purchase = models.ForeignKey(
        FractionalGoldPurchase,
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


class WebPushSubscription(models.Model):
    """Browser Web Push subscription (VAPID); one row per push endpoint."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="web_push_subscriptions",
    )
    endpoint = models.TextField(unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    user_agent = models.CharField(max_length=512, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"WebPushSubscription(user={self.user_id})"


class AdminNotification(models.Model):
    """In-app admin feed + source for push metadata (KYC/KYB review prompts)."""

    KIND_KYC_UPLOAD = "kyc_upload"
    KIND_KYB_UPLOAD = "kyb_upload"
    KIND_CHOICES = [
        (KIND_KYC_UPLOAD, "Customer KYC upload"),
        (KIND_KYB_UPLOAD, "Jeweller KYB upload"),
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
