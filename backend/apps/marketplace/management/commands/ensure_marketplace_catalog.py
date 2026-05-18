from django.core.management.base import BaseCommand

from apps.marketplace.catalog_defaults import ensure_marketplace_catalog_defaults


class Command(BaseCommand):
    help = "Ensure standard India marketplace product categories and metal purities exist (idempotent)."

    def handle(self, *args, **options):
        ensure_marketplace_catalog_defaults()
        self.stdout.write(self.style.SUCCESS("Marketplace catalogue defaults ensured."))
