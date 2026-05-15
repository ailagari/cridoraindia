from decimal import Decimal

from django.db import migrations, models


def seed_and_backfill(apps, schema_editor):
    MetalPurity = apps.get_model("marketplace", "MetalPurity")
    ProductCategory = apps.get_model("marketplace", "ProductCategory")
    MarketplaceProduct = apps.get_model("marketplace", "MarketplaceProduct")
    JewellerPricingProfile = apps.get_model("marketplace", "JewellerPricingProfile")

    mp916, _ = MetalPurity.objects.get_or_create(
        slug="bis916",
        defaults={
            "label": "BIS 916 (22K)",
            "fine_fraction": Decimal("0.9160"),
            "sort_order": 0,
            "is_active": True,
        },
    )
    MetalPurity.objects.get_or_create(
        slug="bis875",
        defaults={
            "label": "BIS 875 (21K)",
            "fine_fraction": Decimal("0.8750"),
            "sort_order": 10,
            "is_active": True,
        },
    )
    MetalPurity.objects.get_or_create(
        slug="bis750",
        defaults={
            "label": "BIS 750 (18K)",
            "fine_fraction": Decimal("0.7500"),
            "sort_order": 20,
            "is_active": True,
        },
    )

    preset = [
        ("necklaces", "Necklaces"),
        ("chains", "Chains"),
        ("bangles", "Bangles"),
        ("rings", "Rings"),
        ("pendants", "Pendants"),
        ("coins", "Coins"),
        ("bracelets", "Bracelets"),
        ("earrings", "Earrings"),
        ("bridal-sets", "Bridal sets"),
        ("ornaments", "Ornaments"),
        ("other", "Other"),
    ]
    for i, (slug, label) in enumerate(preset):
        ProductCategory.objects.get_or_create(
            slug=slug,
            defaults={
                "label": label,
                "sort_order": i * 10,
                "is_active": True,
            },
        )

    from django.utils.text import slugify

    general = ProductCategory.objects.get(slug="other")

    for p in MarketplaceProduct.objects.all().iterator():
        raw = (getattr(p, "category", None) or "").strip()
        if raw:
            s = slugify(raw)[:80]
            pc = ProductCategory.objects.filter(slug=s).first()
            if not pc:
                pc = ProductCategory.objects.filter(label__iexact=raw).first()
            if not pc:
                pc = ProductCategory.objects.create(
                    slug=s or "misc",
                    label=raw[:120],
                    sort_order=9000,
                    is_active=True,
                )
        else:
            pc = general
        p.metal_purity_id = mp916.pk
        p.product_category_id = pc.pk
        p.category = str(pc.label)[:80]
        p.save(update_fields=["metal_purity_id", "product_category_id", "category"])

    MarketplaceProduct.objects.all().update(moderation_status="approved")

    for prof in JewellerPricingProfile.objects.all().iterator():
        prof.metal_purities_offered.add(mp916)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    # PostgreSQL: bulk RunPython updates on MarketplaceProduct defer trigger handling until
    # transaction end; ALTER FK/not-null in the same txn raises "pending trigger events".
    atomic = False

    dependencies = [
        ("marketplace", "0018_product_same_store_making_numeric"),
    ]

    operations = [
        migrations.CreateModel(
            name="MetalPurity",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("slug", models.SlugField(max_length=48, unique=True)),
                ("label", models.CharField(max_length=120)),
                (
                    "fine_fraction",
                    models.DecimalField(
                        decimal_places=4,
                        default=Decimal("0.9160"),
                        max_digits=7,
                        help_text="Fine gold fraction vs gross ornament weight (916 → 0.916). Metal quote remains 22K board ₹/g.",
                    ),
                ),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ["sort_order", "id"],
            },
        ),
        migrations.CreateModel(
            name="ProductCategory",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("slug", models.SlugField(max_length=80, unique=True)),
                ("label", models.CharField(max_length=120)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
            ],
            options={
                "ordering": ["sort_order", "id"],
                "verbose_name_plural": "Product categories",
            },
        ),
        migrations.AddField(
            model_name="marketplaceproduct",
            name="stock_quantity",
            field=models.PositiveIntegerField(
                default=1,
                help_text="Units in stock (0 = visible but out of stock).",
            ),
        ),
        migrations.AddField(
            model_name="marketplaceproduct",
            name="metal_purity",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.PROTECT,
                related_name="products",
                to="marketplace.metalpurity",
            ),
        ),
        migrations.AddField(
            model_name="marketplaceproduct",
            name="product_category",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.PROTECT,
                related_name="products",
                to="marketplace.productcategory",
            ),
        ),
        migrations.AddField(
            model_name="jewellerpricingprofile",
            name="metal_purities_offered",
            field=models.ManyToManyField(
                blank=True,
                help_text="Purities this showroom sells. Leave empty to allow only BIS 916 when listing SKUs.",
                related_name="jeweller_profiles_offering",
                to="marketplace.metalpurity",
            ),
        ),
        migrations.RunPython(seed_and_backfill, noop_reverse),
        migrations.AlterField(
            model_name="marketplaceproduct",
            name="metal_purity",
            field=models.ForeignKey(
                on_delete=models.PROTECT,
                related_name="products",
                to="marketplace.metalpurity",
            ),
        ),
        migrations.AlterField(
            model_name="marketplaceproduct",
            name="product_category",
            field=models.ForeignKey(
                on_delete=models.PROTECT,
                related_name="products",
                to="marketplace.productcategory",
            ),
        ),
        migrations.AlterField(
            model_name="marketplaceproduct",
            name="category",
            field=models.CharField(
                help_text="Denormalized copy of product_category.label for legacy filters.",
                max_length=80,
            ),
        ),
    ]
