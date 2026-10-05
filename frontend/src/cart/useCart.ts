import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import type { Cart } from "../lib/types";

const CART_KEY = ["cart"];

export function useCart() {
  const { user } = useAuth();
  return useQuery({
    queryKey: CART_KEY,
    queryFn: () => api<Cart>("/cart/"),
    enabled: Boolean(user),
  });
}

/** Every cart endpoint answers with the whole updated cart, so we just store what comes back. */
export function useCartActions() {
  const queryClient = useQueryClient();
  const store = (cart: Cart) => queryClient.setQueryData(CART_KEY, cart);

  const add = useMutation({
    mutationFn: ({ variantId, quantity = 1 }: { variantId: string; quantity?: number }) =>
      api<Cart>("/cart/items/", { method: "POST", body: { variant_id: variantId, quantity } }),
    onSuccess: store,
  });

  const setQuantity = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      api<Cart>(`/cart/items/${itemId}/`, { method: "PATCH", body: { quantity } }),
    onSuccess: store,
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => api<Cart>(`/cart/items/${itemId}/`, { method: "DELETE" }),
    onSuccess: store,
  });

  return { add, setQuantity, remove };
}
