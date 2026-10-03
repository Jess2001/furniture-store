from django.urls import path

from .views import CheckoutView, OrderCancelView, OrderDetailView, OrderListView

urlpatterns = [
    path("", OrderListView.as_view(), name="order-list"),
    path(
        "checkout/", CheckoutView.as_view(), name="checkout"
    ),  # before the <order_number> routes
    path("<str:order_number>/", OrderDetailView.as_view(), name="order-detail"),
    path("<str:order_number>/cancel/", OrderCancelView.as_view(), name="order-cancel"),
]
