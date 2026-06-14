from django.urls import path

from apps.schemes.views_admin import (
    AdminSchemeEnrollmentsOverviewView,
    AdminSchemeFromPresetView,
    AdminSchemePresetsView,
    AdminSchemeRequestApproveView,
    AdminSchemeRequestListView,
    AdminSchemeRequestRejectView,
    AdminSchemeTemplateDeprecateView,
    AdminSchemeTemplateDetailView,
    AdminSchemeTemplateListCreateView,
    AdminSchemeTemplatePreviewView,
    AdminSchemeTemplatePublishView,
)
from apps.schemes.views_customer import (
    CustomerSchemeContributionCounterOtpView,
    CustomerSchemeContributionPaymentView,
    CustomerSchemeContributionQuoteView,
    CustomerSchemeContributionsView,
    CustomerSchemeContributionSubmitUtrView,
    CustomerSchemeEnrollmentDetailView,
    CustomerSchemeEnrollmentsView,
    CustomerSchemeOfferingsView,
    CustomerSchemeRedemptionConfirmView,
    CustomerSchemeRedemptionQuoteView,
)
from apps.schemes.views_jeweller import (
    JewellerSchemeCatalogDetailView,
    JewellerSchemeCatalogView,
    JewellerSchemeConfirmBonusView,
    JewellerSchemeContributionApproveView,
    JewellerSchemeContributionRejectView,
    JewellerSchemeContributionsPendingReconciliationView,
    JewellerSchemeContributionsPendingUpiView,
    JewellerSchemeContributionsPendingView,
    JewellerSchemeContributionVerifyView,
    JewellerSchemeOfferingDetailView,
    JewellerSchemeOfferingsView,
    JewellerSchemeRedemptionsView,
    JewellerSchemeRequestCreateView,
)

urlpatterns = [
    # Admin
    path("admin/schemes/templates/", AdminSchemeTemplateListCreateView.as_view()),
    path("admin/schemes/templates/presets/", AdminSchemePresetsView.as_view()),
    path(
        "admin/schemes/templates/from-preset/<str:key>/",
        AdminSchemeFromPresetView.as_view(),
    ),
    path("admin/schemes/templates/<int:pk>/", AdminSchemeTemplateDetailView.as_view()),
    path(
        "admin/schemes/templates/<int:pk>/publish/",
        AdminSchemeTemplatePublishView.as_view(),
    ),
    path(
        "admin/schemes/templates/<int:pk>/deprecate/",
        AdminSchemeTemplateDeprecateView.as_view(),
    ),
    path(
        "admin/schemes/templates/<int:pk>/preview/",
        AdminSchemeTemplatePreviewView.as_view(),
    ),
    path("admin/schemes/requests/", AdminSchemeRequestListView.as_view()),
    path(
        "admin/schemes/requests/<int:pk>/approve/",
        AdminSchemeRequestApproveView.as_view(),
    ),
    path(
        "admin/schemes/requests/<int:pk>/reject/",
        AdminSchemeRequestRejectView.as_view(),
    ),
    path(
        "admin/schemes/enrollments/overview/",
        AdminSchemeEnrollmentsOverviewView.as_view(),
    ),
    # Jeweller
    path("jeweller/schemes/catalog/", JewellerSchemeCatalogView.as_view()),
    path("jeweller/schemes/catalog/<int:pk>/", JewellerSchemeCatalogDetailView.as_view()),
    path("jeweller/schemes/offerings/", JewellerSchemeOfferingsView.as_view()),
    path(
        "jeweller/schemes/offerings/<int:pk>/",
        JewellerSchemeOfferingDetailView.as_view(),
    ),
    path("jeweller/schemes/requests/", JewellerSchemeRequestCreateView.as_view()),
    path(
        "jeweller/schemes/contributions/pending/",
        JewellerSchemeContributionsPendingView.as_view(),
    ),
    path(
        "jeweller/schemes/contributions/pending-upi/",
        JewellerSchemeContributionsPendingUpiView.as_view(),
    ),
    path(
        "jeweller/schemes/contributions/pending-reconciliation/",
        JewellerSchemeContributionsPendingReconciliationView.as_view(),
    ),
    path(
        "jeweller/schemes/contributions/<int:pk>/verify/",
        JewellerSchemeContributionVerifyView.as_view(),
    ),
    path(
        "jeweller/schemes/contributions/<int:pk>/approve/",
        JewellerSchemeContributionApproveView.as_view(),
    ),
    path(
        "jeweller/schemes/contributions/<int:pk>/reject/",
        JewellerSchemeContributionRejectView.as_view(),
    ),
    path(
        "jeweller/schemes/cycles/<int:pk>/confirm-bonus/",
        JewellerSchemeConfirmBonusView.as_view(),
    ),
    path("jeweller/schemes/redemptions/", JewellerSchemeRedemptionsView.as_view()),
    # Customer
    path("schemes/offerings/", CustomerSchemeOfferingsView.as_view()),
    path("schemes/enrollments/", CustomerSchemeEnrollmentsView.as_view()),
    path("schemes/enrollments/<int:pk>/", CustomerSchemeEnrollmentDetailView.as_view()),
    path("schemes/contributions/quote/", CustomerSchemeContributionQuoteView.as_view()),
    path("schemes/contributions/", CustomerSchemeContributionsView.as_view()),
    path(
        "schemes/contributions/<int:pk>/counter-otp/",
        CustomerSchemeContributionCounterOtpView.as_view(),
    ),
    path(
        "schemes/contributions/<int:pk>/payment/",
        CustomerSchemeContributionPaymentView.as_view(),
    ),
    path(
        "schemes/contributions/<int:pk>/submit-utr/",
        CustomerSchemeContributionSubmitUtrView.as_view(),
    ),
    path("schemes/redemptions/quote/", CustomerSchemeRedemptionQuoteView.as_view()),
    path("schemes/redemptions/confirm/", CustomerSchemeRedemptionConfirmView.as_view()),
]
