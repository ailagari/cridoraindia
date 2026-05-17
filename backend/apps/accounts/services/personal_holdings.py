"""Personal gold holdings — reference pricing, wallet aggregates, validation."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.db.models import Case, Count, DecimalField, F, Q, Sum, When
from django.db.models.functions import Coalesce

from apps.accounts.models import PersonalGoldHolding, VaultHolding
from apps.marketplace.spot_prices import resolve_cridora_base_22k_inr

User = get_user_model()

ALLOWED_DOCUMENT_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}


def calculate_holding_value_inr(weight_grams: Decimal, reference_inr_per_gram_22k: Decimal) -> Decimal:
    """MVP: ornamental weight at published 22K reference ₹/g (BIS 916 default on holdings)."""
    if weight_grams <= 0:
        return Decimal("0")
    return (weight_grams * reference_inr_per_gram_22k).quantize(Decimal("0.01"))


def reference_gold_rate_inr_per_gram() -> tuple[Decimal, str]:
    """Platform reference 22K ₹/g for personal holdings mark."""
    base, src = resolve_cridora_base_22k_inr()
    return base, src


def customer_personal_holdings_qs(user: User):
    return PersonalGoldHolding.objects.filter(user=user, is_removed=False).annotate(
        document_count=Count(
            "documents",
            filter=Q(documents__is_removed=False),
        )
    )


def customer_vault_grams_by_holding_type(user: User) -> dict[str, Decimal]:
    if user.user_type != User.CUSTOMER:
        return {}
    rows = (
        VaultHolding.objects.filter(vault__owner=user)
        .values("holding_type")
        .annotate(t=Coalesce(Sum("balance_grams"), Decimal("0"), output_field=DecimalField()))
    )
    out: dict[str, Decimal] = {}
    for r in rows:
        out[str(r["holding_type"])] = r["t"] or Decimal("0")
    return out


def customer_portfolio_totals_payload(user: User) -> dict[str, Any]:
    """Aggregated grams and INR for dashboard cards (no N+1)."""
    if user.user_type != User.CUSTOMER:
        return {}

    rate, rate_source = reference_gold_rate_inr_per_gram()
    by_type = customer_vault_grams_by_holding_type(user)
    frac_g = by_type.get(VaultHolding.FRACTIONAL, Decimal("0"))
    dep_g = by_type.get(VaultHolding.DEPOSIT, Decimal("0"))
    scheme_g = by_type.get(VaultHolding.GOLDEN_SCHEME, Decimal("0"))
    cridora_active_g = frac_g + dep_g + scheme_g

    pers = PersonalGoldHolding.objects.filter(user=user, is_removed=False).aggregate(
        g=Coalesce(Sum("weight_grams"), Decimal("0")),
    )
    personal_g = pers["g"] or Decimal("0")
    ref_personal_inr = calculate_holding_value_inr(personal_g, rate)

    recorded_basis = PersonalGoldHolding.objects.filter(user=user, is_removed=False).aggregate(
        b=Coalesce(
            Sum(
                Case(
                    When(
                        purchase_price_inr_per_gram__isnull=False,
                        then=F("weight_grams") * F("purchase_price_inr_per_gram"),
                    ),
                    default=Decimal("0"),
                    output_field=DecimalField(max_digits=24, decimal_places=6),
                )
            ),
            Decimal("0"),
        ),
    )["b"] or Decimal("0")
    recorded_basis = recorded_basis.quantize(Decimal("0.01"))
    personal_gain_inr_s = ""
    personal_gain_pct_s = ""
    if recorded_basis > 0:
        pg = (ref_personal_inr - recorded_basis).quantize(Decimal("0.01"))
        personal_gain_inr_s = str(pg)
        personal_gain_pct_s = str(
            ((ref_personal_inr - recorded_basis) / recorded_basis * Decimal("100")).quantize(
                Decimal("0.01")
            )
        )

    total_g = (cridora_active_g + personal_g).quantize(Decimal("0.000001"))
    from apps.accounts.vault_service import wallet_vault_payload

    vault_rows = wallet_vault_payload(user)
    cridora_market_inr = sum(
        Decimal(r.get("estimated_fractional_value_inr") or "0") for r in vault_rows
    )
    dep_scheme_inr = calculate_holding_value_inr(dep_g + scheme_g, rate)
    cridora_est_inr = (cridora_market_inr + dep_scheme_inr).quantize(Decimal("0.01"))
    total_est_inr = (cridora_est_inr + ref_personal_inr).quantize(Decimal("0.01"))

    return {
        "reference_gold_inr_per_gram_22k": str(rate.quantize(Decimal("0.01"))),
        "reference_rate_source": rate_source,
        "total_gold_grams": str(total_g),
        "cridora_active_grams": str(cridora_active_g.quantize(Decimal("0.000001"))),
        "personal_grams": str(personal_g.quantize(Decimal("0.000001"))),
        "vault_fractional_grams": str(frac_g.quantize(Decimal("0.000001"))),
        "vault_deposit_grams": str(dep_g.quantize(Decimal("0.000001"))),
        "vault_golden_scheme_grams": str(scheme_g.quantize(Decimal("0.000001"))),
        "cridora_estimated_value_inr": str(cridora_est_inr),
        "personal_estimated_value_inr": str(ref_personal_inr.quantize(Decimal("0.01"))),
        "personal_recorded_cost_basis_inr": str(recorded_basis) if recorded_basis > 0 else "",
        "personal_gain_on_recorded_cost_inr": personal_gain_inr_s,
        "personal_gain_on_recorded_cost_percent": personal_gain_pct_s,
        "total_estimated_value_inr": str(total_est_inr),
    }


def normalize_phone_digits(phone: str) -> str:
    return "".join(c for c in (phone or "") if c.isdigit())


def validate_document_upload(
    *, filename: str, size_bytes: int, max_bytes: int
) -> str | None:
    if size_bytes <= 0:
        return "Empty file."
    if size_bytes > max_bytes:
        return f"File too large (max {max_bytes // (1024 * 1024)} MB)."
    lower = (filename or "").lower().strip()
    dot = lower.rfind(".")
    ext = lower[dot:] if dot >= 0 else ""
    if ext not in ALLOWED_DOCUMENT_EXTS:
        return "Allowed types: JPG, PNG, WEBP, PDF."
    return None


def customer_portfolio_ledger_payload(user: User, ledger_filter: str = "all") -> dict[str, Any]:
    """Unified ledger for portfolio filters."""
    if user.user_type != User.CUSTOMER:
        return {"entries": []}

    from django.db.models import Prefetch

    from apps.accounts.models import GoldDepositIntake, GoldVault
    from apps.accounts.wallet_extras import customer_completed_fractional_ledger
    from apps.marketplace.models import jeweller_profile_for
    from apps.marketplace.pricing import reference_metal_rate_inr_per_gram_for_jeweller

    rate, _ = reference_gold_rate_inr_per_gram()
    cridora_base, _ = resolve_cridora_base_22k_inr()
    rows: list[dict[str, Any]] = []

    for r in customer_completed_fractional_ledger(user):
        g = Decimal(r["grams"])
        rows.append(
            {
                "occurred_at": r["created_at"],
                "transaction_type": "fractional",
                "reference": r["reference"],
                "grams": r["grams"],
                "label": "Fractional purchase",
                "jeweller_name": r.get("jeweller_name") or "",
                "current_value_inr": str((g * rate).quantize(Decimal("0.01"))),
            }
        )

    for dep in GoldDepositIntake.objects.filter(
        customer=user, status=GoldDepositIntake.COMPLETED
    ).select_related("jeweller"):
        g = dep.grams
        j = dep.jeweller
        profile = jeweller_profile_for(j)
        vrate = reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)
        jlabel = j.business_name or j.email or ""
        occurred = dep.completed_at.isoformat() if dep.completed_at else dep.updated_at.isoformat()
        cur = (g * vrate).quantize(Decimal("0.01"))
        rows.append(
            {
                "occurred_at": occurred,
                "transaction_type": "deposit",
                "reference": f"GD-{dep.id}",
                "grams": str(g),
                "label": f"Gold deposit · {jlabel}",
                "jeweller_name": jlabel,
                "current_value_inr": str(cur),
            }
        )

    other_holdings = Prefetch(
        "holdings",
        queryset=VaultHolding.objects.exclude(
            holding_type=VaultHolding.FRACTIONAL,
        ),
    )
    for v in (
        GoldVault.objects.filter(owner=user)
        .select_related("custodian")
        .prefetch_related(other_holdings)
    ):
        j = v.custodian
        profile = jeweller_profile_for(j)
        vrate = reference_metal_rate_inr_per_gram_for_jeweller(profile, cridora_base)
        jlabel = j.business_name or j.email or ""
        for h in v.holdings.all():
            bal = h.balance_grams
            if bal <= 0:
                continue
            cur = (bal * vrate).quantize(Decimal("0.01"))
            rows.append(
                {
                    "occurred_at": v.created_at.isoformat(),
                    "transaction_type": h.holding_type,
                    "reference": f"V{v.id}-{h.holding_type}",
                    "grams": str(bal),
                    "label": f"{h.get_holding_type_display()} · {jlabel}",
                    "jeweller_name": jlabel,
                    "current_value_inr": str(cur),
                }
            )

    for ph in PersonalGoldHolding.objects.filter(user=user, is_removed=False).order_by("-created_at"):
        jn = ""
        if ph.jeweller_id:
            ju = ph.jeweller
            jn = ju.business_name or ju.email or ""
        cur = calculate_holding_value_inr(ph.weight_grams, rate)
        rows.append(
            {
                "occurred_at": ph.created_at.isoformat(),
                "transaction_type": "personal",
                "reference": f"PH-{ph.id}",
                "grams": str(ph.weight_grams),
                "label": ph.title,
                "jeweller_name": jn,
                "current_value_inr": str(cur),
            }
        )

    rows.sort(key=lambda x: x["occurred_at"], reverse=True)
    allowed = {"all", "fractional", "deposit", "golden_scheme", "personal"}
    lf = (ledger_filter or "all").strip().lower()
    if lf not in allowed:
        lf = "all"
    if lf != "all":
        rows = [x for x in rows if x["transaction_type"] == lf]
    return {"entries": rows}
