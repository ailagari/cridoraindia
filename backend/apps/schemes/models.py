"""Investment scheme domain models."""

from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

User = settings.AUTH_USER_MODEL


class SchemeTemplate(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_PUBLISHED = "published"
    STATUS_DEPRECATED = "deprecated"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PUBLISHED, "Published"),
        (STATUS_DEPRECATED, "Deprecated"),
    ]

    slug = models.SlugField(max_length=80, unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=80, blank=True, default="general")
    icon_key = models.CharField(max_length=40, blank=True, default="scheme")
    sort_order = models.PositiveIntegerField(default=0)

    scheme_design = models.JSONField(default=dict, blank=True)
    scheme_rules = models.JSONField(default=dict, blank=True)
    flow_summary = models.CharField(max_length=500, blank=True)

    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT, db_index=True
    )
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="published_scheme_templates",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return f"SchemeTemplate({self.slug}, {self.status})"


class SchemeRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_NEEDS_INFO = "needs_info"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
        (STATUS_NEEDS_INFO, "Needs info"),
    ]

    jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="scheme_requests",
        limit_choices_to={"user_type": "jeweller"},
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    proposed_terms = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True
    )
    admin_reviewer = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_scheme_requests",
    )
    admin_notes = models.TextField(blank=True)
    resulting_template = models.ForeignKey(
        SchemeTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="from_requests",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]


class JewellerSchemeOffering(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_PAUSED = "paused"
    STATUS_WITHDRAWN = "withdrawn"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_PAUSED, "Paused"),
        (STATUS_WITHDRAWN, "Withdrawn"),
    ]

    jeweller = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="scheme_offerings",
        limit_choices_to={"user_type": "jeweller"},
    )
    scheme_template = models.ForeignKey(
        SchemeTemplate,
        on_delete=models.PROTECT,
        related_name="jeweller_offerings",
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE, db_index=True
    )
    display_name = models.CharField(max_length=200, blank=True)
    customer_facing_note = models.TextField(blank=True)
    jeweller_overrides = models.JSONField(default=dict, blank=True)
    design_snapshot = models.JSONField(default=dict, blank=True)
    rules_snapshot = models.JSONField(default=dict, blank=True)
    enrolled_at = models.DateTimeField(auto_now_add=True)
    paused_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-enrolled_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["jeweller", "scheme_template"],
                name="uniq_jeweller_scheme_template_offering",
            )
        ]

    def __str__(self) -> str:
        return f"JewellerSchemeOffering(j={self.jeweller_id}, t={self.scheme_template_id})"


class CustomerSchemeEnrollment(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_PENDING_ADMISSION = "pending_admission"
    STATUS_PLAN_MONTH_COMPLETE = "plan_month_complete"
    STATUS_REDEEMED = "redeemed"
    STATUS_CANCELLED = "cancelled"
    STATUS_DEFAULTED = "defaulted"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_PENDING_ADMISSION, "Pending admission"),
        (STATUS_PLAN_MONTH_COMPLETE, "Plan month complete"),
        (STATUS_REDEEMED, "Redeemed"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_DEFAULTED, "Defaulted"),
    ]

    customer = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="scheme_enrollments",
        limit_choices_to={"user_type": "customer"},
    )
    offering = models.ForeignKey(
        JewellerSchemeOffering,
        on_delete=models.PROTECT,
        related_name="enrollments",
    )
    status = models.CharField(
        max_length=32, choices=STATUS_CHOICES, default=STATUS_ACTIVE, db_index=True
    )
    current_cycle_number = models.PositiveIntegerField(default=1)
    current_plan_month = models.PositiveSmallIntegerField(default=1)
    cycle_anchor_date = models.DateField()
    design_snapshot = models.JSONField(default=dict, blank=True)
    rules_snapshot = models.JSONField(default=dict, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    payments_enabled = models.BooleanField(default=False, db_index=True)
    admitted_at = models.DateTimeField(null=True, blank=True)
    admitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admitted_scheme_enrollments",
        limit_choices_to={"user_type": "jeweller"},
    )

    class Meta:
        ordering = ["-started_at"]

    @property
    def jeweller(self):
        return self.offering.jeweller


class SchemeMonthBucket(models.Model):
    enrollment = models.ForeignKey(
        CustomerSchemeEnrollment,
        on_delete=models.CASCADE,
        related_name="month_buckets",
    )
    cycle_number = models.PositiveIntegerField(default=1)
    month_index = models.PositiveSmallIntegerField()
    calendar_month = models.CharField(max_length=7, help_text="YYYY-MM")
    monthly_total_inr = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0")
    )
    monthly_total_grams = models.DecimalField(
        max_digits=16, decimal_places=6, default=Decimal("0")
    )
    deposit_count = models.PositiveIntegerField(default=0)
    is_customer_month = models.BooleanField(default=True)
    is_bonus_month = models.BooleanField(default=False)
    bonus_computed_inr = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["cycle_number", "month_index"]
        constraints = [
            models.UniqueConstraint(
                fields=["enrollment", "cycle_number", "calendar_month"],
                name="uniq_enrollment_cycle_calendar_month",
            )
        ]


class SchemeContribution(models.Model):
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
        (PROOF_REJECTED, "Proof rejected"),
        (ON_HOLD, "On hold"),
    ]

    PAY_UPI = "upi"
    PAY_COUNTER = "counter"
    PAYMENT_CHOICES = [(PAY_UPI, "UPI"), (PAY_COUNTER, "Pay at counter")]

    enrollment = models.ForeignKey(
        CustomerSchemeEnrollment,
        on_delete=models.CASCADE,
        related_name="contributions",
    )
    month_bucket = models.ForeignKey(
        SchemeMonthBucket,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="contributions",
    )
    cycle_number = models.PositiveIntegerField(default=1)
    calendar_month = models.CharField(max_length=7)
    deposit_sequence_in_month = models.PositiveSmallIntegerField(default=1)

    amount_inr = models.DecimalField(max_digits=14, decimal_places=2)
    gold_grams = models.DecimalField(max_digits=16, decimal_places=6, default=Decimal("0"))
    gold_value_inr_pre_gst = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0")
    )
    gst_percent = models.DecimalField(max_digits=6, decimal_places=3, default=Decimal("3"))
    gst_inr = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    making_charge_inr = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0")
    )
    metal_rate_inr_per_gram = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0")
    )
    payment_method = models.CharField(max_length=16, choices=PAYMENT_CHOICES)
    status = models.CharField(
        max_length=32, choices=STATUS_CHOICES, default=PENDING_PAYMENT
    )
    customer_note = models.CharField(max_length=255, blank=True)
    payee_upi_vpa = models.CharField(max_length=128, blank=True)
    payment_note = models.CharField(max_length=128, blank=True)
    payment_expires_at = models.DateTimeField(null=True, blank=True)
    upi_utr = models.CharField(max_length=32, null=True, blank=True, unique=True)
    utr_submitted_at = models.DateTimeField(null=True, blank=True)
    reconciliation_score = models.PositiveSmallIntegerField(null=True, blank=True)
    reconciliation_flags = models.JSONField(default=dict, blank=True)
    reconciled_at = models.DateTimeField(null=True, blank=True)
    confirmed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scheme_contributions_confirmed",
    )
    jeweller_verified_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def order_reference(self) -> str:
        return f"SC-{self.pk}"

    @property
    def jeweller(self):
        return self.enrollment.offering.jeweller

    @property
    def customer(self):
        return self.enrollment.customer


class SchemeContributionCounterOtp(models.Model):
    contribution = models.OneToOneField(
        SchemeContribution,
        on_delete=models.CASCADE,
        related_name="counter_otp",
    )
    otp_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)


class SchemeLedgerEntry(models.Model):
    KIND_CONTRIBUTION_INR = "contribution_inr"
    KIND_CONTRIBUTION_GOLD = "contribution_gold"
    KIND_JEWELLER_BONUS_INR = "jeweller_bonus_inr"
    KIND_JEWELLER_BONUS_GOLD = "jeweller_bonus_gold"
    KIND_MC_CREDIT = "making_charge_credit_inr"
    KIND_MC_APPLIED = "making_charge_credit_applied"
    KIND_REDEMPTION_DEBIT_INR = "redemption_debit_inr"
    KIND_REDEMPTION_DEBIT_GOLD = "redemption_debit_gold"
    KIND_MONTH_BUCKET_CLOSE = "month_bucket_close"
    KIND_CYCLE_ROLLOVER = "cycle_rollover"
    KIND_CHOICES = [
        (KIND_CONTRIBUTION_INR, "Contribution INR"),
        (KIND_CONTRIBUTION_GOLD, "Contribution gold"),
        (KIND_JEWELLER_BONUS_INR, "Jeweller bonus INR"),
        (KIND_JEWELLER_BONUS_GOLD, "Jeweller bonus gold"),
        (KIND_MC_CREDIT, "Making charge credit"),
        (KIND_MC_APPLIED, "MC credit applied"),
        (KIND_REDEMPTION_DEBIT_INR, "Redemption debit INR"),
        (KIND_REDEMPTION_DEBIT_GOLD, "Redemption debit gold"),
        (KIND_MONTH_BUCKET_CLOSE, "Month bucket close"),
        (KIND_CYCLE_ROLLOVER, "Cycle rollover"),
    ]

    enrollment = models.ForeignKey(
        CustomerSchemeEnrollment,
        on_delete=models.CASCADE,
        related_name="ledger_entries",
    )
    cycle_number = models.PositiveIntegerField(default=1)
    entry_kind = models.CharField(max_length=40, choices=KIND_CHOICES)
    amount_inr = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0")
    )
    gold_grams = models.DecimalField(
        max_digits=16, decimal_places=6, default=Decimal("0")
    )
    contribution = models.ForeignKey(
        SchemeContribution,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )
    month_bucket = models.ForeignKey(
        SchemeMonthBucket,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]


class SchemeCycleBonus(models.Model):
    STATUS_PENDING = "pending"
    STATUS_CONFIRMED = "confirmed"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending jeweller confirmation"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    enrollment = models.ForeignKey(
        CustomerSchemeEnrollment,
        on_delete=models.CASCADE,
        related_name="cycle_bonuses",
    )
    cycle_number = models.PositiveIntegerField()
    bonus_month_index = models.PositiveSmallIntegerField()
    amount_inr = models.DecimalField(max_digits=14, decimal_places=2)
    gold_grams = models.DecimalField(max_digits=16, decimal_places=6, default=Decimal("0"))
    credit_as = models.CharField(max_length=32, default="cash_pool")
    calculation_snapshot = models.JSONField(default=dict, blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    confirmed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="confirmed_scheme_bonuses",
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["enrollment", "cycle_number"],
                name="uniq_enrollment_cycle_bonus",
            )
        ]


class SchemeRedemption(models.Model):
    STATUS_PENDING = "pending"
    STATUS_OTP_ISSUED = "otp_issued"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_OTP_ISSUED, "OTP issued"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
    ]

    enrollment = models.ForeignKey(
        CustomerSchemeEnrollment,
        on_delete=models.CASCADE,
        related_name="redemptions",
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    redeem_as = models.CharField(max_length=40, default="jewellery_cash_pool")
    amount_inr_from_pool = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0")
    )
    gold_grams_debited = models.DecimalField(
        max_digits=16, decimal_places=6, default=Decimal("0")
    )
    making_charge_inr = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0")
    )
    mc_credit_applied_inr = models.DecimalField(
        max_digits=14, decimal_places=2, default=Decimal("0")
    )
    topup_inr = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    quote_snapshot = models.JSONField(default=dict, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
