"""Platform-wide treasury ledger and settlement summary."""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.utils import timezone

from apps.accounts.models import (
    CridoraPayBill,
    FractionalGoldPurchase,
    GoldDepositIntake,
    JewellerRevenueLedgerEntry,
    PlatformCommercialLedgerEntry,
    PlatformSettlementBatch,
    SettlementObligation,
    VaultProductRedemption,
)

User = get_user_model()

FEATURE_LABELS = {
    "fractional": "Fractional",
    "deposit": "Deposit",
    "ornament_redemption": "Ornament",
    "cridorapay": "CridoraPay",
    "cross_platform_fee": "Cross-platform fee",
    "spread_fee": "Spread fee",
}


def _jeweller_label(j: User) -> str:
    return j.business_name or j.email or f"Jeweller #{j.pk}"


def _customer_label(c: User | None) -> str:
    if c is None:
        return ""
    return f"{c.first_name} {c.last_name}".strip() or (c.email or "")


def _platform_fee_for_entry(e: PlatformCommercialLedgerEntry | None) -> Decimal:
    if e is None:
        return Decimal("0")
    return e.amount_inr or Decimal("0")


def _ledger_rows(
    *,
    feature: str = "",
    jeweller_id: int | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    rows: list[dict[str, Any]] = []

    commercial = PlatformCommercialLedgerEntry.objects.select_related(
        "jeweller",
        "fractional_purchase__customer",
        "vault_product_redemption__customer",
        "settlement_batch",
    ).order_by("-created_at")
    if jeweller_id:
        commercial = commercial.filter(jeweller_id=jeweller_id)
    if from_date:
        commercial = commercial.filter(created_at__date__gte=from_date)
    if to_date:
        commercial = commercial.filter(created_at__date__lte=to_date)

    for e in commercial[:500]:
        feat = "spread_fee" if e.kind == PlatformCommercialLedgerEntry.KIND_SPREAD_FEE else "cross_platform_fee"
        if feature and feat != feature and feature not in (e.kind, feat):
            continue
        ref = ""
        customer = None
        amount_inr = Decimal("0")
        if e.fractional_purchase_id and e.fractional_purchase:
            p = e.fractional_purchase
            ref = f"FR-{p.pk}"
            customer = p.customer
            amount_inr = p.total_inr
            feat = "fractional"
        elif e.vault_product_redemption_id and e.vault_product_redemption:
            r = e.vault_product_redemption
            ref = f"RP-{r.pk}"
            customer = r.customer
            amount_inr = r.final_invoice_inr
            feat = "ornament_redemption"

        rows.append(
            {
                "when": e.created_at.isoformat(),
                "feature": feat,
                "reference": ref,
                "customer": _customer_label(customer),
                "jeweller": _jeweller_label(e.jeweller),
                "jeweller_id": e.jeweller_id,
                "amount_inr": str(amount_inr),
                "platform_revenue_inr": str(e.amount_inr),
                "jeweller_revenue_inr": _jeweller_revenue_for_commercial(e),
                "status": e.status,
                "settlement_status": e.status,
                "detail": {
                    "kind": e.kind,
                    "batch_id": e.settlement_batch_id,
                },
            }
        )

    if not feature or feature in ("fractional", "deposit", "cridorapay", "ornament_redemption"):
        rows.extend(_transaction_only_rows(feature=feature, jeweller_id=jeweller_id, from_date=from_date, to_date=to_date))

    rows.sort(key=lambda r: r["when"], reverse=True)
    if feature:
        rows = [r for r in rows if r["feature"] == feature or (feature == "spread_fee" and r["feature"] == "fractional")]
    total = len(rows)
    return rows[offset : offset + limit], total


def _jeweller_revenue_for_commercial(e: PlatformCommercialLedgerEntry) -> str:
    if e.fractional_purchase_id:
        rev = (
            JewellerRevenueLedgerEntry.objects.filter(
                fractional_purchase_id=e.fractional_purchase_id,
                jeweller_id=e.jeweller_id,
            )
            .aggregate(s=Sum("amount_inr"))
            .get("s")
        )
        return str(rev or Decimal("0"))
    if e.vault_product_redemption_id:
        rev = (
            JewellerRevenueLedgerEntry.objects.filter(
                vault_product_redemption_id=e.vault_product_redemption_id,
                jeweller_id=e.jeweller_id,
            )
            .aggregate(s=Sum("amount_inr"))
            .get("s")
        )
        return str(rev or Decimal("0"))
    return "0"


def _transaction_only_rows(
    *,
    feature: str,
    jeweller_id: int | None,
    from_date: date | None,
    to_date: date | None,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    existing_refs: set[str] = set()

    if not feature or feature == "fractional":
        qs = FractionalGoldPurchase.objects.filter(status=FractionalGoldPurchase.COMPLETED).select_related(
            "customer", "jeweller"
        )
        if jeweller_id:
            qs = qs.filter(jeweller_id=jeweller_id)
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)
        for p in qs.order_by("-created_at")[:200]:
            ref = f"FR-{p.pk}"
            existing_refs.add(ref)
            fee = PlatformCommercialLedgerEntry.objects.filter(fractional_purchase_id=p.pk).first()
            out.append(
                {
                    "when": (p.jeweller_verified_at or p.created_at).isoformat(),
                    "feature": "fractional",
                    "reference": ref,
                    "customer": _customer_label(p.customer),
                    "jeweller": _jeweller_label(p.jeweller),
                    "jeweller_id": p.jeweller_id,
                    "amount_inr": str(p.total_inr),
                    "platform_revenue_inr": str(_platform_fee_for_entry(fee)),
                    "jeweller_revenue_inr": "0",
                    "status": p.status,
                    "settlement_status": fee.status if fee else "—",
                    "detail": {"payment_method": p.payment_method},
                }
            )

    if not feature or feature == "deposit":
        qs = GoldDepositIntake.objects.filter(status=GoldDepositIntake.COMPLETED).select_related(
            "customer", "jeweller"
        )
        if jeweller_id:
            qs = qs.filter(jeweller_id=jeweller_id)
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)
        for d in qs.order_by("-created_at")[:100]:
            out.append(
                {
                    "when": (d.completed_at or d.created_at).isoformat(),
                    "feature": "deposit",
                    "reference": f"GD-{d.pk}",
                    "customer": _customer_label(d.customer),
                    "jeweller": _jeweller_label(d.jeweller),
                    "jeweller_id": d.jeweller_id,
                    "amount_inr": str(d.estimated_value_inr),
                    "platform_revenue_inr": "0",
                    "jeweller_revenue_inr": "0",
                    "status": d.status,
                    "settlement_status": "—",
                    "detail": {},
                }
            )

    if not feature or feature == "cridorapay":
        qs = CridoraPayBill.objects.filter(status=CridoraPayBill.STATUS_COMPLETED).select_related(
            "customer", "jeweller"
        )
        if jeweller_id:
            qs = qs.filter(jeweller_id=jeweller_id)
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)
        for b in qs.order_by("-created_at")[:100]:
            out.append(
                {
                    "when": (b.completed_at or b.created_at).isoformat(),
                    "feature": "cridorapay",
                    "reference": b.reference,
                    "customer": _customer_label(b.customer),
                    "jeweller": _jeweller_label(b.jeweller),
                    "jeweller_id": b.jeweller_id,
                    "amount_inr": str(b.total_inr),
                    "platform_revenue_inr": "0",
                    "jeweller_revenue_inr": "0",
                    "status": b.status,
                    "settlement_status": "—",
                    "detail": {"title": b.title},
                }
            )

    return out


def platform_treasury_ledger_payload(
    *,
    feature: str = "",
    jeweller_id: int | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    rows, total = _ledger_rows(
        feature=feature.strip(),
        jeweller_id=jeweller_id,
        from_date=from_date,
        to_date=to_date,
        limit=limit,
        offset=offset,
    )
    return {"results": rows, "count": total}


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = timezone.make_aware(datetime.combine(day, time.min))
    end = timezone.make_aware(datetime.combine(day, time.max))
    return start, end


def platform_settlement_summary_payload() -> dict[str, Any]:
    now = timezone.now()
    today = now.date()
    month_start = today.replace(day=1)
    t_start, t_end = _day_bounds(today)

    pending_entries = PlatformCommercialLedgerEntry.objects.filter(
        status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
    ).select_related("jeweller")

    owe_by_jeweller: dict[int, dict[str, Any]] = {}
    for e in pending_entries:
        slot = owe_by_jeweller.setdefault(
            e.jeweller_id,
            {
                "jeweller_id": e.jeweller_id,
                "name": _jeweller_label(e.jeweller),
                "pending_inr": Decimal("0"),
                "period": "open",
            },
        )
        slot["pending_inr"] += e.amount_inr

    open_batches = PlatformSettlementBatch.objects.filter(settled_at__isnull=True).select_related("jeweller")
    for b in open_batches:
        slot = owe_by_jeweller.setdefault(
            b.jeweller_id,
            {
                "jeweller_id": b.jeweller_id,
                "name": _jeweller_label(b.jeweller),
                "pending_inr": Decimal("0"),
                "period": b.period_label,
            },
        )
        slot["pending_inr"] += b.net_payable_inr
        slot["period"] = b.period_label

    jewellers_owe = [
        {**v, "pending_inr": str(v["pending_inr"].quantize(Decimal("0.01")))} for v in owe_by_jeweller.values()
    ]
    jewellers_owe.sort(key=lambda x: Decimal(x["pending_inr"]), reverse=True)

    platform_owes: list[dict[str, Any]] = []
    credit_batches = PlatformSettlementBatch.objects.filter(net_payable_inr__lt=0, settled_at__isnull=True).select_related(
        "jeweller"
    )
    credit_map: dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    for b in credit_batches:
        credit_map[b.jeweller_id] += abs(b.net_payable_inr)
    for jid, amt in credit_map.items():
        j = User.objects.filter(pk=jid).first()
        if j:
            platform_owes.append(
                {
                    "jeweller_id": jid,
                    "name": _jeweller_label(j),
                    "net_credit_inr": str(amt.quantize(Decimal("0.01"))),
                }
            )

    cross_pairs: dict[tuple[int, int], dict[str, Any]] = {}
    for ob in SettlementObligation.objects.filter(status=SettlementObligation.Status.PENDING).select_related(
        "from_jeweller", "to_jeweller"
    ):
        key = (ob.from_jeweller_id, ob.to_jeweller_id)
        slot = cross_pairs.setdefault(
            key,
            {
                "from_jeweller": _jeweller_label(ob.from_jeweller),
                "to_jeweller": _jeweller_label(ob.to_jeweller),
                "from_jeweller_id": ob.from_jeweller_id,
                "to_jeweller_id": ob.to_jeweller_id,
                "pending_inr": Decimal("0"),
                "grams": Decimal("0"),
            },
        )
        slot["pending_inr"] += ob.amount_inr
        slot["grams"] += ob.grams_equivalent

    cross_jeweller = [
        {
            **v,
            "pending_inr": str(v["pending_inr"].quantize(Decimal("0.01"))),
            "grams": str(v["grams"]),
        }
        for v in cross_pairs.values()
    ]

    rev_today = (
        PlatformCommercialLedgerEntry.objects.filter(created_at__range=(t_start, t_end))
        .aggregate(s=Sum("amount_inr"))
        .get("s")
        or Decimal("0")
    )
    rev_mtd = (
        PlatformCommercialLedgerEntry.objects.filter(created_at__date__gte=month_start)
        .aggregate(s=Sum("amount_inr"))
        .get("s")
        or Decimal("0")
    )

    return {
        "jewellers_owe_platform_inr": jewellers_owe,
        "platform_owes_jewellers_inr": platform_owes,
        "cross_jeweller_net": cross_jeweller,
        "platform_revenue_today_inr": str(rev_today.quantize(Decimal("0.01"))),
        "platform_revenue_mtd_inr": str(rev_mtd.quantize(Decimal("0.01"))),
    }


def treasury_report_csv(
    *,
    group_by: str,
    from_date: date | None,
    to_date: date | None,
) -> str:
    rows, _ = _ledger_rows(from_date=from_date, to_date=to_date, limit=10000, offset=0)

    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        if group_by == "jeweller":
            key = r["jeweller"]
        elif group_by == "customer":
            key = r["customer"] or "—"
        elif group_by == "feature":
            key = r["feature"]
        elif group_by == "day":
            key = r["when"][:10]
        elif group_by == "month":
            key = r["when"][:7]
        else:
            key = "all"
        grouped[key].append(r)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "group",
            "date",
            "feature",
            "reference",
            "customer",
            "jeweller",
            "amount_inr",
            "platform_fee_inr",
            "settlement_status",
        ]
    )
    for group_key, items in sorted(grouped.items()):
        for r in items:
            writer.writerow(
                [
                    group_key,
                    r["when"][:10],
                    r["feature"],
                    r["reference"],
                    r["customer"],
                    r["jeweller"],
                    r["amount_inr"],
                    r["platform_revenue_inr"],
                    r["settlement_status"],
                ]
            )
    return buf.getvalue()


def jeweller_settlement_summary_payload(jeweller: User) -> dict[str, Any]:
    pending = (
        PlatformCommercialLedgerEntry.objects.filter(
            jeweller=jeweller,
            status=PlatformCommercialLedgerEntry.STATUS_PENDING_SETTLEMENT,
        ).aggregate(s=Sum("amount_inr"))
        .get("s")
        or Decimal("0")
    )
    open_batch = (
        PlatformSettlementBatch.objects.filter(jeweller=jeweller, settled_at__isnull=True)
        .aggregate(s=Sum("net_payable_inr"))
        .get("s")
        or Decimal("0")
    )
    total = (pending + open_batch).quantize(Decimal("0.01"))
    return {
        "pending_platform_fee_inr": str(total),
        "period": "open",
    }


def treasury_daily_report_snapshot(report_date: date | None = None) -> dict[str, Any]:
    day = report_date or timezone.now().date()
    summary = platform_settlement_summary_payload()
    rows, count = _ledger_rows(from_date=day, to_date=day, limit=500, offset=0)
    return {
        "date": day.isoformat(),
        "transaction_count": count,
        "summary": summary,
        "transactions": rows[:100],
    }
