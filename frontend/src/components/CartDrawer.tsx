import { useAuth } from "../auth/AuthContext";
import { useCart, useCartActions } from "../cart/useCart";
import { useUi } from "../hooks/UiContext";
import { errorMessage } from "../lib/api";
import { formatKES } from "../lib/format";
import type { CartItem } from "../lib/types";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

const problemText = (item: CartItem): string | null => {
  switch (item.problem) {
    case "unavailable":
      return "No longer available";
    case "out_of_stock":
      return "Out of stock";
    case "insufficient_stock":
      return `Only ${item.max_available} available`;
    default:
      return null;
  }
};

export function CartDrawer() {
  const { cartOpen, setCartOpen, showToast } = useUi();
  const { user } = useAuth();
  const { data: cart, isLoading } = useCart();
  const { setQuantity, remove } = useCartActions();

  const close = () => setCartOpen(false);
  const fail = (error: unknown) => showToast(errorMessage(error));

  return (
    <Modal open={cartOpen && Boolean(user)} onClose={close} labelledBy="cart-title" placement="right">
      <div className="flex items-center justify-between border-b border-surface-variant p-space-md">
        <h2 id="cart-title" className="font-headline-md text-headline-md text-on-surface">Your cart</h2>
        <button type="button" onClick={close} aria-label="Close cart" className="text-secondary hover:text-on-surface">
          <Icon name="close" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-space-md">
        {isLoading && <p className="font-body-sm text-body-sm text-secondary">Loading your cart…</p>}
        {cart && cart.items.length === 0 && (
          <p className="font-body-md text-body-md text-secondary">Your cart is empty. Pick something you love.</p>
        )}

        <ul className="space-y-space-md">
          {cart?.items.map((item) => {
            const problem = problemText(item);
            return (
              <li key={item.id} className="flex gap-3 border-b border-surface-variant pb-space-md">
                <div className="h-20 w-16 shrink-0 overflow-hidden bg-surface-container">
                  {item.product.image_url && (
                    <img src={item.product.image_url} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="font-title text-title text-on-surface">{item.product.name}</span>
                  <span className="font-body-sm text-body-sm text-secondary">{item.variant.name}</span>
                  {problem && (
                    <span className="mt-1 font-label-md text-label-md text-error" role="alert">{problem}</span>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center border border-outline-variant">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${item.product.name}`}
                        disabled={item.quantity <= 1 || setQuantity.isPending}
                        className="h-8 w-8 disabled:opacity-40"
                        onClick={() => setQuantity.mutate({ itemId: item.id, quantity: item.quantity - 1 }, { onError: fail })}
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-label-lg text-label-lg" aria-label="Quantity">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${item.product.name}`}
                        disabled={setQuantity.isPending}
                        className="h-8 w-8 disabled:opacity-40"
                        onClick={() => setQuantity.mutate({ itemId: item.id, quantity: item.quantity + 1 }, { onError: fail })}
                      >
                        +
                      </button>
                    </div>
                    <span className="font-currency-price text-currency-price">{formatKES(item.line_total)}</span>
                  </div>
                  <button
                    type="button"
                    className="mt-1 self-start font-label-md text-label-md text-secondary hover:text-error"
                    onClick={() => remove.mutate(item.id, { onError: fail })}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {cart && cart.items.length > 0 && (
        <div className="border-t border-surface-variant p-space-md">
          <div className="flex items-center justify-between font-title text-title">
            <span>Subtotal</span>
            <span>{formatKES(cart.subtotal)}</span>
          </div>
          <p className="mt-1 font-body-sm text-body-sm text-secondary">Delivery is calculated at checkout.</p>
          <button
            type="button"
            disabled
            title="Checkout arrives with the payments phase"
            className="mt-space-sm h-12 w-full bg-on-surface text-on-secondary font-label-lg text-label-lg opacity-60"
          >
            Checkout (coming soon)
          </button>
        </div>
      )}
    </Modal>
  );
}
