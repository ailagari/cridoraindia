"""Seed local test accounts: admin, customer, jewellers, and marketplace demo data for UI/API smoke tests."""

import os

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model

from apps.accounts.models import KYDocument

User = get_user_model()

# Default aligns with cridoraindia-style local demos; override with CRIDORA_SEED_PASSWORD or --password
_DEFAULT_PASSWORD = "CridoraDemo2026!"

_PLACEHOLDER_PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"

_JEWELLER_ESSENTIAL_TYPES = [
    KYDocument.GST_CERTIFICATE,
    KYDocument.PAN_BUSINESS,
    KYDocument.SHOP_ESTABLISHMENT,
    KYDocument.TRADE_LICENSE,
    KYDocument.ADDRESS_PROOF_SHOP,
    KYDocument.PROPRIETOR_AADHAAR,
]

_DUMMY_JEWELLERS = (
    {
        "email": "dummy.jeweller.kochi@cridora.test",
        "first_name": "Dummy",
        "last_name": "Kochi",
        "phone": "9999910001",
        "business_name": "Heritage Bay Jewellers — Kochi",
        "gstin": "32AABCU9603R1ZX",
        "shop_address": "MG Road, next to Tower",
        "city": "Kochi",
        "state": "Kerala",
        "pincode": "682031",
        "profile_extra": {
            "markup": "0.8",
            "sellback_pct": "1.5",
            "sellback_fixed": "12.00",
            "making": "680.00",
            "deposit_apr": "6.000",
            "loan_apr": "11.500",
            "deposit_note": "Illustrative deposit yield on this demo storefront — not live pricing.",
        },
    },
    {
        "email": "dummy.jeweller.mumbai@cridora.test",
        "first_name": "Dummy",
        "last_name": "Mumbai",
        "phone": "9999910002",
        "business_name": "Metro Gold Palace — Mumbai",
        "gstin": "27AABCU9603R1ZX",
        "shop_address": "Linking Road, Bandra West",
        "city": "Mumbai",
        "state": "Maharashtra",
        "pincode": "400050",
        "profile_extra": {
            "markup": "1.100",
            "sellback_pct": "2.250",
            "sellback_fixed": "18.00",
            "making": "920.00",
            "deposit_apr": "4.750",
            "loan_apr": "13.250",
            "deposit_note": "Locker-linked deposits and loan APRs are illustrative for this demo storefront.",
        },
    },
    {
        "email": "dummy.jeweller.bengaluru@cridora.test",
        "first_name": "Dummy",
        "last_name": "Bengaluru",
        "phone": "9999910003",
        "business_name": "Garden City Ornaments — Bengaluru",
        "gstin": "29AABCU9603R1ZX",
        "shop_address": "Koramangala 5th Block",
        "city": "Bengaluru",
        "state": "Karnataka",
        "pincode": "560095",
        "profile_extra": {
            "markup": "1.600",
            "sellback_pct": "1.800",
            "sellback_fixed": "14.50",
            "making": "790.00",
            "deposit_apr": "5.250",
            "loan_apr": "12.750",
            "deposit_note": "Demo storefront — compare rates and disclosures with other partner cards.",
        },
    },
)


class Command(BaseCommand):
    help = "Create Cridora admin, customer, and jeweller test users (jeweller KYB docs verified) for local UI/API testing."

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default=os.environ.get("CRIDORA_SEED_PASSWORD") or _DEFAULT_PASSWORD,
            help="Password for seeded accounts (default: env CRIDORA_SEED_PASSWORD or built-in demo password).",
        )

    def handle(self, *args, **options):
        password = options["password"] or _DEFAULT_PASSWORD

        self._seed_admin(password)
        self._seed_customer(password)
        self._seed_jeweller(password)
        self._seed_dummy_jewellers(password)
        self._ensure_marketplace_demo()
        self._ensure_gold_upi_demo()

        self.stdout.write(self.style.SUCCESS("\nDone. Sign in at /login with:"))
        self.stdout.write("  Cridora admin   admin@cridora.test")
        self.stdout.write("  Customer (user) customer@cridora.test  -> SPA /userdashboard")
        self.stdout.write("  Jeweller        jeweller@cridora.test")
        self.stdout.write("  Demo jewellers (same password):")
        for row in _DUMMY_JEWELLERS:
            self.stdout.write(f"    {row['email']}")
        self.stdout.write(f"  Password        (the value you set; default demo: {_DEFAULT_PASSWORD})")
        self.stdout.write("  Django admin    http://127.0.0.1:8000/admin/  (use admin account; staff enabled)")

    def _attach_verified_kyb(self, user, now):
        for doc_type in _JEWELLER_ESSENTIAL_TYPES:
            doc, _ = KYDocument.objects.get_or_create(
                user=user,
                doc_type=doc_type,
                defaults={
                    "original_filename": f"{doc_type}_seed.pdf",
                    "status": KYDocument.DOC_VERIFIED,
                    "rejection_reason": "",
                    "reviewed_at": now,
                },
            )
            if not doc.file:
                doc.original_filename = f"{doc_type}_seed.pdf"
                doc.status = KYDocument.DOC_VERIFIED
                doc.reviewed_at = now
                doc.file.save(
                    f"{doc_type}_seed.pdf",
                    ContentFile(_PLACEHOLDER_PDF),
                    save=True,
                )
            else:
                doc.status = KYDocument.DOC_VERIFIED
                doc.reviewed_at = now
                doc.save(update_fields=["status", "reviewed_at"])

    def _seed_admin(self, password: str):
        email = "admin@cridora.test"
        if User.objects.filter(email__iexact=email).exists():
            self.stdout.write(self.style.WARNING(f"  [skip] Already exists: {email}"))
            return

        now = timezone.now()
        user = User(
            username=email,
            email=email,
            first_name="Cridora",
            last_name="Admin",
            user_type=User.ADMIN,
            is_staff=True,
            is_superuser=True,
            kyc_status=User.KYC_VERIFIED,
            kyc_verified_at=now,
        )
        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(f"  [ok] Admin: {email}"))

    def _seed_customer(self, password: str):
        email = "customer@cridora.test"
        if User.objects.filter(email__iexact=email).exists():
            self.stdout.write(self.style.WARNING(f"  [skip] Already exists: {email}"))
            return

        user = User(
            username=email,
            email=email,
            first_name="Demo",
            last_name="Customer",
            phone="9999900002",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_PENDING,
        )
        user.set_password(password)
        user.save()
        self.stdout.write(self.style.SUCCESS(f"  [ok] Customer: {email} (KYC pending; User dashboard / KYC tab)"))

    def _seed_jeweller(self, password: str):
        email = "jeweller@cridora.test"
        if User.objects.filter(email__iexact=email).exists():
            self.stdout.write(self.style.WARNING(f"  [skip] Already exists: {email}"))
            return

        now = timezone.now()
        user = User(
            username=email,
            email=email,
            first_name="Demo",
            last_name="Jeweller",
            phone="9999900001",
            user_type=User.JEWELLER,
            business_name="Demo Gold House — Hyderabad",
            gstin="36AABCT1332B1Z5",
            shop_address="12-2-823, S.R. Nagar",
            city="Hyderabad",
            state="Telangana",
            pincode="500038",
            kyc_status=User.KYC_VERIFIED,
            kyc_verified_at=now,
        )
        user.set_password(password)
        user.save()

        self._attach_verified_kyb(user, now)

        self.stdout.write(self.style.SUCCESS(f"  [ok] Jeweller: {email} (KYB docs seeded as verified)"))

    def _seed_dummy_jewellers(self, password: str):
        now = timezone.now()
        created_any = False
        for row in _DUMMY_JEWELLERS:
            email = row["email"]
            if User.objects.filter(email__iexact=email).exists():
                continue
            user = User(
                username=email,
                email=email,
                first_name=row["first_name"],
                last_name=row["last_name"],
                phone=row["phone"],
                user_type=User.JEWELLER,
                business_name=row["business_name"],
                gstin=row["gstin"],
                shop_address=row["shop_address"],
                city=row["city"],
                state=row["state"],
                pincode=row["pincode"],
                kyc_status=User.KYC_VERIFIED,
                kyc_verified_at=now,
            )
            user.set_password(password)
            user.save()
            self._attach_verified_kyb(user, now)
            created_any = True
            self.stdout.write(self.style.SUCCESS(f"  [ok] Demo jeweller: {email}"))
        if not created_any:
            self.stdout.write(self.style.WARNING("  [skip] Demo jewellers already exist."))

    def _apply_pricing_profile(self, profile, pe: dict):
        from decimal import Decimal

        profile.default_gold_markup_percent = Decimal(pe["markup"])
        profile.sellback_deduction_percent = Decimal(pe["sellback_pct"])
        profile.sellback_fixed_inr_per_gram = Decimal(pe["sellback_fixed"])
        profile.gold_deposit_note = pe["deposit_note"]
        profile.representative_making_charge_inr_per_gram = Decimal(pe["making"])
        profile.buyback_headline_inr_per_gram = None
        profile.gold_deposit_yield_apr_percent = Decimal(pe["deposit_apr"])
        profile.gold_loan_interest_apr_percent = Decimal(pe["loan_apr"])

    def _upsert_demo_products(self, jeweller, samples: list):
        from decimal import Decimal

        from apps.marketplace.models import MarketplaceProduct

        base_defaults = {
            "moderation_status": MarketplaceProduct.MOD_APPROVED,
            "is_published": True,
            "is_x_redeem": True,
            "pricing_mode": MarketplaceProduct.PRICING_SPOT_MARKUP,
        }
        for row in samples:
            name = row["name"]
            payload = {k: v for k, v in row.items() if k != "name"}
            MarketplaceProduct.objects.update_or_create(
                jeweller=jeweller,
                name=name,
                defaults={**base_defaults, **payload},
            )

    def _ensure_marketplace_demo(self):
        from decimal import Decimal

        from apps.marketplace.models import JewellerPricingProfile, MarketplaceProduct, get_or_create_ticker

        get_or_create_ticker()

        jeweller = User.objects.filter(
            email__iexact="jeweller@cridora.test", user_type=User.JEWELLER
        ).first()
        if jeweller:
            profile, _ = JewellerPricingProfile.objects.get_or_create(jeweller=jeweller)
            self._apply_pricing_profile(
                profile,
                {
                    "markup": "1.250",
                    "sellback_pct": "2.000",
                    "sellback_fixed": "15.00",
                    "making": "720.00",
                    "deposit_apr": "5.500",
                    "loan_apr": "12.000",
                    "deposit_note": (
                        "Vault gold credited to this showroom settles per Cridora ledger (T+1). "
                        "Indicative sellback uses the rates shown on each listing."
                    ),
                },
            )
            profile.save()

            samples = [
                {
                    "name": "Traditional Palakka Necklace",
                    "category": "Necklaces",
                    "gold_weight_grams": Decimal("12.500"),
                    "making_charge_per_gram": Decimal("650.00"),
                    "image_url": "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=600",
                    "stone_included": True,
                    "stone_type": "Synthetic ruby — temple accents",
                    "stone_weight_grams": Decimal("0.120"),
                    "stone_cost_inr": Decimal("4200.00"),
                    "rating": Decimal("4.9"),
                },
                {
                    "name": "Temple Work Bangles",
                    "category": "Bangles",
                    "gold_weight_grams": Decimal("24.000"),
                    "making_charge_per_gram": Decimal("850.00"),
                    "image_url": "https://images.unsplash.com/photo-1535633302704-c02fbcaf8c51?auto=format&fit=crop&q=80&w=600",
                    "stone_included": False,
                    "stone_type": "",
                    "stone_weight_grams": None,
                    "stone_cost_inr": None,
                    "rating": Decimal("4.8"),
                },
                {
                    "name": "24K 10g Gold Coin",
                    "category": "Investment Coins",
                    "gold_weight_grams": Decimal("10.000"),
                    "making_charge_per_gram": Decimal("150.00"),
                    "image_url": "https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&q=80&w=600",
                    "stone_included": False,
                    "stone_type": "",
                    "stone_weight_grams": None,
                    "stone_cost_inr": None,
                    "rating": Decimal("5.0"),
                },
            ]
            self._upsert_demo_products(jeweller, samples)

        dummy_products = {
            "dummy.jeweller.kochi@cridora.test": [
                {
                    "name": "Kasavu Temple Jhumka",
                    "category": "Earrings",
                    "gold_weight_grams": Decimal("8.250"),
                    "making_charge_per_gram": Decimal("720.00"),
                    "image_url": "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&q=80&w=600",
                    "stone_included": True,
                    "stone_type": "CZ cluster",
                    "stone_weight_grams": Decimal("0.080"),
                    "stone_cost_inr": Decimal("1800.00"),
                    "rating": Decimal("4.7"),
                },
                {
                    "name": "Antique Mango Mala",
                    "category": "Necklaces",
                    "gold_weight_grams": Decimal("45.000"),
                    "making_charge_per_gram": Decimal("690.00"),
                    "image_url": "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=600",
                    "stone_included": False,
                    "stone_type": "",
                    "stone_weight_grams": None,
                    "stone_cost_inr": None,
                    "rating": Decimal("4.8"),
                },
                {
                    "name": "Heritage Broad Ring",
                    "category": "Rings",
                    "gold_weight_grams": Decimal("6.100"),
                    "making_charge_per_gram": Decimal("610.00"),
                    "image_url": "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?auto=format&fit=crop&q=80&w=600",
                    "stone_included": False,
                    "stone_type": "",
                    "stone_weight_grams": None,
                    "stone_cost_inr": None,
                    "rating": Decimal("4.6"),
                },
            ],
            "dummy.jeweller.mumbai@cridora.test": [
                {
                    "name": "Contemporary Layered Chain",
                    "category": "Chains",
                    "gold_weight_grams": Decimal("18.750"),
                    "making_charge_per_gram": Decimal("550.00"),
                    "image_url": "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&q=80&w=600",
                    "stone_included": False,
                    "stone_type": "",
                    "stone_weight_grams": None,
                    "stone_cost_inr": None,
                    "rating": Decimal("4.9"),
                },
                {
                    "name": "Diamond Accent Bangle Pair",
                    "category": "Bangles",
                    "gold_weight_grams": Decimal("31.200"),
                    "making_charge_per_gram": Decimal("980.00"),
                    "image_url": "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&q=80&w=600",
                    "stone_included": True,
                    "stone_type": "Diamond chips",
                    "stone_weight_grams": Decimal("0.040"),
                    "stone_cost_inr": Decimal("12500.00"),
                    "rating": Decimal("4.9"),
                },
                {
                    "name": "Minimal Signet Ring",
                    "category": "Rings",
                    "gold_weight_grams": Decimal("5.400"),
                    "making_charge_per_gram": Decimal("890.00"),
                    "image_url": "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=600",
                    "stone_included": False,
                    "stone_type": "",
                    "stone_weight_grams": None,
                    "stone_cost_inr": None,
                    "rating": Decimal("4.5"),
                },
            ],
            "dummy.jeweller.bengaluru@cridora.test": [
                {
                    "name": "Office Daily Wear Chain",
                    "category": "Chains",
                    "gold_weight_grams": Decimal("14.000"),
                    "making_charge_per_gram": Decimal("480.00"),
                    "image_url": "https://images.unsplash.com/photo-1587477105781-5fa09dfef7c7?auto=format&fit=crop&q=80&w=600",
                    "stone_included": False,
                    "stone_type": "",
                    "stone_weight_grams": None,
                    "stone_cost_inr": None,
                    "rating": Decimal("4.6"),
                },
                {
                    "name": "Bridal Choker Set",
                    "category": "Necklaces",
                    "gold_weight_grams": Decimal("52.500"),
                    "making_charge_per_gram": Decimal("920.00"),
                    "image_url": "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=600",
                    "stone_included": True,
                    "stone_type": "Polki style accents",
                    "stone_weight_grams": Decimal("0.200"),
                    "stone_cost_inr": Decimal("8900.00"),
                    "rating": Decimal("4.95"),
                },
                {
                    "name": "Stackable Slim Bangle",
                    "category": "Bangles",
                    "gold_weight_grams": Decimal("16.800"),
                    "making_charge_per_gram": Decimal("740.00"),
                    "image_url": "https://images.unsplash.com/photo-1535633302704-c02fbcaf8c51?auto=format&fit=crop&q=80&w=600",
                    "stone_included": False,
                    "stone_type": "",
                    "stone_weight_grams": None,
                    "stone_cost_inr": None,
                    "rating": Decimal("4.7"),
                },
            ],
        }

        for row in _DUMMY_JEWELLERS:
            email = row["email"]
            u = User.objects.filter(email__iexact=email, user_type=User.JEWELLER).first()
            if not u:
                self.stdout.write(self.style.WARNING(f"  [skip] Marketplace dummy: no user {email}"))
                continue
            profile, _ = JewellerPricingProfile.objects.get_or_create(jeweller=u)
            self._apply_pricing_profile(profile, row["profile_extra"])
            profile.save()
            self._upsert_demo_products(u, dummy_products[email])

        if jeweller:
            self.stdout.write(self.style.SUCCESS("  [ok] Marketplace: primary jeweller catalog + profiles."))
        self.stdout.write(self.style.SUCCESS("  [ok] Marketplace: 3 dummy jewellers x 3 products (idempotent upsert)."))

    def _ensure_gold_upi_demo(self):
        from decimal import Decimal

        from apps.accounts.gold_identity import compute_gold_upi
        from apps.accounts.models import GoldBalance

        now = timezone.now()
        j_primary = User.objects.filter(
            email__iexact="jeweller@cridora.test", user_type=User.JEWELLER
        ).first()
        if j_primary:
            if not j_primary.jeweller_code:
                j_primary.jeweller_code = "demogold"
            if not j_primary.gold_handle_local:
                j_primary.gold_handle_local = "demovault"
            j_primary.save(update_fields=["jeweller_code", "gold_handle_local"])
            j_primary.gold_upi = compute_gold_upi(j_primary)
            j_primary.save(update_fields=["gold_upi"])
            gb, _ = GoldBalance.objects.get_or_create(
                user=j_primary, defaults={"balance_grams": Decimal("500")}
            )
            if gb.balance_grams < Decimal("100"):
                gb.balance_grams = Decimal("500")
                gb.save(update_fields=["balance_grams"])

        u_customer = User.objects.filter(email__iexact="customer@cridora.test").first()
        if u_customer and j_primary:
            u_customer.kyc_status = User.KYC_VERIFIED
            u_customer.kyc_verified_at = now
            u_customer.default_jeweller = j_primary
            if not u_customer.gold_handle_local:
                u_customer.gold_handle_local = "democustomer"
            u_customer.save(
                update_fields=[
                    "kyc_status",
                    "kyc_verified_at",
                    "default_jeweller",
                    "gold_handle_local",
                ]
            )
            u_customer.gold_upi = compute_gold_upi(u_customer)
            u_customer.save(update_fields=["gold_upi"])
            gbc, _ = GoldBalance.objects.get_or_create(
                user=u_customer, defaults={"balance_grams": Decimal("50")}
            )
            if gbc.balance_grams < Decimal("10"):
                gbc.balance_grams = Decimal("50")
                gbc.save(update_fields=["balance_grams"])

        for email, code, handle_sfx in (
            ("dummy.jeweller.kochi@cridora.test", "heritagekochi", "showroom_kochi"),
            ("dummy.jeweller.mumbai@cridora.test", "metrogold", "showroom_mumbai"),
            ("dummy.jeweller.bengaluru@cridora.test", "gardencity", "showroom_blr"),
        ):
            u = User.objects.filter(email__iexact=email, user_type=User.JEWELLER).first()
            if not u:
                continue
            u.jeweller_code = code
            if not u.gold_handle_local:
                u.gold_handle_local = handle_sfx
            u.save(update_fields=["jeweller_code", "gold_handle_local"])
            u.gold_upi = compute_gold_upi(u)
            u.save(update_fields=["gold_upi"])
            GoldBalance.objects.get_or_create(
                user=u, defaults={"balance_grams": Decimal("200")}
            )

        self.stdout.write(
            self.style.SUCCESS(
                "  [ok] GoldUPI demo: customer democustomer@demogold (50g) <-> jeweller demovault@demogold (500g); "
                "dummy showrooms showroom@heritagekochi, etc."
            )
        )
