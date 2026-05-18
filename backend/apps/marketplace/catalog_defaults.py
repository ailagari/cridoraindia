"""Idempotent India-marketplace catalogue masters (purities + product categories)."""

from __future__ import annotations

from decimal import Decimal

from .models import MetalPurity, ProductCategory

GOLD_PURITIES: tuple[tuple[str, str, Decimal, int, str, str], ...] = (
    # slug, label, fine_fraction, sort_order, spot_family, spot_key
    ("bis916", "BIS 916 (22K)", Decimal("0.9160"), 0, "gold", "22K"),
    ("bis875", "BIS 875 (21K)", Decimal("0.8750"), 10, "gold", "21K"),
    ("bis750", "BIS 750 (18K)", Decimal("0.7500"), 20, "gold", "18K"),
    ("bis999", "24K / 999", Decimal("0.9990"), 30, "gold", "24K"),
)

SILVER_PURITIES: tuple[tuple[str, str, Decimal, int, str, str], ...] = (
    ("silver999", "Silver 999", Decimal("1.0000"), 40, "silver", "999"),
    ("silver925", "Silver 925", Decimal("0.9250"), 50, "silver", "925"),
)

PRODUCT_CATEGORIES: tuple[tuple[str, str, int], ...] = (
    ("necklaces", "Necklaces", 0),
    ("chains", "Chains", 10),
    ("bangles", "Bangles", 20),
    ("rings", "Rings", 30),
    ("pendants", "Pendants", 40),
    ("coins", "Coins", 50),
    ("bracelets", "Bracelets", 60),
    ("earrings", "Earrings", 70),
    ("bridal-sets", "Bridal sets", 80),
    ("ornaments", "Ornaments", 90),
    ("other", "Other", 100),
)

# Legacy / informal slugs → canonical fine_fraction + spot mapping
PURITY_ALIASES: dict[str, tuple[Decimal, str, str]] = {
    "916": (Decimal("0.9160"), "gold", "22K"),
    "22k": (Decimal("0.9160"), "gold", "22K"),
    "24k": (Decimal("0.9990"), "gold", "24K"),
    "999": (Decimal("0.9990"), "gold", "24K"),
}


def ensure_marketplace_catalog_defaults() -> None:
    for slug, label, frac, order, family, key in (*GOLD_PURITIES, *SILVER_PURITIES):
        row, created = MetalPurity.objects.get_or_create(
            slug=slug,
            defaults={
                "label": label,
                "fine_fraction": frac,
                "sort_order": order,
                "is_active": True,
                "spot_family": family,
                "spot_key": key,
            },
        )
        if not created:
            updates: dict = {}
            if row.label != label:
                updates["label"] = label
            if row.fine_fraction != frac:
                updates["fine_fraction"] = frac
            if row.sort_order != order:
                updates["sort_order"] = order
            if not row.is_active:
                updates["is_active"] = True
            if row.spot_family != family:
                updates["spot_family"] = family
            if row.spot_key != key:
                updates["spot_key"] = key
            if updates:
                for k, v in updates.items():
                    setattr(row, k, v)
                row.save(update_fields=list(updates.keys()))

    for slug, (frac, family, key) in PURITY_ALIASES.items():
        alias = MetalPurity.objects.filter(slug=slug).first()
        if not alias:
            continue
        updates: dict = {}
        if alias.fine_fraction != frac:
            updates["fine_fraction"] = frac
        if alias.spot_family != family:
            updates["spot_family"] = family
        if alias.spot_key != key:
            updates["spot_key"] = key
        if not alias.is_active:
            updates["is_active"] = True
        if updates:
            for k, v in updates.items():
                setattr(alias, k, v)
            alias.save(update_fields=list(updates.keys()))

    for slug, label, order in PRODUCT_CATEGORIES:
        row, created = ProductCategory.objects.get_or_create(
            slug=slug,
            defaults={"label": label, "sort_order": order, "is_active": True},
        )
        if not created:
            updates: dict = {}
            if row.label != label:
                updates["label"] = label
            if row.sort_order != order:
                updates["sort_order"] = order
            if not row.is_active:
                updates["is_active"] = True
            if updates:
                for k, v in updates.items():
                    setattr(row, k, v)
                row.save(update_fields=list(updates.keys()))
