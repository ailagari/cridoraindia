from django.urls import path

from .spot_prices import MarketplaceSpotPricesView
from .views import (
    AdminGoldTickerView,
    AdminSpotPricesView,
    AdminMarketplaceProductListView,
    AdminMarketplaceProductModerateView,
    JewellerPricingProfileView,
    JewellerMarketplaceLogoUploadView,
    JewellerProductImageUploadView,
    JewellerProductDetailView,
    JewellerProductListCreateView,
    MarketplaceCatalogMetaView,
    MarketplaceGoldTickerHistoryView,
    MarketplaceGoldTickerPublicView,
    MarketplaceJewellerDetailPublicView,
    MarketplaceJewellersPublicView,
    MarketplaceProductPublicDetailView,
    MarketplaceProductsPublicView,
)
from .redemption_views import VaultRedemptionConfirmView, VaultRedemptionQuoteView

urlpatterns = [
    path("marketplace/spot-prices/", MarketplaceSpotPricesView.as_view()),
    path("marketplace/catalog-meta/", MarketplaceCatalogMetaView.as_view()),
    path("marketplace/gold-ticker/history/", MarketplaceGoldTickerHistoryView.as_view()),
    path("marketplace/gold-ticker/", MarketplaceGoldTickerPublicView.as_view()),
    path("marketplace/jewellers/", MarketplaceJewellersPublicView.as_view()),
    path("marketplace/jewellers/<int:pk>/", MarketplaceJewellerDetailPublicView.as_view()),
    path("marketplace/products/<int:pk>/", MarketplaceProductPublicDetailView.as_view()),
    path("marketplace/products/", MarketplaceProductsPublicView.as_view()),
    path(
        "marketplace/redemption/quote/",
        VaultRedemptionQuoteView.as_view(),
    ),
    path(
        "marketplace/redemption/confirm/",
        VaultRedemptionConfirmView.as_view(),
    ),
    path("jeweller/marketplace/profile/", JewellerPricingProfileView.as_view()),
    path("jeweller/marketplace/logo/", JewellerMarketplaceLogoUploadView.as_view()),
    path("jeweller/marketplace/product-image/", JewellerProductImageUploadView.as_view()),
    path("jeweller/marketplace/products/", JewellerProductListCreateView.as_view()),
    path("jeweller/marketplace/products/<int:pk>/", JewellerProductDetailView.as_view()),
    path("admin/gold-ticker/", AdminGoldTickerView.as_view()),
    path("admin/spot-prices/", AdminSpotPricesView.as_view()),
    path("admin/marketplace/products/", AdminMarketplaceProductListView.as_view()),
    path(
        "admin/marketplace/products/<int:pk>/moderate/",
        AdminMarketplaceProductModerateView.as_view(),
    ),
]
