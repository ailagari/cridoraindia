"""Admin may approve KYC/KYB without complete uploads (discretionary policy)."""

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

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
