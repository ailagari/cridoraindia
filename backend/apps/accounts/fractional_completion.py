"""Complete fractional purchase: credit customer vault + jeweller custodial liability."""

from __future__ import annotations

from django.utils import timezone

from .jeweller_liability_service import increment_custodial_liability_for_fractional_sale
from .models import FractionalGoldPurchase
from .vault_service import credit_customer_fractional


def apply_fractional_purchase_credit_and_liabilities(purchase: FractionalGoldPurchase) -> None:
    """Caller must hold purchase row locked (select_for_update) inside transaction.atomic."""
    credit_customer_fractional(
        purchase.customer, purchase.jeweller, purchase.grams
    )
    increment_custodial_liability_for_fractional_sale(
        purchase.jeweller,
        purchase.customer,
        purchase.grams,
        purchase,
    )
    purchase.status = FractionalGoldPurchase.COMPLETED
    purchase.jeweller_verified_at = timezone.now()
    purchase.save(update_fields=["status", "jeweller_verified_at", "updated_at"])
