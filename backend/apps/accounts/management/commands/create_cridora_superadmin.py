"""One login for Django /admin/ and Cridora SPA admin (/login → /dashboard/admin)."""

import getpass
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

User = get_user_model()


class Command(BaseCommand):
    help = (
        "Create or update a user who is both Django superuser (/admin/) and Cridora admin "
        "(user_type=admin for JWT /api/v1/admin/* and SPA dashboard)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            default=os.environ.get("CRIDORA_ADMIN_EMAIL", "").strip(),
            help="Login email (default: env CRIDORA_ADMIN_EMAIL).",
        )
        parser.add_argument(
            "--password",
            default=os.environ.get("CRIDORA_ADMIN_PASSWORD", ""),
            help="Password (default: env CRIDORA_ADMIN_PASSWORD); omit to prompt securely.",
        )

    def handle(self, *args, **options):
        email_raw = (options.get("email") or "").strip()
        if not email_raw:
            raise CommandError(
                "Provide --email or set CRIDORA_ADMIN_EMAIL (e.g. on Railway variables)."
            )
        email = email_raw.lower()
        password = (options.get("password") or "").strip()

        if not password:
            p1 = getpass.getpass("Password: ")
            p2 = getpass.getpass("Password (again): ")
            if p1 != p2:
                raise CommandError("Passwords do not match.")
            password = p1
        if len(password) < 8:
            raise CommandError("Password must be at least 8 characters.")

        now = timezone.now()
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            user = User(username=email, email=email)
            self.stdout.write(self.style.NOTICE(f"Creating user {email}"))
        else:
            self.stdout.write(self.style.NOTICE(f"Updating existing user {email}"))

        user.username = email
        user.email = email
        user.user_type = User.ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.kyc_status = User.KYC_VERIFIED
        user.kyc_verified_at = now
        user.set_password(password)
        user.save()

        self.stdout.write(
            self.style.SUCCESS(
                "Done. Same credentials for:\n"
                "  - Django admin   -> /admin/\n"
                "  - Cridora admin  -> POST /api/v1/auth/login/ then /dashboard/admin/"
            )
        )
