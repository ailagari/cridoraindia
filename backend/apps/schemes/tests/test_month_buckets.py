from django.test import TestCase

from apps.schemes.services.presets import preset_design
from apps.schemes.services.scheme_design_compiler import compile_scheme_design
from apps.schemes.services.month_bucket_service import plan_month_for_date
from apps.schemes.models import CustomerSchemeEnrollment
from datetime import date


class MonthBucketTests(TestCase):
    def test_plan_month_from_anchor(self):
        enrollment = CustomerSchemeEnrollment(cycle_anchor_date=date(2025, 1, 15))
        self.assertEqual(plan_month_for_date(enrollment, date(2025, 1, 20)), 1)
        self.assertEqual(plan_month_for_date(enrollment, date(2025, 3, 1)), 3)
