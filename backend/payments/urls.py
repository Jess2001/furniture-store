from django.urls import path

from .views import MpesaCallbackView, MpesaPayView

urlpatterns = [
    path("mpesa/pay/", MpesaPayView.as_view(), name="mpesa-pay"),
    path(
        "mpesa/callback/<str:token>/",
        MpesaCallbackView.as_view(),
        name="mpesa-callback",
    ),
]
