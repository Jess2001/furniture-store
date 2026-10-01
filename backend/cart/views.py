from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Cart, CartItem
from .serializers import AddItemSerializer, CartSerializer, UpdateItemSerializer


def cart_response(user, http_status=status.HTTP_200_OK):
    """Always answer with the whole, fresh cart so the frontend has one source of truth."""
    cart = services.get_or_create_cart(user)
    cart = Cart.objects.prefetch_related(
        Prefetch(
            "items",
            queryset=CartItem.objects.select_related(
                "variant__product__category", "variant__inventory"
            ).prefetch_related("variant__product__images"),
        )
    ).get(pk=cart.pk)
    return Response(CartSerializer(cart).data, status=http_status)


class CartView(APIView):
    def get(self, request):
        return cart_response(request.user)


class CartItemsView(APIView):
    def post(self, request):
        serializer = AddItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cart = services.get_or_create_cart(request.user)
        services.add_item(
            cart,
            serializer.validated_data["variant_id"],
            serializer.validated_data["quantity"],
        )
        return cart_response(request.user, status.HTTP_201_CREATED)


class CartItemDetailView(APIView):
    def _get_item(self, request, pk):
        cart = services.get_or_create_cart(request.user)
        # filtering by the caller's own cart is what stops one customer touching another's items
        return cart, get_object_or_404(CartItem, pk=pk, cart=cart)

    def patch(self, request, pk):
        cart, item = self._get_item(request, pk)
        serializer = UpdateItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.set_quantity(cart, item, serializer.validated_data["quantity"])
        return cart_response(request.user)

    def delete(self, request, pk):
        cart, item = self._get_item(request, pk)
        services.remove_item(cart, item)
        return cart_response(request.user)


class CartClearView(APIView):
    def post(self, request):
        cart = services.get_or_create_cart(request.user)
        services.clear_cart(cart)
        return cart_response(request.user)
