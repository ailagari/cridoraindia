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

    def test_customer_personal_profile_patch(self):
        reg = self.client.post(
            "/api/v1/auth/register/",
            {
                "email": "profile_patch@example.com",
                "password": "securepass12",
                "first_name": "Old",
                "last_name": "Name",
                "phone": "9876543210",
            },
            format="json",
        )
        self.assertEqual(reg.status_code, 201)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {reg.data['access']}")
        patch = self.client.patch(
            "/api/v1/customer/profile/",
            {
                "first_name": "New",
                "last_name": "Customer",
                "phone": "+91 98765 43211",
            },
            format="json",
        )
        self.assertEqual(patch.status_code, 200)
        self.assertEqual(patch.data.get("first_name"), "New")
        self.assertEqual(patch.data.get("last_name"), "Customer")
        self.assertEqual(patch.data.get("phone"), "+91 98765 43211")

    def test_password_change_for_customer(self):
        reg = self.client.post(
            "/api/v1/auth/register/",
            {
                "email": "pw_change@example.com",
                "password": "oldpass1234",
                "first_name": "Pw",
                "last_name": "Change",
            },
            format="json",
        )
        self.assertEqual(reg.status_code, 201)
        old_refresh = reg.data["refresh"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {reg.data['access']}")
        bad = self.client.post(
            "/api/v1/auth/password/change/",
            {"current_password": "wrong", "new_password": "newpass1234"},
            format="json",
        )
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post(
            "/api/v1/auth/password/change/",
            {
                "current_password": "oldpass1234",
                "new_password": "newpass5678",
                "refresh": old_refresh,
            },
            format="json",
        )
        self.assertEqual(ok.status_code, 200)
        self.assertIn("access", ok.data)
        login_old = self.client.post(
            "/api/v1/auth/login/",
            {"email": "pw_change@example.com", "password": "oldpass1234"},
            format="json",
        )
        self.assertEqual(login_old.status_code, 400)
        login_new = self.client.post(
            "/api/v1/auth/login/",
            {"email": "pw_change@example.com", "password": "newpass5678"},
            format="json",
        )
        self.assertEqual(login_new.status_code, 200)

    def test_password_change_for_jeweller(self):
        reg = self.client.post(
            "/api/v1/auth/jeweller/apply/",
            {
                "email": "jeweller_pw@example.com",
                "password": "oldpass1234",
                "first_name": "J",
                "last_name": "W",
                "business_name": "PW Jewellers",
                "shop_address": "1 Road",
                "city": "Mumbai",
                "state": "MH",
                "pincode": "400001",
            },
            format="json",
        )
        self.assertEqual(reg.status_code, 201)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {reg.data['access']}")
        ok = self.client.post(
            "/api/v1/auth/password/change/",
            {"current_password": "oldpass1234", "new_password": "newpass5678"},
            format="json",
        )
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.data.get("user_type"), "jeweller")
