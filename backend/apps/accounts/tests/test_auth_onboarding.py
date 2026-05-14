"""Signup, JWT session, and KYC/KYB document upload API smoke tests."""

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase

User = get_user_model()


class AuthOnboardingApiTests(APITestCase):
    def test_customer_register_returns_jwt_and_lists_documents(self):
        res = self.client.post(
            "/api/v1/auth/register/",
            {
                "email": "customer_flow@example.com",
                "password": "securepass12",
                "first_name": "Test",
                "last_name": "Customer",
                "phone": "",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertIn("access", res.data)
        self.assertEqual(res.data.get("user_type"), "customer")
        self.assertEqual(res.data.get("kyc_status"), User.KYC_PENDING)
        token = res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        doc_res = self.client.get("/api/v1/kyc/documents/")
        self.assertEqual(doc_res.status_code, 200)
        self.assertEqual(doc_res.data, [])

    def test_customer_upload_aadhaar_multipart(self):
        reg = self.client.post(
            "/api/v1/auth/register/",
            {
                "email": "customer_upload@example.com",
                "password": "securepass12",
                "first_name": "Up",
                "last_name": "Load",
            },
            format="json",
        )
        self.assertEqual(reg.status_code, 201)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {reg.data['access']}")
        pdf = SimpleUploadedFile(
            "aadhaar.pdf",
            b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n",
            content_type="application/pdf",
        )
        up = self.client.post(
            "/api/v1/kyc/documents/upload/",
            {"doc_type": "aadhaar", "file": pdf},
            format="multipart",
        )
        self.assertEqual(up.status_code, 201)
        self.assertEqual(up.data.get("doc_type"), "aadhaar")
        listed = self.client.get("/api/v1/kyc/documents/")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(len(listed.data), 1)

    def test_jeweller_apply_returns_jwt(self):
        res = self.client.post(
            "/api/v1/auth/jeweller/apply/",
            {
                "email": "jeweller_flow@example.com",
                "password": "securepass12",
                "first_name": "Shop",
                "last_name": "Owner",
                "phone": "",
                "business_name": "Test Jewellers",
                "gstin": "27AAAAA0000A1Z5",
                "shop_address": "123 MG Road",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertIn("access", res.data)
        self.assertEqual(res.data.get("user_type"), "jeweller")
        self.assertEqual(res.data.get("kyc_status"), User.KYC_PENDING)

    def test_jeweller_apply_without_gstin_accepted(self):
        res = self.client.post(
            "/api/v1/auth/jeweller/apply/",
            {
                "email": "jeweller_nogst@example.com",
                "password": "securepass12",
                "first_name": "Shop",
                "last_name": "Owner",
                "phone": "",
                "business_name": "No GST Yet",
                "shop_address": "123 MG Road",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400001",
            },
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        token = res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        me = self.client.get("/api/v1/auth/me/")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.data.get("gstin"), "")

    def test_jeweller_business_profile_patch_sets_gstin(self):
        reg = self.client.post(
            "/api/v1/auth/jeweller/apply/",
            {
                "email": "jeweller_patch@example.com",
                "password": "securepass12",
                "first_name": "Shop",
                "last_name": "Owner",
                "phone": "",
                "business_name": "Patch Jewellers",
                "shop_address": "1 MG Road",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pincode": "400002",
            },
            format="json",
        )
        self.assertEqual(reg.status_code, 201)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {reg.data['access']}")
        patch = self.client.patch(
            "/api/v1/jeweller/business-profile/",
            {"gstin": "27AAAAA0000A1Z5", "business_name": "Patch Jewellers Pvt Ltd"},
            format="json",
        )
        self.assertEqual(patch.status_code, 200)
        self.assertEqual(patch.data.get("gstin"), "27AAAAA0000A1Z5")
        self.assertEqual(patch.data.get("business_name"), "Patch Jewellers Pvt Ltd")
