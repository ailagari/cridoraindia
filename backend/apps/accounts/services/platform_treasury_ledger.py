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
    GoldLoanRequest,
    GoldSellbackRequest,
    JewellerRevenueLedgerEntry,
    PlatformCommercialLedgerEntry,
    PlatformSettlementBatch,
    SettlementObligation,
    VaultProductRedemption,
)
from apps.accounts.platform_commercial_service import spread_fee_inr_for_purchase

User = get_user_model()

FEATURE_LABELS = {
    "fractional": "Fractional gold",
    "deposit": "Gold deposit",
    "ornament_redemption": "Jewellery purchase",
    "cridorapay": "CridoraPay",
    "sellback": "Sellback",
    "loan_fee": "Loan fee",
    "cross_platform_fee": "Cross-platform fee",
    "spread_fee": "Spread fee",
}


def _jeweller_label(j: User) -> str:
    return j.business_name or j.email or f"Jeweller #{j.pk}"


def _customer_label(c: User | None) -> str:
    if c is None:
        return ""
    return f"{c.first_name} {c.last_name}".strip() or (c.email or "")


def _commercial_fee_map() -> dict[tuple[str, int], PlatformCommercialLedgerEntry]:
    out: dict[tuple[str, int], PlatformCommercialLedgerEntry] = {}
    for e in PlatformCommercialLedgerEntry.objects.all().select_related("fractional_purchase", "vault_product_redemption"):
        if e.fractional_purchase_id:
            out[("fractional", e.fractional_purchase_id)] = e
        elif e.vault_product_redemption_id:
            out[("ornament", e.vault_product_redemption_id)] = e
    return out


def _ledger_row(
    *,
    when: str,
    feature: str,
    reference: str,
    customer: User | None,
    jeweller: User,
    amount_inr: str,
    platform_revenue_inr: str,
    status: str,
    settlement_status: str,
    detail: dict[str, Any],
    jeweller_revenue_inr: str = "0",
) -> dict[str, Any]:
    return {
        "when": when,
        "feature": feature,
        "feature_label": FEATURE_LABELS.get(feature, feature.replace("_", " ").title()),
        "reference": reference,
        "customer": _customer_label(customer),
        "jeweller": _jeweller_label(jeweller),
        "jeweller_id": jeweller.pk,
        "amount_inr": amount_inr,
        "platform_revenue_inr": platform_revenue_inr,
        "jeweller_revenue_inr": jeweller_revenue_inr,
        "status": status,
        "settlement_status": settlement_status,
        "detail": detail,
    }


def _ledger_rows(
    *,
    feature: str = "",
    jeweller_id: int | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    rows = _all_platform_transaction_rows(
        feature=feature,
        jeweller_id=jeweller_id,
        from_date=from_date,
        to_date=to_date,
    )
    rows.sort(key=lambda r: r["when"], reverse=True)
    if feature:
        rows = [r for r in rows if r["feature"] == feature]
    total = len(rows)
    return rows[offset : offset + limit], total


def _all_platform_transaction_rows(
    *,
    feature: str,
    jeweller_id: int | None,
    from_date: date | None,
    to_date: date | None,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    fee_map = _commercial_fee_map()

    if not feature or feature == "fractional":
        qs = FractionalGoldPurchase.objects.exclude(
            status__in=(
                FractionalGoldPurchase.CANCELLED,
                FractionalGoldPurchase.REJECTED,
            )
        ).select_related("customer", "jeweller")
        if jeweller_id:
            qs = qs.filter(jeweller_id=jeweller_id)
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)
        for p in qs.order_by("-created_at")[:400]:
            commercial = fee_map.get(("fractional", p.pk))
            platform_fee = commercial.amount_inr if commercial else spread_fee_inr_for_purchase(p)
            settlement = commercial.status if commercial else "—"
            out.append(
                _ledger_row(
                    when=(p.jeweller_verified_at or p.created_at).isoformat(),
                    feature="fractional",
                    reference=f"FR-{p.pk}",
                    customer=p.customer,
                    jeweller=p.jeweller,
                    amount_inr=str(p.total_inr),
                    platform_revenue_inr=str(platform_fee),
                    status=p.status,
                    settlement_status=settlement,
                    detail={
                        "payment_method": p.payment_method,
                        "grams": str(p.grams),
                        "upi_utr": p.upi_utr or "",
                    },
                    jeweller_revenue_inr=_jeweller_revenue_for_fractional(p),
                )
            )

    if not feature or feature == "deposit":
        qs = GoldDepositIntake.objects.exclude(status=GoldDepositIntake.CANCELLED).select_related(
            "customer", "jeweller"
        )
        if jeweller_id:
            qs = qs.filter(jeweller_id=jeweller_id)
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)
        for d in qs.order_by("-created_at")[:200]:
            out.append(
                _ledger_row(
                    when=(d.completed_at or d.created_at).isoformat(),
                    feature="deposit",
                    reference=f"GD-{d.pk}",
                    customer=d.customer,
                    jeweller=d.jeweller,
                    amount_inr=str(d.estimated_value_inr),
                    platform_revenue_inr="0",
                    status=d.status,
                    settlement_status="—",
                    detail={"grams": str(d.grams), "payment_method": "counter"},
                )
            )

    if not feature or feature == "cridorapay":
        qs = CridoraPayBill.objects.exclude(
            status__in=(CridoraPayBill.STATUS_CANCELLED, CridoraPayBill.STATUS_EXPIRED)
        ).select_related("customer", "jeweller")
        if jeweller_id:
            qs = qs.filter(jeweller_id=jeweller_id)
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)
        for b in qs.order_by("-created_at")[:200]:
            out.append(
                _ledger_row(
                    when=(b.completed_at or b.created_at).isoformat(),
                    feature="cridorapay",
                    reference=b.reference,
                    customer=b.customer,
                    jeweller=b.jeweller,
                    amount_inr=str(b.total_inr),
                    platform_revenue_inr="0",
                    status=b.status,
                    settlement_status="—",
                    detail={"title": b.title, "payment_method": b.payment_method or ""},
                )
            )

    if not feature or feature == "ornament_redemption":
        qs = VaultProductRedemption.objects.select_related("customer", "jeweller")
        if jeweller_id:
            qs = qs.filter(jeweller_id=jeweller_id)
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)
        for r in qs.order_by("-created_at")[:200]:
            commercial = fee_map.get(("ornament", r.pk))
            platform_fee = commercial.amount_inr if commercial else (r.cross_platform_fee_inr or Decimal("0"))
            settlement = commercial.status if commercial else "—"
            out.append(
                _ledger_row(
                    when=r.created_at.isoformat(),
                    feature="ornament_redemption",
                    reference=f"RP-{r.pk}",
                    customer=r.customer,
                    jeweller=r.jeweller,
                    amount_inr=str(r.final_invoice_inr),
                    platform_revenue_inr=str(platform_fee),
                    status="completed",
                    settlement_status=settlement,
                    detail={"product_name": r.product_name, "grams": str(r.grams_charged)},
                )
            )

    if not feature or feature == "sellback":
        qs = GoldSellbackRequest.objects.exclude(
            status__in=(GoldSellbackRequest.STATUS_CANCELLED, GoldSellbackRequest.STATUS_REJECTED)
        ).select_related("customer", "jeweller")
        if jeweller_id:
            qs = qs.filter(jeweller_id=jeweller_id)
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)
        for s in qs.order_by("-created_at")[:200]:
            out.append(
                _ledger_row(
                    when=(s.updated_at if s.status == GoldSellbackRequest.STATUS_COMPLETED else s.created_at).isoformat(),
                    feature="sellback",
                    reference=f"SB-{s.pk}",
                    customer=s.customer,
                    jeweller=s.jeweller,
                    amount_inr=str(s.cash_estimate_inr),
                    platform_revenue_inr="0",
                    status=s.status,
                    settlement_status="—",
                    detail={"grams": str(s.grams), "payment_method": s.payment_method, "upi_utr": s.upi_utr or ""},
                )
            )

    if not feature or feature == "loan_fee":
        qs = GoldLoanRequest.objects.exclude(
            status__in=(GoldLoanRequest.STATUS_CANCELLED, GoldLoanRequest.STATUS_REJECTED)
        ).select_related("customer", "jeweller")
        if jeweller_id:
            qs = qs.filter(jeweller_id=jeweller_id)
        if from_date:
            qs = qs.filter(created_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__date__lte=to_date)
        for l in qs.order_by("-created_at")[:200]:
            out.append(
                _ledger_row(
                    when=l.created_at.isoformat(),
                    feature="loan_fee",
                    reference=f"LN-{l.pk}",
                    customer=l.customer,
                    jeweller=l.jeweller,
                    amount_inr=str(l.processing_fee_inr_snapshot),
                    platform_revenue_inr="0",
                    status=l.status,
                    settlement_status="—",
                    detail={"grams": str(l.grams), "payment_method": l.payment_method or "cash"},
                )
            )

    return out


def _jeweller_revenue_for_fractional(p: FractionalGoldPurchase) -> str:
    rev = (
        JewellerRevenueLedgerEntry.objects.filter(fractional_purchase_id=p.pk, jeweller_id=p.jeweller_id)
        .aggregate(s=Sum("amount_inr"))
        .get("s")
    )
    return str(rev or Decimal("0"))


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
