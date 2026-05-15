from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    BankAccountUpsertView,
    CustomerRegisterView,
    HealthView,
    JewellerApplyView,
    JewellerBusinessProfileView,
    KYDocumentListView,
    KYDocumentUploadView,
    LoginView,
    LogoutView,
    MeView,
)
from .views_gold import (
    DefaultJewellerView,
    GoldIdentityUpsertView,
    GoldTransferCreateView,
    GoldTransferPublicMetaView,
    GoldUPIResolveView,
    GoldWalletView,
)
from .views_admin import (
    AdminCustomerKYCActionView,
    AdminDocumentRequestReuploadView,
    AdminFreezeUserView,
    AdminJewellerKYBActionView,
    AdminNotificationsListView,
    AdminNotificationsMarkReadView,
    AdminOverviewView,
    AdminUserDocumentsView,
    AdminVerificationRevokeView,
)
from .fractional_views import (
    FractionalCounterOtpIssueView,
    FractionalOrderConfirmUpiView,
    FractionalOrdersView,
    FractionalQuoteView,
    JewellerFractionalPendingView,
    JewellerFractionalVerifyView,
)
from .views_push import (
    WebPushAdminSelfTestView,
    WebPushSubscribeView,
    WebPushUnsubscribeView,
    WebPushVapidPublicKeyView,
)
urlpatterns = [
    path("push/vapid-public-key/", WebPushVapidPublicKeyView.as_view()),
    path("push/subscribe/", WebPushSubscribeView.as_view()),
    path("push/unsubscribe/", WebPushUnsubscribeView.as_view()),
    path("admin/push/test/", WebPushAdminSelfTestView.as_view()),
    path("health/", HealthView.as_view()),
    path("auth/login/", LoginView.as_view()),
    path("auth/register/", CustomerRegisterView.as_view()),
    path("auth/jeweller/apply/", JewellerApplyView.as_view()),
    path("auth/me/", MeView.as_view()),
    path("jeweller/business-profile/", JewellerBusinessProfileView.as_view()),
    path("gold/wallet/", GoldWalletView.as_view()),
    path("gold/resolve/", GoldUPIResolveView.as_view()),
    path("gold/transfers/", GoldTransferCreateView.as_view()),
    path("gold/identity/", GoldIdentityUpsertView.as_view()),
    path("gold/default-jeweller/", DefaultJewellerView.as_view()),
    path("gold/pay/<path:gold_upi>/", GoldTransferPublicMetaView.as_view()),
    path("fractional/quote/", FractionalQuoteView.as_view()),
    path("fractional/orders/", FractionalOrdersView.as_view()),
    path(
        "fractional/orders/<int:pk>/counter-otp/",
        FractionalCounterOtpIssueView.as_view(),
    ),
    path(
        "fractional/orders/<int:pk>/confirm-upi/",
        FractionalOrderConfirmUpiView.as_view(),
    ),
    path("jeweller/fractional/pending/", JewellerFractionalPendingView.as_view()),
    path(
        "jeweller/fractional/orders/<int:pk>/verify/",
        JewellerFractionalVerifyView.as_view(),
    ),
    path("auth/token/refresh/", TokenRefreshView.as_view()),
    path("auth/logout/", LogoutView.as_view()),
    path("kyc/bank/", BankAccountUpsertView.as_view()),
    path("kyc/documents/", KYDocumentListView.as_view()),
    path("kyc/documents/upload/", KYDocumentUploadView.as_view()),
    path("admin/overview/", AdminOverviewView.as_view()),
    path("admin/notifications/", AdminNotificationsListView.as_view()),
    path("admin/notifications/mark-read/", AdminNotificationsMarkReadView.as_view()),
    path(
        "admin/users/<int:user_id>/documents/",
        AdminUserDocumentsView.as_view(),
    ),
    path(
        "admin/users/<int:user_id>/kyc/<str:action>/",
        AdminCustomerKYCActionView.as_view(),
    ),
    path(
        "admin/users/<int:user_id>/kyb/<str:action>/",
        AdminJewellerKYBActionView.as_view(),
    ),
    path(
        "admin/users/<int:user_id>/verification/revoke/",
        AdminVerificationRevokeView.as_view(),
    ),
    path(
        "admin/users/<int:user_id>/documents/<int:doc_id>/request-reupload/",
        AdminDocumentRequestReuploadView.as_view(),
    ),
    path("admin/users/<int:user_id>/freeze/", AdminFreezeUserView.as_view()),
]
