import { useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { formatKES } from "../lib/format";
import { statusLabel } from "../orders/OrderTracker";
import { useOrders } from "../orders/useOrders";

const chipTone = (status: string) =>
  status === "CANCELLED"
    ? "bg-error-container text-on-error-container"
    : status === "DELIVERED"
      ? "bg-tertiary/10 text-tertiary"
      : "bg-surface-container text-on-surface";

export function AccountOrdersPage() {
  const { user, loading, openAuth } = useAuth();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useOrders(page);

  if (loading) {
    return (
      <section className="w-full bg-surface py-space-2xl">
        <p className="max-w-7xl mx-auto px-margin lg:px-margin-desktop font-body-md text-body-md text-secondary">
          Loading…
        </p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="w-full bg-surface py-space-2xl">
        <div className="max-w-md mx-auto px-margin text-center space-y-space-md">
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Sign in to see your orders
          </h1>
          <button
            type="button"
            onClick={openAuth}
            className="h-12 px-space-lg rounded-full bg-primary-container text-on-primary font-label-lg text-label-lg hover:bg-primary transition-colors"
          >
            Sign in or create an account
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full bg-surface py-space-2xl">
      <div className="max-w-4xl mx-auto px-margin lg:px-0">
        <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-semibold">
          My account
        </span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface mt-1">
          Jambo, {user.first_name || "there"}
        </h1>
        <p className="font-body-md text-body-md text-secondary mt-1 mb-space-xl">
          Your orders and their progress.
        </p>

        {isLoading && (
          <p className="font-body-md text-body-md text-secondary">
            Loading your orders…
          </p>
        )}
        {isError && (
          <div
            role="alert"
            className="rounded-xl bg-error-container text-on-error-container p-space-md font-body-sm text-body-sm"
          >
            We could not load your orders right now.
          </div>
        )}

        {data && data.results.length === 0 && (
          <div className="rounded-3xl bg-surface-container-low p-space-xl text-center space-y-space-md">
            <p className="font-body-md text-body-md text-secondary">
              You haven&apos;t placed an order yet.
            </p>
            <Link
              to="/shop"
              className="inline-flex items-center h-12 px-space-lg rounded-full bg-on-surface text-on-secondary font-label-lg text-label-lg hover:bg-primary transition-colors"
            >
              Browse the shop
            </Link>
          </div>
        )}

        <ul className="space-y-space-md">
          {data?.results.map((order) => (
            <li key={order.id}>
              <Link
                to={`/order/${order.order_number}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-space-lg hover:bg-surface-container transition-colors"
              >
                <div>
                  <p className="font-title text-title text-on-surface">
                    {order.order_number}
                  </p>
                  <p className="font-body-sm text-body-sm text-secondary">
                    {new Date(order.created_at).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {order.item_count}{" "}
                    {order.item_count === 1 ? "item" : "items"}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`rounded-full px-3 py-1 font-label-md text-label-md ${chipTone(order.status)}`}
                  >
                    {statusLabel[order.status] ?? order.status}
                  </span>
                  <span className="font-currency-price text-currency-price text-on-surface">
                    {formatKES(order.total_amount)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {data && (data.previous || data.next) && (
          <div className="mt-space-lg flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={!data.previous}
              onClick={() => setPage((p) => p - 1)}
              className="h-10 px-space-md rounded-full bg-surface-container text-on-surface font-label-md text-label-md disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!data.next}
              onClick={() => setPage((p) => p + 1)}
              className="h-10 px-space-md rounded-full bg-surface-container text-on-surface font-label-md text-label-md disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
