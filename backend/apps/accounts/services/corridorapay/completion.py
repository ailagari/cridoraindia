"""Complete CridoraPay bill — vault debit, liability, personal holding."""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from apps.accounts.jeweller_liability_service import release_custodial_liability_for_corridorapay
from apps.accounts.models import (
    CridoraPayBill,
    PersonalGoldHolding,
    PersonalHoldingDocument,
    PersonalPortfolioAuditLog,
)
from apps.accounts.services.personal_holdings import (
    calculate_holding_value_inr,
    reference_gold_rate_inr_per_gram,
)
from apps.accounts.services.personal_holdings_audit import log_personal_portfolio_action
from apps.accounts.vault_service import debit_customer_vault_for_transfer

User = get_user_model()


def _jeweller_label(u: User) -> str:
    return (u.business_name or u.email or "").strip()


def _recalc_holding_inr(h: PersonalGoldHolding) -> None:
    rate, _ = reference_gold_rate_inr_per_gram()
    h.estimated_current_value_inr = calculate_holding_value_inr(h.weight_grams, rate)


def _attach_bill_invoice_to_holding(bill: CridoraPayBill, holding: PersonalGoldHolding) -> None:
    if not bill.purchase_invoice:
        return
    if PersonalHoldingDocument.objects.filter(
        holding=holding,
        document_type=PersonalHoldingDocument.PURCHASE_INVOICE,
        is_removed=False,
    ).exists():
        return
    fname = bill.purchase_invoice_filename or bill.purchase_invoice.name.rsplit("/", 1)[-1] or "invoice"
    with bill.purchase_invoice.open("rb") as src:
        content = src.read()
    doc = PersonalHoldingDocument(
        holding=holding,
        document_type=PersonalHoldingDocument.PURCHASE_INVOICE,
        original_filename=fname,
        uploaded_by_type=PersonalHoldingDocument.UPLOADED_BY_JEWELLER,
        uploaded_by_id=bill.jeweller_id,
    )
    doc.file.save(fname, ContentFile(content), save=True)


def apply_vault_debit_for_bill(bill: CridoraPayBill) -> str | None:
    if bill.vault_debited:
        return None
    grams = bill.vault_grams_chosen
    if grams <= 0:
        return None
    lines, err = debit_customer_vault_for_transfer(bill.customer, bill.jeweller, grams)
    if err:
        return err
    total_debited = sum(g for _, g in lines)
    release_custodial_liability_for_corridorapay(
        bill.jeweller,
        bill.customer,
        total_debited,
        bill,
    )
    bill.vault_debited = True
    bill.save(update_fields=["vault_debited", "updated_at"])
    return None


def complete_corridorapay_bill(bill: CridoraPayBill) -> PersonalGoldHolding:
    if bill.personal_holding_id:
        return bill.personal_holding
    if bill.status == CridoraPayBill.STATUS_COMPLETED:
        if bill.personal_holding_id:
            return bill.personal_holding
        raise ValueError("Bill marked completed without a personal holding.")

    rate = bill.metal_rate_inr_per_gram
    pp = None
    if bill.weight_grams > 0 and bill.total_inr > 0:
        pp = (bill.total_inr / bill.weight_grams).quantize(Decimal("0.0001"))

    jlabel = _jeweller_label(bill.jeweller)
    h = PersonalGoldHolding(
        user=bill.customer,
        jeweller=bill.jeweller,
        title=bill.title,
        category=bill.category,
        weight_grams=bill.weight_grams,
        purity=bill.purity,
        purchase_date=timezone.localdate(),
        purchase_source=f"{jlabel} · {bill.reference}",
        purchase_price_inr_per_gram=pp,
        is_self_declared=False,
        verification_status=PersonalGoldHolding.JEWELLER_ADDED,
        created_by_type=PersonalGoldHolding.CREATED_BY_JEWELLER,
        created_by_id=bill.jeweller_id,
        notes=(bill.jeweller_note or "")[:2000],
    )
    _recalc_holding_inr(h)
    h.save()

    log_personal_portfolio_action(
        subject_user=bill.customer,
        action=PersonalPortfolioAuditLog.ACTION_JEWELLER_ADD,
        actor_type=PersonalGoldHolding.CREATED_BY_JEWELLER,
        actor_id=bill.jeweller_id,
        holding=h,
        metadata={"corridorapay_bill_id": bill.id, "reference": bill.reference},
    )
    _attach_bill_invoice_to_holding(bill, h)

    bill.personal_holding = h
    bill.status = CridoraPayBill.STATUS_COMPLETED
    bill.completed_at = timezone.now()
    bill.save(
        update_fields=[
            "personal_holding",
            "status",
            "completed_at",
            "updated_at",
        ]
    )
    return h


def finalize_corridorapay_bill(bill: CridoraPayBill) -> tuple[PersonalGoldHolding | None, str | None]:
    """Debit vault if needed, then create personal holding."""
    with transaction.atomic():
        locked = CridoraPayBill.objects.select_for_update().get(pk=bill.pk)
        if locked.personal_holding_id:
            return locked.personal_holding, None
        if locked.vault_grams_chosen > 0 and not locked.vault_debited:
            err = apply_vault_debit_for_bill(locked)
            if err:
                return None, err
        holding = complete_corridorapay_bill(locked)
        return holding, None
