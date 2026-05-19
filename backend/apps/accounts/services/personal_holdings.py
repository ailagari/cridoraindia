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
    loan_locked_g = by_type.get(VaultHolding.LOAN_COLLATERAL, Decimal("0"))
    cridora_active_g = frac_g + dep_g + scheme_g

    from apps.accounts.models import GoldLoanRequest

    loan_outstanding = Decimal("0")
    for ln in GoldLoanRequest.objects.filter(
        customer=user, status=GoldLoanRequest.STATUS_DISBURSED
    ):
        loan_outstanding += ln.principal_outstanding_inr

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
        "loan_collateral_locked_grams": str(loan_locked_g.quantize(Decimal("0.000001"))),
        "loan_principal_outstanding_inr": str(loan_outstanding.quantize(Decimal("0.01"))),
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

    from apps.accounts.models import (
        GoldDepositIntake,
        GoldSellbackRequest,
        GoldTransfer,
        GoldVault,
        VaultProductRedemption,
    )
    from apps.accounts.wallet_extras import customer_completed_fractional_ledger
    from apps.marketplace.models import jeweller_profile_for
    from apps.marketplace.pricing import reference_metal_rate_inr_per_gram_for_jeweller

    rate, _ = reference_gold_rate_inr_per_gram()
    cridora_base, _ = resolve_cridora_base_22k_inr()
    rows: list[dict[str, Any]] = []

    def _party_label(u: User) -> str:
        name = f"{u.first_name} {u.last_name}".strip()
        if name:
            return name
        if u.business_name:
            return u.business_name.strip()
        return (u.email or u.cridora_member_id or f"User #{u.id}").strip()

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

    for t in (
        GoldTransfer.objects.filter(Q(from_user=user) | Q(to_user=user))
        .select_related("from_user", "to_user", "from_custodian", "to_custodian")
        .order_by("-created_at")
    ):
        grams = t.grams
        if t.from_user_id == user.id:
            txn_type = "transfer_out"
            other = t.to_user
            cust = t.from_custodian
            label = f"Transfer out · {_party_label(other)}"
        elif t.to_user_id == user.id:
            txn_type = "transfer_in"
            other = t.from_user
            cust = t.to_custodian
            label = f"Transfer in · {_party_label(other)}"
        else:
            continue
        jlabel = ""
        if cust:
            jlabel = cust.business_name or cust.email or ""
        cur = (grams * rate).quantize(Decimal("0.01"))
        rows.append(
            {
                "occurred_at": t.created_at.isoformat(),
                "transaction_type": txn_type,
                "reference": f"GT-{t.id}",
                "grams": str(grams),
                "label": label,
                "jeweller_name": jlabel,
                "current_value_inr": str(cur),
            }
        )

    for s in (
        GoldSellbackRequest.objects.filter(
            customer=user, status=GoldSellbackRequest.STATUS_COMPLETED
        )
        .select_related("jeweller")
        .order_by("-updated_at")
    ):
        j = s.jeweller
        jlabel = j.business_name or j.email or ""
        occurred = s.updated_at.isoformat()
        cash = s.cash_estimate_inr.quantize(Decimal("0.01"))
        rows.append(
            {
                "occurred_at": occurred,
                "transaction_type": "sellback",
                "reference": f"SB-{s.id}",
                "grams": str(s.grams),
                "label": f"Gold redemption · {jlabel}",
                "jeweller_name": jlabel,
                "current_value_inr": str(cash),
            }
        )

    for rp in VaultProductRedemption.objects.filter(customer=user).select_related(
        "jeweller", "product"
    ):
        j = rp.jeweller
        jlabel = j.business_name or j.email or ""
        occurred = rp.created_at.isoformat()
        cur = rp.final_invoice_inr.quantize(Decimal("0.01"))
        rows.append(
            {
                "occurred_at": occurred,
                "transaction_type": "redemption_purchase",
                "reference": f"RP-{rp.id}",
                "grams": str(rp.grams_charged),
                "label": f"Vault purchase · {rp.product_name}",
                "jeweller_name": jlabel,
                "current_value_inr": str(cur),
            }
        )

    from apps.accounts.models import CridoraPayBill

    for bill in CridoraPayBill.objects.filter(
        customer=user, status=CridoraPayBill.STATUS_COMPLETED
    ).select_related("jeweller"):
        j = bill.jeweller
        jlabel = j.business_name or j.email or ""
        occurred = (bill.completed_at or bill.created_at).isoformat()
        rows.append(
            {
                "occurred_at": occurred,
                "transaction_type": "cridorapay_purchase",
                "reference": bill.reference,
                "grams": str(bill.weight_grams),
                "label": f"CridoraPay · {bill.title}",
                "jeweller_name": jlabel,
                "current_value_inr": str(bill.total_inr.quantize(Decimal("0.01"))),
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

    from apps.accounts.services.loan_portfolio_ledger import customer_loan_ledger_rows

    rows.extend(customer_loan_ledger_rows(user))
    rows.sort(key=lambda x: x["occurred_at"], reverse=True)
    allowed = {
        "all",
        "fractional",
        "deposit",
        "golden_scheme",
        "personal",
        "transfer_in",
        "transfer_out",
        "transfer",
        "sellback",
        "redemption_purchase",
        "cridorapay_purchase",
        "loan",
        "loan_collateral_lock",
        "loan_disbursement",
        "loan_repayment",
        "loan_collateral_release",
    }
    lf = (ledger_filter or "all").strip().lower()
    if lf not in allowed:
        lf = "all"
    if lf != "all":
        if lf == "transfer":
            rows = [
                x for x in rows if x["transaction_type"] in ("transfer_in", "transfer_out")
            ]
        elif lf == "loan":
            rows = [x for x in rows if x["transaction_type"].startswith("loan_")]
        else:
            rows = [x for x in rows if x["transaction_type"] == lf]
    return {"entries": rows}


def admin_personal_vault_user_summaries(
    *,
    q: str | None = None,
    user_id: int | None = None,
    limit: int = 250,
) -> list[dict[str, Any]]:
    """Read-only admin rollup: customer default jeweller + personal grams by linked jeweller."""
    qs = PersonalGoldHolding.objects.filter(is_removed=False)
    if user_id:
        qs = qs.filter(user_id=user_id)
    needle = (q or "").strip()
    if needle:
        qs = qs.filter(
            Q(user__email__icontains=needle)
            | Q(user__first_name__icontains=needle)
            | Q(user__last_name__icontains=needle)
            | Q(user__cridora_member_id__icontains=needle)
            | Q(user__default_jeweller__business_name__icontains=needle)
            | Q(user__default_jeweller__email__icontains=needle)
            | Q(jeweller__business_name__icontains=needle)
            | Q(jeweller__email__icontains=needle)
        )

    user_rows = list(
        qs.values(
            "user_id",
            "user__email",
            "user__first_name",
            "user__last_name",
            "user__cridora_member_id",
            "user__default_jeweller_id",
            "user__default_jeweller__business_name",
            "user__default_jeweller__email",
        )
        .annotate(
            holding_count=Count("id"),
            total_weight_grams=Coalesce(Sum("weight_grams"), Decimal("0"), output_field=DecimalField()),
        )
        .order_by("-total_weight_grams", "user__email")[:limit]
    )
    if not user_rows:
        return []

    user_ids = [int(r["user_id"]) for r in user_rows]
    jeweller_rows = (
        qs.filter(user_id__in=user_ids)
        .values(
            "user_id",
            "jeweller_id",
            "jeweller__business_name",
            "jeweller__email",
        )
        .annotate(
            holding_count=Count("id"),
            total_weight_grams=Coalesce(Sum("weight_grams"), Decimal("0"), output_field=DecimalField()),
        )
        .order_by("-total_weight_grams")
    )

    by_user_jeweller: dict[int, list[dict[str, Any]]] = {}
    for row in jeweller_rows:
        uid = int(row["user_id"])
        jid = row["jeweller_id"]
        if jid:
            jname = (row["jeweller__business_name"] or row["jeweller__email"] or "").strip()
        else:
            jname = "Self-declared"
        by_user_jeweller.setdefault(uid, []).append(
            {
                "jeweller_id": jid,
                "jeweller_name": jname,
                "holding_count": int(row["holding_count"]),
                "total_weight_grams": str(row["total_weight_grams"]),
            }
        )

    rate, _ = reference_gold_rate_inr_per_gram()
    out: list[dict[str, Any]] = []
    for row in user_rows:
        uid = int(row["user_id"])
        default_jid = row["user__default_jeweller_id"]
        default_name = (
            (row["user__default_jeweller__business_name"] or row["user__default_jeweller__email"] or "").strip()
            if default_jid
            else ""
        )
        total_g = row["total_weight_grams"] or Decimal("0")
        name = f"{row['user__first_name'] or ''} {row['user__last_name'] or ''}".strip()
        breakdown = []
        for item in by_user_jeweller.get(uid, []):
            breakdown.append(
                {
                    **item,
                    "is_default_jeweller": bool(
                        default_jid and item["jeweller_id"] and int(item["jeweller_id"]) == int(default_jid)
                    ),
                }
            )
        breakdown.sort(
            key=lambda x: (
                0 if x.get("is_default_jeweller") else 1,
                -Decimal(x["total_weight_grams"]),
            )
        )
        out.append(
            {
                "user_id": uid,
                "email": row["user__email"] or "",
                "full_name": name,
                "cridora_member_id": row["user__cridora_member_id"] or "",
                "default_jeweller_id": default_jid,
                "default_jeweller_name": default_name,
                "holding_count": int(row["holding_count"]),
                "total_weight_grams": str(total_g),
                "total_estimated_value_inr": str(calculate_holding_value_inr(total_g, rate)),
                "holdings_by_jeweller": breakdown,
            }
        )
    return out
