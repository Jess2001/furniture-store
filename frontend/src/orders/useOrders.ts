import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { CheckoutPayload, Order, OrderListItem, Page } from "../lib/types";

/** While an M-Pesa prompt is waiting on the customer, look again this often... */
const POLL_MS = 3000;
/** ...for this long. After that we stop and let them resend. */
const POLL_WINDOW_MS = 3 * 60 * 1000;

export function useCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CheckoutPayload) =>
      api<Order>("/orders/checkout/", { method: "POST", body: payload }),
    onSuccess: (order) => {
      queryClient.setQueryData(["order", order.order_number], order);
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useOrder(orderNumber: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["order", orderNumber],
    queryFn: () => api<Order>(`/orders/${orderNumber}/`),
    enabled: Boolean(user && orderNumber),
    refetchInterval: (query) => {
      const payment = query.state.data?.payment;
      if (payment?.status !== "PENDING") return false;
      const age = Date.now() - new Date(payment.created_at).getTime();
      return age < POLL_WINDOW_MS ? POLL_MS : false;
    },
  });
}

export function useOrders(page: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["orders", page],
    queryFn: () => api<Page<OrderListItem>>(`/orders/?page=${page}`),
    enabled: Boolean(user),
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderNumber: string) =>
      api<Order>(`/orders/${orderNumber}/cancel/`, { method: "POST" }),
    onSuccess: (order) => {
      queryClient.setQueryData(["order", order.order_number], order);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function usePayWithMpesa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderNumber,
      phone,
    }: {
      orderNumber: string;
      phone: string;
    }) =>
      api<{ payment_id: string; status: string }>("/payments/mpesa/pay/", {
        method: "POST",
        body: { order_number: orderNumber, phone },
      }),
    onSuccess: (_result, { orderNumber }) => {
      // the order now carries a PENDING payment, which switches the polling on
      queryClient.invalidateQueries({ queryKey: ["order", orderNumber] });
    },
  });
}
