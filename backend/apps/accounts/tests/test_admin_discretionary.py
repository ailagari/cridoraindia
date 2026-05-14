"""Admin may approve KYC/KYB without complete uploads (discretionary policy)."""

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import KYDocument

User = get_user_model()


class AdminDiscretionaryApproveTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_disp@example.com",
            email="admin_disp@example.com",
            password="adminpass12",
            user_type=User.ADMIN,
        )

    def test_approve_customer_without_documents_or_bank(self):
        customer = User.objects.create_user(
            username="bare_cust@example.com",
            email="bare_cust@example.com",
            password="custpass12",
            user_type=User.CUSTOMER,
        )
        self.client.force_authenticate(self.admin)
        res = self.client.post(
            f"/api/v1/admin/users/{customer.id}/kyc/approve/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        customer.refresh_from_db()
        self.assertEqual(customer.kyc_status, User.KYC_VERIFIED)

    def test_approve_jeweller_without_documents(self):
        jeweller = User.objects.create_user(
            username="bare_jwl@example.com",
            email="bare_jwl@example.com",
            password="jwlpass12",
            user_type=User.JEWELLER,
            business_name="Bare Shop",
            gstin="27AAAAA0000A1Z5",
            shop_address="1 Lane",
            city="Pune",
            state="Maharashtra",
            pincode="411001",
        )
        self.client.force_authenticate(self.admin)
        res = self.client.post(
            f"/api/v1/admin/users/{jeweller.id}/kyb/approve/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        jeweller.refresh_from_db()
        self.assertEqual(jeweller.kyc_status, User.KYC_VERIFIED)

    def test_approve_already_verified_returns_400(self):
        customer = User.objects.create_user(
            username="ver_cust@example.com",
            email="ver_cust@example.com",
            password="custpass12",
            user_type=User.CUSTOMER,
            kyc_status=User.KYC_VERIFIED,
        )
        self.client.force_authenticate(self.admin)
        res = self.client.post(
            f"/api/v1/admin/users/{customer.id}/kyc/approve/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_admin_revoke_verification_returns_jeweller_to_pending(self):
        jeweller = User.objects.create_user(
            username="revoke_jwl@example.com",
            email="revoke_jwl@example.com",
            password="jwlpass12",
            user_type=User.JEWELLER,
            business_name="Revoke Shop",
            gstin="",
            shop_address="1 Lane",
            city="Pune",
            state="Maharashtra",
            pincode="411001",
            kyc_status=User.KYC_VERIFIED,
        )
        jeweller.kyc_verified_at = timezone.now()
        jeweller.save(update_fields=["kyc_verified_at"])
        self.client.force_authenticate(self.admin)
        res = self.client.post(
            f"/api/v1/admin/users/{jeweller.id}/verification/revoke/",
            {},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        jeweller.refresh_from_db()
        self.assertEqual(jeweller.kyc_status, User.KYC_PENDING)
        self.assertIsNone(jeweller.kyc_verified_at)

    def test_admin_document_request_reupload_sets_pending(self):
        jeweller = User.objects.create_user(
            username="reup_jwl@example.com",
            email="reup_jwl@example.com",
            password="jwlpass12",
            user_type=User.JEWELLER,
            business_name="Reup Shop",
            gstin="",
            shop_address="1 Lane",
            city="Pune",
            state="Maharashtra",
            pincode="411001",
            kyc_status=User.KYC_VERIFIED,
        )
        jeweller.kyc_verified_at = timezone.now()
        jeweller.save(update_fields=["kyc_verified_at"])
        pdf = SimpleUploadedFile(
            "doc.pdf",
            b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n",
            content_type="application/pdf",
        )
        doc = KYDocument.objects.create(
            user=jeweller,
            doc_type=KYDocument.PAN_BUSINESS,
            file=pdf,
            original_filename="doc.pdf",
        )
        self.client.force_authenticate(self.admin)
        res = self.client.post(
            f"/api/v1/admin/users/{jeweller.id}/documents/{doc.id}/request-reupload/",
            {"reason": "Illegible scan"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        jeweller.refresh_from_db()
        self.assertEqual(jeweller.kyc_status, User.KYC_PENDING)
        self.assertIsNone(jeweller.kyc_verified_at)
        doc.refresh_from_db()
        self.assertEqual(doc.status, KYDocument.DOC_REJECTED)
        self.assertIn("Illegible", doc.rejection_reason)
