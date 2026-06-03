"""Platform feature rollout registry and effective flag resolution."""

from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.response import Response

from .models import PlatformOperationalSettings

FEATURE_DEFINITIONS: tuple[dict[str, Any], ...] = (
    {
        "key": "customer_marketplace",
        "label": "Customer marketplace",
        "description": "Browse jewellers and products in the customer app.",
        "default": True,
        "customer_sections": ("shop_jewellers", "shop_products"),
        "jeweller_sections": (),
        "admin_sections": ("mkt_products",),
    },
    {
        "key": "fractional_purchase",
        "label": "Fractional gold purchase",
        "description": "Customer fractional buy and jeweller purchase desk.",
        "default": True,
        "customer_sections": ("invest_fractional",),
        "jeweller_sections": ("txn_purchases",),
        "admin_sections": ("plat_control",),
    },
    {
        "key": "fractional_upi_reconciliation",
        "label": "Fractional UPI (intent + reconciliation)",
        "description": "Online UPI pay with signals and jeweller reconciliation queue.",
        "default": True,
        "customer_sections": (),
        "jeweller_sections": (),
        "admin_sections": (),
    },
    {
        "key": "fractional_counter",
        "label": "Fractional counter (OTP)",
        "description": "Showroom counter fractional purchase with OTP verification.",
        "default": True,
        "customer_sections": (),
        "jeweller_sections": (),
        "admin_sections": (),
    },
    {
        "key": "gold_deposit",
        "label": "Physical gold deposit",
        "description": "Customer deposit intake and jeweller verify desk.",
        "default": True,
        "customer_sections": ("invest_deposit",),
        "jeweller_sections": ("txn_deposits",),
        "admin_sections": (),
    },
    {
        "key": "corridorapay",
        "label": "CridoraPay",
        "description": "Vault-backed bills and jeweller CridoraPay desk.",
        "default": True,
        "customer_sections": ("invest_cridorapay",),
        "jeweller_sections": ("txn_cridorapay",),
        "admin_sections": (),
    },
    {
        "key": "golden_scheme",
        "label": "Golden scheme",
        "description": "Customer scheme hub (placeholder until program launch).",
        "default": False,
        "customer_sections": ("invest_scheme",),
        "jeweller_sections": (),
        "admin_sections": ("mkt_programs",),
    },
    {
        "key": "sellback_cash",
        "label": "Cash sellback (OTP)",
        "description": "Sell vault gold for cash at counter; customer OTP settlement.",
        "default": True,
        "customer_sections": ("redeem_cash",),
        "jeweller_sections": ("txn_ops",),
        "admin_sections": (),
    },
    {
        "key": "sellback_upi",
        "label": "Sellback UPI payout",
        "description": "Customer UPI payout sellback (jeweller pays customer UPI ID).",
        "default": False,
        "customer_sections": (),
        "jeweller_sections": ("txn_ops",),
        "admin_sections": (),
    },
    {
        "key": "gold_transfer",
        "label": "Vault transfer",
        "description": "Peer vault gram transfers.",
        "default": True,
        "customer_sections": ("redeem_transfer",),
        "jeweller_sections": ("txn_transfers",),
        "admin_sections": (),
    },
    {
        "key": "gold_loan",
        "label": "Gold loans",
        "description": "Customer loan requests and jeweller loan desk.",
        "default": True,
        "customer_sections": ("redeem_loan",),
        "jeweller_sections": ("txn_loans",),
        "admin_sections": (),
    },
    {
        "key": "loan_repayment_upi",
        "label": "Loan repayment UPI",
        "description": "Repay gold loans online via UPI reconciliation.",
        "default": True,
        "customer_sections": (),
        "jeweller_sections": (),
        "admin_sections": (),
    },
    {
        "key": "cross_redemption",
        "label": "Emergency cross redemption",
        "description": "Cross-jeweller emergency redemption flows.",
        "default": True,
        "customer_sections": ("redeem_emergency",),
        "jeweller_sections": ("txn_ops",),
        "admin_sections": (),
    },
    {
        "key": "marketplace_redemption",
        "label": "Ornament redemptions",
        "description": "Jeweller ornament redemption desk under Operations.",
        "default": True,
        "customer_sections": (),
        "jeweller_sections": ("txn_ops",),
        "admin_sections": (),
    },
    {
        "key": "notify_primary_jeweller_change",
        "label": "Primary jeweller change alerts",
        "description": "Notify a jeweller when a customer switches their primary jeweller away from that shop.",
        "default": True,
        "customer_sections": (),
        "jeweller_sections": (),
        "admin_sections": (),
    },
)

FEATURE_KEYS: frozenset[str] = frozenset(d["key"] for d in FEATURE_DEFINITIONS)
_DEFAULT_FLAGS: dict[str, bool] = {d["key"]: bool(d["default"]) for d in FEATURE_DEFINITIONS}


def _stored_overrides() -> dict[str, bool]:
    row = PlatformOperationalSettings.objects.filter(pk=1).only("feature_flags").first()
    if not row or not isinstance(row.feature_flags, dict):
        return {}
    out: dict[str, bool] = {}
    for key, val in row.feature_flags.items():
        if key in FEATURE_KEYS and isinstance(val, bool):
            out[key] = val
    return out


def effective_feature_flags() -> dict[str, bool]:
    merged = dict(_DEFAULT_FLAGS)
    merged.update(_stored_overrides())
    return merged


def is_feature_enabled(key: str) -> bool:
    if key not in FEATURE_KEYS:
        return False
    return effective_feature_flags().get(key, _DEFAULT_FLAGS[key])


def feature_catalog_for_admin() -> list[dict[str, Any]]:
    flags = effective_feature_flags()
    catalog = []
    for d in FEATURE_DEFINITIONS:
        catalog.append(
            {
                "key": d["key"],
                "label": d["label"],
                "description": d["description"],
                "default": d["default"],
                "enabled": flags[d["key"]],
            }
        )
    return catalog


def customer_section_enabled(section_key: str, flags: dict[str, bool] | None = None) -> bool:
    flags = flags or effective_feature_flags()
    for d in FEATURE_DEFINITIONS:
        if section_key in d.get("customer_sections", ()) and flags.get(d["key"], d["default"]):
            return True
    return False


def jeweller_section_enabled(section_key: str, flags: dict[str, bool] | None = None) -> bool:
    flags = flags or effective_feature_flags()
    for d in FEATURE_DEFINITIONS:
        if section_key in d.get("jeweller_sections", ()) and flags.get(d["key"], d["default"]):
            return True
    return False


def admin_section_enabled(section_key: str, flags: dict[str, bool] | None = None) -> bool:
    flags = flags or effective_feature_flags()
    for d in FEATURE_DEFINITIONS:
        if section_key in d.get("admin_sections", ()) and flags.get(d["key"], d["default"]):
            return True
    return False


def set_feature_flags(updates: dict[str, bool]) -> dict[str, bool]:
    unknown = [k for k in updates if k not in FEATURE_KEYS]
    if unknown:
        raise ValueError(f"Unknown feature keys: {', '.join(sorted(unknown))}")
    row = PlatformOperationalSettings.load()
    stored = dict(row.feature_flags) if isinstance(row.feature_flags, dict) else {}
    for key, val in updates.items():
        if not isinstance(val, bool):
            raise ValueError(f"{key} must be a boolean.")
        stored[key] = val
    row.feature_flags = stored
    row.save(update_fields=["feature_flags", "updated_at"])
    return effective_feature_flags()


def require_feature_enabled(key: str) -> Response | None:
    if is_feature_enabled(key):
        return None
    return Response(
        {
            "detail": "This feature is temporarily unavailable.",
            "feature": key,
        },
        status=status.HTTP_403_FORBIDDEN,
    )


class FeatureGatedViewMixin:
    """Return 403 before handler when feature_key is set and disabled."""

    feature_key: str = ""

    def dispatch(self, request, *args, **kwargs):
        if self.feature_key:
            blocked = require_feature_enabled(self.feature_key)
            if blocked is not None:
                return blocked
        return super().dispatch(request, *args, **kwargs)
