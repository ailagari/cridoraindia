"""API integration tests for admin → jeweller → customer scheme flows."""

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.platform_features import set_feature_flags
from apps.marketplace.models import JewellerPricingProfile, jeweller_profile_for
from apps.schemes.models import (
    CustomerSchemeEnrollment,
    JewellerSchemeOffering,
    SchemeTemplate,
)
from apps.schemes.services.presets import preset_design
from apps.schemes.services.scheme_design_compiler import compile_scheme_design, human_flow_summary

User = get_user_model()


def _minimal_design():
    return preset_design("eleven_plus_one_jewellery_pool")


class SchemeApiFlowTests(TestCase):
    def setUp(self):
        set_feature_flags({"golden_scheme": True})
        self.client = APIClient()
        self.admin = User.objects.create_user(
            "admin@scheme.test",
            "pass",
            user_type=User.ADMIN,
            kyc_status=User.KYC_VERIFIED,
        )
        self.jeweller = User.objects.create_user(
            "jewel@scheme.test",
            "pass",
            user_type=User.JEWELLER,
            kyc_status=User.KYC_VERIFIED,
            business_name="Test Jewellers",
        )
        self.customer = User.objects.create_user(
            "cust@scheme.test",
            "pass",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        )
        design = _minimal_design()
        self.draft = SchemeTemplate.objects.create(
            slug="test-draft-scheme",
            name="Test Draft Scheme",
            scheme_design=design,
            scheme_rules=compile_scheme_design(design),
            flow_summary=human_flow_summary(design),
            status=SchemeTemplate.STATUS_DRAFT,
        )

    def test_admin_create_publish_deprecate_duplicate_delete(self):
        self.client.force_authenticate(self.admin)

        res = self.client.post(
            "/api/v1/admin/schemes/templates/",
            {
                "name": "API Draft",
                "scheme_design": _minimal_design(),
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        draft_id = res.json()["id"]

        preview = self.client.post(
            f"/api/v1/admin/schemes/templates/{draft_id}/preview/",
            {"scheme_design": _minimal_design(), "sample_deposit_inr": 5000},
            format="json",
        )
        self.assertEqual(preview.status_code, 200)
        self.assertIn("deposit_quote", preview.json())

        pub = self.client.post(f"/api/v1/admin/schemes/templates/{draft_id}/publish/", {}, format="json")
        self.assertEqual(pub.status_code, 200)
        self.assertEqual(pub.json()["status"], "published")

        dup = self.client.post(f"/api/v1/admin/schemes/templates/{draft_id}/duplicate/", {}, format="json")
        self.assertEqual(dup.status_code, 201)
        self.assertEqual(dup.json()["status"], "draft")

        dep = self.client.post(f"/api/v1/admin/schemes/templates/{draft_id}/deprecate/", {}, format="json")
        self.assertEqual(dep.status_code, 200)
        self.assertEqual(dep.json()["status"], "deprecated")

        delete_published = self.client.delete(f"/api/v1/admin/schemes/templates/{draft_id}/")
        self.assertEqual(delete_published.status_code, 400)

        delete_draft = self.client.delete(f"/api/v1/admin/schemes/templates/{self.draft.id}/")
        self.assertEqual(delete_draft.status_code, 204)
        self.assertFalse(SchemeTemplate.objects.filter(pk=self.draft.id).exists())

    def test_edit_published_template_syncs_offerings(self):
        design = _minimal_design()
        published = SchemeTemplate.objects.create(
            slug="edit-published",
            name="Published Edit",
            scheme_design=design,
            scheme_rules=compile_scheme_design(design),
            flow_summary=human_flow_summary(design),
            status=SchemeTemplate.STATUS_PUBLISHED,
        )
        offering = JewellerSchemeOffering.objects.create(
            jeweller=self.jeweller,
            scheme_template=published,
            display_name="Old name",
            design_snapshot={"old": True},
            rules_snapshot={"old": True},
        )
        new_design = dict(design)
        new_design["input"] = {**(design.get("input") or {}), "min_deposit_inr": 1000}

        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            f"/api/v1/admin/schemes/templates/{published.id}/",
            {"name": "Updated Published", "scheme_design": new_design},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["name"], "Updated Published")
        self.assertEqual(res.json().get("offerings_synced"), 1)

        offering.refresh_from_db()
        published.refresh_from_db()
        self.assertEqual(offering.design_snapshot, new_design)
        self.assertEqual(offering.rules_snapshot, published.scheme_rules)
        self.assertEqual(published.status, SchemeTemplate.STATUS_PUBLISHED)

    def test_jeweller_catalog_adopt_idempotent(self):
        design = _minimal_design()
        published = SchemeTemplate.objects.create(
            slug="published-catalog",
            name="Catalog Scheme",
            scheme_design=design,
            scheme_rules=compile_scheme_design(design),
            flow_summary=human_flow_summary(design),
            status=SchemeTemplate.STATUS_PUBLISHED,
        )
        SchemeTemplate.objects.create(
            slug="draft-hidden",
            name="Hidden Draft",
            scheme_design=design,
            scheme_rules=compile_scheme_design(design),
            flow_summary=human_flow_summary(design),
            status=SchemeTemplate.STATUS_DRAFT,
        )

        self.client.force_authenticate(self.jeweller)
        catalog = self.client.get("/api/v1/jeweller/schemes/catalog/")
        self.assertEqual(catalog.status_code, 200)
        ids = [t["id"] for t in catalog.json()]
        self.assertIn(published.id, ids)
        self.assertNotIn(self.draft.id, ids)

        adopt1 = self.client.post(
            "/api/v1/jeweller/schemes/offerings/",
            {"template_id": published.id},
            format="json",
        )
        self.assertEqual(adopt1.status_code, 201)

        adopt2 = self.client.post(
            "/api/v1/jeweller/schemes/offerings/",
            {"template_id": published.id},
            format="json",
        )
        self.assertEqual(adopt2.status_code, 201)
        self.assertEqual(
            JewellerSchemeOffering.objects.filter(
                jeweller=self.jeweller, scheme_template=published
            ).count(),
            1,
        )

    def test_customer_multiple_enrollments_including_plan_complete(self):
        design = _minimal_design()

        def _publish(slug: str, name: str) -> SchemeTemplate:
            return SchemeTemplate.objects.create(
                slug=slug,
                name=name,
                scheme_design=design,
                scheme_rules=compile_scheme_design(design),
                flow_summary=human_flow_summary(design),
                status=SchemeTemplate.STATUS_PUBLISHED,
            )

        t1 = _publish("cust-scheme-a", "Scheme A")
        t2 = _publish("cust-scheme-b", "Scheme B")
        o1 = JewellerSchemeOffering.objects.create(
            jeweller=self.jeweller,
            scheme_template=t1,
            display_name="Scheme A",
            design_snapshot=design,
            rules_snapshot=compile_scheme_design(design),
        )
        o2 = JewellerSchemeOffering.objects.create(
            jeweller=self.jeweller,
            scheme_template=t2,
            display_name="Scheme B",
            design_snapshot=design,
            rules_snapshot=compile_scheme_design(design),
        )

        self.client.force_authenticate(self.customer)
        e1 = self.client.post("/api/v1/schemes/enrollments/", {"offering_id": o1.id}, format="json")
        e2 = self.client.post("/api/v1/schemes/enrollments/", {"offering_id": o2.id}, format="json")
        self.assertEqual(e1.status_code, 201)
        self.assertEqual(e2.status_code, 201)
        self.assertEqual(e1.json()["status"], "pending_admission")
        self.assertFalse(e1.json()["payments_enabled"])

        self.client.force_authenticate(self.jeweller)
        admit1 = self.client.post(
            f"/api/v1/jeweller/schemes/offerings/{o1.id}/enrollments/",
            {"customer_id": self.customer.id},
            format="json",
        )
        admit2 = self.client.post(
            f"/api/v1/jeweller/schemes/offerings/{o2.id}/enrollments/",
            {"customer_id": self.customer.id},
            format="json",
        )
        self.assertEqual(admit1.status_code, 201)
        self.assertEqual(admit2.status_code, 201)
        self.assertTrue(admit1.json()["payments_enabled"])

        enroll1 = CustomerSchemeEnrollment.objects.get(pk=e1.json()["id"])
        enroll1.status = CustomerSchemeEnrollment.STATUS_PLAN_MONTH_COMPLETE
        enroll1.save(update_fields=["status"])

        self.client.force_authenticate(self.customer)
        all_rows = self.client.get("/api/v1/schemes/enrollments/")
        self.assertEqual(all_rows.status_code, 200)
        self.assertEqual(len(all_rows.json()), 2)

        active_only = self.client.get("/api/v1/schemes/enrollments/?status=active")
        self.assertEqual(len(active_only.json()), 1)

        complete_only = self.client.get("/api/v1/schemes/enrollments/?status=plan_month_complete")
        self.assertEqual(len(complete_only.json()), 1)

    def test_customer_join_pending_until_jeweller_admits_payment(self):
        design = _minimal_design()
        published = SchemeTemplate.objects.create(
            slug="admit-flow",
            name="Admit Flow",
            scheme_design=design,
            scheme_rules=compile_scheme_design(design),
            flow_summary=human_flow_summary(design),
            status=SchemeTemplate.STATUS_PUBLISHED,
        )
        offering = JewellerSchemeOffering.objects.create(
            jeweller=self.jeweller,
            scheme_template=published,
            display_name="Admit Flow",
            design_snapshot=design,
            rules_snapshot=compile_scheme_design(design),
        )

        self.client.force_authenticate(self.customer)
        join = self.client.post(
            "/api/v1/schemes/enrollments/",
            {"offering_id": offering.id},
            format="json",
        )
        self.assertEqual(join.status_code, 201)
        enrollment_id = join.json()["id"]

        blocked_quote = self.client.post(
            "/api/v1/schemes/contributions/quote/",
            {"enrollment_id": enrollment_id, "amount_inr": 5000},
            format="json",
        )
        self.assertEqual(blocked_quote.status_code, 404)

        self.client.force_authenticate(self.jeweller)
        admit = self.client.post(
            f"/api/v1/jeweller/schemes/offerings/{offering.id}/enrollments/",
            {"customer_id": self.customer.id},
            format="json",
        )
        self.assertEqual(admit.status_code, 201)
        self.assertTrue(admit.json()["payments_enabled"])

        self.client.force_authenticate(self.customer)
        quote = self.client.post(
            "/api/v1/schemes/contributions/quote/",
            {"enrollment_id": enrollment_id, "amount_inr": 5000},
            format="json",
        )
        self.assertEqual(quote.status_code, 200)
        self.assertIn("total_inr", quote.json())

    def test_scheme_upi_payment_payload_includes_qr_uri(self):
        set_feature_flags({"golden_scheme": True, "fractional_upi_reconciliation": True})
        design = _minimal_design()
        published = SchemeTemplate.objects.create(
            slug="upi-scheme",
            name="UPI Scheme",
            scheme_design=design,
            scheme_rules=compile_scheme_design(design),
            flow_summary=human_flow_summary(design),
            status=SchemeTemplate.STATUS_PUBLISHED,
        )
        offering = JewellerSchemeOffering.objects.create(
            jeweller=self.jeweller,
            scheme_template=published,
            display_name="UPI Scheme",
            design_snapshot=design,
            rules_snapshot=compile_scheme_design(design),
        )
        profile = jeweller_profile_for(self.jeweller)
        profile.gold_rate_source = JewellerPricingProfile.GOLD_RATE_MANUAL
        profile.manual_gold_rate_inr_per_gram = 7000
        profile.upi_vpa = "schemejeweller@okicici"
        profile.save()

        self.client.force_authenticate(self.customer)
        enrollment = self.client.post(
            "/api/v1/schemes/enrollments/",
            {"offering_id": offering.id},
            format="json",
        )
        self.assertEqual(enrollment.status_code, 201)
        enrollment_id = enrollment.json()["id"]

        self.client.force_authenticate(self.jeweller)
        admit = self.client.post(
            f"/api/v1/jeweller/schemes/offerings/{offering.id}/enrollments/",
            {"customer_id": self.customer.id},
            format="json",
        )
        self.assertEqual(admit.status_code, 201)

        self.client.force_authenticate(self.customer)
        deposit = self.client.post(
            "/api/v1/schemes/contributions/",
            {
                "enrollment_id": enrollment_id,
                "amount_inr": 5000,
                "payment_method": "upi",
            },
            format="json",
        )
        self.assertEqual(deposit.status_code, 201, deposit.json())
        contribution_id = deposit.json()["id"]

        pay = self.client.get(f"/api/v1/upi/scheme/{contribution_id}/payment/")
        self.assertEqual(pay.status_code, 200, pay.json())
        self.assertTrue(pay.json()["upi_uri"].startswith("upi://pay?"))
        self.assertEqual(pay.json()["payee_vpa"], "schemejeweller@okicici")
        self.assertTrue(pay.json()["can_submit_proof"])

    def test_jeweller_ledger_lists_contributions_and_enrollments(self):
        set_feature_flags({"golden_scheme": True, "fractional_upi_reconciliation": True})
        design = _minimal_design()
        published = SchemeTemplate.objects.create(
            slug="ledger-scheme",
            name="Ledger Scheme",
            scheme_design=design,
            scheme_rules=compile_scheme_design(design),
            flow_summary=human_flow_summary(design),
            status=SchemeTemplate.STATUS_PUBLISHED,
        )
        offering = JewellerSchemeOffering.objects.create(
            jeweller=self.jeweller,
            scheme_template=published,
            display_name="Ledger Scheme",
            design_snapshot=design,
            rules_snapshot=compile_scheme_design(design),
        )

        self.client.force_authenticate(self.customer)
        enrollment = self.client.post(
            "/api/v1/schemes/enrollments/",
            {"offering_id": offering.id},
            format="json",
        )
        enrollment_id = enrollment.json()["id"]

        self.client.force_authenticate(self.jeweller)
        self.client.post(
            f"/api/v1/jeweller/schemes/offerings/{offering.id}/enrollments/",
            {"customer_id": self.customer.id},
            format="json",
        )

        self.client.force_authenticate(self.customer)
        self.client.post(
            "/api/v1/schemes/contributions/",
            {
                "enrollment_id": enrollment_id,
                "amount_inr": 5000,
                "payment_method": "upi",
            },
            format="json",
        )

        self.client.force_authenticate(self.jeweller)
        customers = self.client.get("/api/v1/jeweller/schemes/enrollments/?bucket=ongoing")
        self.assertEqual(customers.status_code, 200)
        self.assertEqual(len(customers.json()["results"]), 1)
        self.assertEqual(customers.json()["results"][0]["deposit_count"], 1)

        payments = self.client.get("/api/v1/jeweller/schemes/contributions/?bucket=pending")
        self.assertEqual(payments.status_code, 200)
        self.assertEqual(len(payments.json()["results"]), 1)
        self.assertIn("scheme_name", payments.json()["results"][0])

    def test_feature_gate_blocks_jeweller_offerings_when_disabled(self):
        set_feature_flags({"golden_scheme": False})
        self.client.force_authenticate(self.jeweller)
        res = self.client.get("/api/v1/jeweller/schemes/offerings/")
        self.assertEqual(res.status_code, 403)
