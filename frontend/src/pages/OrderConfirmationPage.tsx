import { Link, useParams, useSearchParams } from "react-router-dom";

import { Icon } from "../components/Icon";
import { useUi } from "../hooks/UiContext";
import { errorMessage } from "../lib/api";
import { formatKES } from "../lib/format";
import { OrderTracker, statusLabel } from "../orders/OrderTracker";
import { useCancelOrder, useOrder } from "../orders/useOrders";
import { MpesaPayCard } from "../orders/MpesaPayCard";
export function OrderConfirmationPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [params] = useSearchParams();
  const justPlaced = params.get("placed") === "1";
  const { data: order, isLoading, isError } = useOrder(orderNumber);
  const cancel = useCancelOrder();
  const { showToast } = useUi();

  if (isLoading) {
    return (
      <section className="w-full bg-surface py-space-2xl">
        <p className="max-w-7xl mx-auto px-margin lg:px-margin-desktop font-body-md text-body-md text-secondary">
          Loading your order…
        </p>
      </section>
    );
  }

  if (isError || !order) {
    return (
      <section className="w-full bg-surface py-space-2xl">
        <div className="max-w-md mx-auto px-margin text-center space-y-space-md">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            We couldn&apos;t find that order
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Make sure you&apos;re signed in to the account that placed it.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center h-12 px-space-lg rounded-full bg-on-surface text-on-secondary font-label-lg text-label-lg hover:bg-primary transition-colors"
          >
            Back to the shop
          </Link>
        </div>
      </section>
    );
  }

  const address = order.shipping_address;
  const canCancel = order.can_cancel ?? order.status === "PENDING_PAYMENT";
  const holdUntil =
    order.status === "PENDING_PAYMENT" && order.reservation_expires_at
      ? new Date(order.reservation_expires_at).toLocaleTimeString("en-KE", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  const onCancel = () => {
    if (
      !window.confirm(
        "Cancel this order? Your reserved pieces will be released.",
      )
    )
      return;
    cancel.mutate(order.order_number, {
      onSuccess: () => showToast("Your order has been cancelled."),
    });
  };

  return (
    <section className="w-full bg-surface py-space-2xl">
      <div className="max-w-3xl mx-auto px-margin lg:px-0">
        <div className="text-center mb-space-xl">
          {justPlaced && (
            <div className="mx-auto mb-space-md flex h-16 w-16 items-center justify-center rounded-full bg-tertiary/10 text-tertiary">
              <Icon name="check_circle" filled className="text-[36px]" />
            </div>
          )}
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            {justPlaced
              ? `Thank you, ${address.recipient_name.split(" ")[0]}`
              : `Order ${order.order_number}`}
          </h1>
          <p className="font-body-md text-body-md text-secondary mt-1">
            {justPlaced && (
              <>
                Order{" "}
                <span className="font-semibold text-on-surface">
                  {order.order_number}
                </span>{" "}
                ·{" "}
              </>
            )}
            {statusLabel[order.status] ?? order.status} · placed{" "}
            {new Date(order.created_at).toLocaleDateString("en-KE", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="bg-surface-container-low rounded-3xl p-space-lg mb-space-md">
          <OrderTracker status={order.status} />
        </div>
        {order.status === "PENDING_PAYMENT" && (
          <div className="mb-space-md">
            <MpesaPayCard order={order} />
          </div>
        )}

        <div className="bg-surface-container-low rounded-3xl p-space-lg space-y-space-md">
          <ul className="space-y-space-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4">
                <div>
                  <p className="font-title text-title text-on-surface">
                    {item.product_name}
                  </p>
                  <p className="font-body-sm text-body-sm text-secondary">
                    {item.variant_name} · Qty {item.quantity}
                  </p>
                </div>
                <span className="font-currency-price text-currency-price text-on-surface">
                  {formatKES(item.line_total)}
                </span>
              </li>
            ))}
          </ul>

          <div className="pt-space-md border-t border-surface-variant space-y-2 font-body-md text-body-md">
            <div className="flex justify-between text-on-surface">
              <span>Subtotal</span>
              <span>{formatKES(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-on-surface">
              <span>Delivery</span>
              <span>{formatKES(order.shipping_fee)}</span>
            </div>
            <div className="flex justify-between font-title text-title text-on-surface pt-2">
              <span>Total</span>
              <span>{formatKES(order.total_amount)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md mt-space-md">
          <div className="bg-surface-container-low rounded-3xl p-space-lg">
            <h2 className="font-label-caps text-label-caps uppercase text-secondary mb-2">
              Delivering to
            </h2>
            <p className="font-body-md text-body-md text-on-surface">
              {address.recipient_name}
              <br />
              {address.address_line_1}
              {address.address_line_2 && (
                <>
                  <br />
                  {address.address_line_2}
                </>
              )}
              <br />
              {address.city}, {address.county}
              <br />
              {address.recipient_phone}
            </p>
          </div>
          <div className="bg-surface-container-low rounded-3xl p-space-lg">
            <h2 className="font-label-caps text-label-caps uppercase text-secondary mb-2">
              What happens next
            </h2>
            <p className="font-body-md text-body-md text-on-surface">
              {order.status === "PENDING_PAYMENT"
                ? `Pay with M-Pesa above to confirm your order.${holdUntil ? ` Your pieces are reserved until ${holdUntil}.` : ""}`
                : order.status === "CANCELLED"
                  ? "This order is closed. You can browse the shop and place a new one any time."
                  : order.payment?.receipt
                    ? `Payment received (M-Pesa ${order.payment.receipt}). We'll start preparing your order and keep this page updated.`
                    : "We'll keep this page updated as your order moves along."}
            </p>
          </div>
        </div>

        {cancel.isError && (
          <div
            role="alert"
            className="mt-space-md rounded-xl bg-error-container text-on-error-container p-space-md font-body-sm text-body-sm"
          >
            {errorMessage(cancel.error)}
          </div>
        )}

        <div className="mt-space-xl flex flex-wrap items-center justify-center gap-space-sm">
          <Link
            to="/shop"
            className="inline-flex items-center h-12 px-space-lg rounded-full bg-on-surface text-on-secondary font-label-lg text-label-lg hover:bg-primary transition-colors"
          >
            Continue shopping
          </Link>
          <Link
            to="/account/orders"
            className="inline-flex items-center h-12 px-space-lg rounded-full border border-on-surface text-on-surface font-label-lg text-label-lg hover:bg-on-surface hover:text-on-secondary transition-colors"
          >
            All my orders
          </Link>
          {canCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={cancel.isPending}
              className="h-12 px-space-lg rounded-full text-error font-label-lg text-label-lg hover:bg-error-container transition-colors disabled:opacity-50"
            >
              {cancel.isPending ? "Cancelling…" : "Cancel order"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
