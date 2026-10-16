import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/useCart";
import { Icon } from "../components/Icon";
import { useCheckout } from "../orders/useOrders";
import { designImages } from "../content/images";
import { errorMessage } from "../lib/api";
import { formatKES, pickImage } from "../lib/format";
const inputClass =
  "w-full h-12 px-4 rounded-xl bg-surface-container-lowest border border-outline-variant font-body-md text-body-md text-on-surface focus:border-primary outline-none";
const labelClass =
  "block font-label-caps text-label-caps uppercase text-secondary mb-1";

const emptyForm = {
  recipient_name: "",
  recipient_phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  county: "",
  postal_code: "",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="w-full bg-surface py-space-2xl">
      <div className="max-w-7xl mx-auto px-margin lg:px-margin-desktop">
        {children}
      </div>
    </section>
  );
}

export function CheckoutPage() {
  const { user, loading, openAuth } = useAuth();
  const { data: cart, isLoading: cartLoading, refetch } = useCart();
  const checkout = useCheckout();
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);

  // pre-fill from the account once it has loaded
  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      recipient_name:
        current.recipient_name || `${user.first_name} ${user.last_name}`.trim(),
      recipient_phone: current.recipient_phone || user.phone || "",
    }));
  }, [user]);

  const set =
    (field: keyof typeof emptyForm) => (event: ChangeEvent<HTMLInputElement>) =>
      setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!cart) return;
    checkout.mutate(
      { ...form, expected_subtotal: cart.subtotal },
      {
        onSuccess: (order) => navigate(`/order/${order.order_number}`),
        // on a stock or price problem, reload the cart so the page shows the truth
        onError: () => {
          refetch();
        },
      },
    );
  };

  if (loading || (user && cartLoading)) {
    return (
      <Shell>
        <p className="font-body-md text-body-md text-secondary">Loading…</p>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <div className="max-w-md mx-auto text-center space-y-space-md py-space-xl">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Sign in to check out
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Your cart is saved to your account, so we need you signed in before
            placing an order.
          </p>
          <button
            type="button"
            onClick={openAuth}
            className="h-12 px-space-lg rounded-full bg-primary-container text-on-primary font-label-lg text-label-lg hover:bg-primary transition-colors"
          >
            Sign in or create an account
          </button>
        </div>
      </Shell>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <Shell>
        <div className="max-w-md mx-auto text-center space-y-space-md py-space-xl">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Your cart is empty
          </h1>
          <p className="font-body-md text-body-md text-secondary">
            Add a piece you love, then come back to check out.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center h-12 px-space-lg rounded-full bg-on-surface text-on-secondary font-label-lg text-label-lg hover:bg-primary transition-colors"
          >
            Browse the shop
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-semibold">
        Checkout
      </span>
      <h1 className="font-headline-lg text-headline-lg text-on-surface mt-1 mb-space-xl">
        Delivery details
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
        <form
          onSubmit={submit}
          className="lg:col-span-7 bg-surface-container-low rounded-3xl p-space-lg space-y-space-md"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
            <div>
              <label htmlFor="co-name" className={labelClass}>
                Full name
              </label>
              <input
                id="co-name"
                className={inputClass}
                required
                autoComplete="name"
                value={form.recipient_name}
                onChange={set("recipient_name")}
              />
            </div>
            <div>
              <label htmlFor="co-phone" className={labelClass}>
                Phone / WhatsApp
              </label>
              <input
                id="co-phone"
                type="tel"
                className={inputClass}
                required
                autoComplete="tel"
                placeholder="+254 700 000 000"
                value={form.recipient_phone}
                onChange={set("recipient_phone")}
              />
            </div>
          </div>

          <div>
            <label htmlFor="co-address1" className={labelClass}>
              Street address
            </label>
            <input
              id="co-address1"
              className={inputClass}
              required
              autoComplete="address-line1"
              placeholder="e.g. Ngong Road, Karen"
              value={form.address_line_1}
              onChange={set("address_line_1")}
            />
          </div>

          <div>
            <label htmlFor="co-address2" className={labelClass}>
              Apartment, estate or landmark (optional)
            </label>
            <input
              id="co-address2"
              className={inputClass}
              autoComplete="address-line2"
              value={form.address_line_2}
              onChange={set("address_line_2")}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
            <div>
              <label htmlFor="co-city" className={labelClass}>
                Town / city
              </label>
              <input
                id="co-city"
                className={inputClass}
                required
                autoComplete="address-level2"
                value={form.city}
                onChange={set("city")}
              />
            </div>
            <div>
              <label htmlFor="co-county" className={labelClass}>
                County
              </label>
              <input
                id="co-county"
                className={inputClass}
                required
                placeholder="e.g. Nairobi"
                autoComplete="address-level1"
                value={form.county}
                onChange={set("county")}
              />
            </div>
            <div>
              <label htmlFor="co-postal" className={labelClass}>
                Postal code (optional)
              </label>
              <input
                id="co-postal"
                className={inputClass}
                autoComplete="postal-code"
                value={form.postal_code}
                onChange={set("postal_code")}
              />
            </div>
          </div>

          {checkout.isError && (
            <div
              role="alert"
              className="rounded-xl bg-error-container text-on-error-container p-space-md font-body-sm text-body-sm"
            >
              {errorMessage(checkout.error)}
            </div>
          )}

          {cart.has_problems && (
            <div
              role="alert"
              className="rounded-xl bg-error-container text-on-error-container p-space-md font-body-sm text-body-sm"
            >
              Some items in your cart are no longer available in the quantity
              you chose. Open your cart to fix them before placing the order.
            </div>
          )}

          <button
            type="submit"
            disabled={checkout.isPending || cart.has_problems}
            className="w-full h-14 rounded-full bg-primary-container text-on-primary font-label-lg text-label-lg hover:bg-primary transition-colors disabled:opacity-50"
          >
            {checkout.isPending ? "Placing your order…" : "Place order"}
          </button>
          <p className="font-body-sm text-body-sm text-secondary text-center">
            We reserve your pieces for 30 minutes once you place the order.
          </p>
        </form>

        <aside className="lg:col-span-5 lg:sticky lg:top-36 bg-surface-container-lowest rounded-3xl p-space-lg shadow-sm">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-space-md">
            Order summary
          </h2>
          <ul className="space-y-space-md">
            {cart.items.map((item) => (
              <li key={item.id} className="flex gap-3">
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-container">
                  <img
                    src={pickImage(
                      item.product.image_url,
                      designImages.products[item.product.slug],
                    )}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <p className="font-title text-title text-on-surface">
                    {item.product.name}
                  </p>
                  <p className="font-body-sm text-body-sm text-secondary">
                    {item.variant.name} · Qty {item.quantity}
                  </p>
                </div>
                <span className="font-currency-price text-currency-price text-on-surface">
                  {formatKES(item.line_total)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-space-md pt-space-md border-t border-surface-variant space-y-2">
            <div className="flex justify-between font-body-md text-body-md text-on-surface">
              <span>Subtotal</span>
              <span>{formatKES(cart.subtotal)}</span>
            </div>
            <div className="flex justify-between font-body-sm text-body-sm text-secondary">
              <span>Delivery</span>
              <span>Calculated when you place the order</span>
            </div>
          </div>
          <p className="mt-space-md flex items-start gap-2 font-body-sm text-body-sm text-secondary">
            <Icon name="lock" className="text-[16px] mt-0.5" />
            Online payment isn&apos;t connected yet. After you order, our team
            will contact you to arrange payment.
          </p>
        </aside>
      </div>
    </Shell>
  );
}
