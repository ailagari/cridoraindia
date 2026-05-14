"""SPA login upgrades Django superusers to Cridora admin user_type."""

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

User = get_user_model()


class LoginSuperuserSyncTests(APITestCase):
    def test_superuser_spa_login_sets_platform_admin_user_type(self):
        User.objects.create_superuser(
            username="su_sync@example.com",
            email="su_sync@example.com",
            password="superpass12",
        )
        u = User.objects.get(email__iexact="su_sync@example.com")
        self.assertEqual(u.user_type, User.CUSTOMER)

        res = self.client.post(
            "/api/v1/auth/login/",
            {"email": "su_sync@example.com", "password": "superpass12"},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data.get("user_type"), User.ADMIN)

        u.refresh_from_db()
        self.assertEqual(u.user_type, User.ADMIN)
        self.assertEqual(u.kyc_status, User.KYC_VERIFIED)
