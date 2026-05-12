from django.urls import path

from .views import (
    AdminGoldTickerView,
    AdminMarketplaceProductListView,
    AdminMarketplaceProductModerateView,
    JewellerPricingProfileView,
    JewellerProductDetailView,
    JewellerProductListCreateView,
    MarketplaceGoldTickerPublicView,
    MarketplaceJewellerDetailPublicView,
    MarketplaceJewellersPublicView,
    MarketplaceProductsPublicView,
)

urlpatterns = [
    path("marketplace/gold-ticker/", MarketplaceGoldTickerPublicView.as_view()),
    path("marketplace/jewellers/", MarketplaceJewellersPublicView.as_view()),
    path("marketplace/jewellers/<int:pk>/", MarketplaceJewellerDetailPublicView.as_view()),
    path("marketplace/products/", MarketplaceProductsPublicView.as_view()),
    path("jeweller/marketplace/profile/", JewellerPricingProfileView.as_view()),
    path("jeweller/marketplace/products/", JewellerProductListCreateView.as_view()),
    path("jeweller/marketplace/products/<int:pk>/", JewellerProductDetailView.as_view()),
    path("admin/gold-ticker/", AdminGoldTickerView.as_view()),
    path("admin/marketplace/products/", AdminMarketplaceProductListView.as_view()),
    path(
        "admin/marketplace/products/<int:pk>/moderate/",
        AdminMarketplaceProductModerateView.as_view(),
    ),
]
