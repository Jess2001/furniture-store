from django.urls import path

from .views import CartClearView, CartItemDetailView, CartItemsView, CartView

urlpatterns = [
    path("", CartView.as_view(), name="cart"),
    path("items/", CartItemsView.as_view(), name="cart-items"),
    path("items/<uuid:pk>/", CartItemDetailView.as_view(), name="cart-item"),
    path("clear/", CartClearView.as_view(), name="cart-clear"),
]
