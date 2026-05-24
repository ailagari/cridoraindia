"""Mixins for fractional UPI customer API views."""

from django.contrib.auth import get_user_model

from .models import FractionalGoldPurchase
from .platform_features import FeatureGatedViewMixin

User = get_user_model()

FRACTIONAL_UPI_INFLIGHT_STATUSES = (
    FractionalGoldPurchase.PENDING_PAYMENT,
    FractionalGoldPurchase.SIGNAL_RECEIVED,
    FractionalGoldPurchase.PENDING_REVIEW,
    FractionalGoldPurchase.NEEDS_MANUAL_VERIFICATION,
    FractionalGoldPurchase.AWAITING_UTR_VERIFY,
)


class FractionalUpiInflightBypassMixin(FeatureGatedViewMixin):
    """Let customers finish an open UPI order even if rollout flag is temporarily off."""

    feature_key = "fractional_upi_reconciliation"

    def _customer_inflight_upi_order(self, request, pk: int | None) -> bool:
        if pk is None:
            return False
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return False
        if user.user_type != User.CUSTOMER:
            return False
        return FractionalGoldPurchase.objects.filter(
            pk=pk,
            customer=user,
            payment_method=FractionalGoldPurchase.PAY_UPI,
            status__in=FRACTIONAL_UPI_INFLIGHT_STATUSES,
        ).exists()

    def dispatch(self, request, *args, **kwargs):
        if self._customer_inflight_upi_order(request, kwargs.get("pk")):
            return super(FeatureGatedViewMixin, self).dispatch(request, *args, **kwargs)
        return super().dispatch(request, *args, **kwargs)
