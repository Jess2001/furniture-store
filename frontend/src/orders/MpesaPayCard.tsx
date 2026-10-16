import { useState, type FormEvent } from "react";

import { Icon } from "../components/Icon";
import { errorMessage } from "../lib/api";
import { formatKES } from "../lib/format";
import type { Order } from "../lib/types";
import { usePayWithMpesa } from "./useOrders";

export function MpesaPayCard({ order }: { order: Order }) {
  const pay = usePayWithMpesa();
  const [phone, setPhone] = useState(order.shipping_address.recipient_phone);

  const payment = order.payment;
  const waiting = payment?.status === "PENDING";
  const failed =
    payment?.status === "FAILED" || payment?.status === "CANCELLED";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    pay.mutate({ orderNumber: order.order_number, phone });
  };

  return (
    <form
      onSubmit={submit}
      className="bg-surface-container-lowest rounded-3xl p-space-lg shadow-sm space-y-space-md"
    >
      <div>
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Pay with M-Pesa
        </h2>
        <p className="font-body-md text-body-md text-secondary mt-1">
          We&apos;ll send a prompt for {formatKES(order.total_amount)} to your
          phone. Enter your M-Pesa PIN to confirm the order.
        </p>
      </div>

      <div>
        <label
          htmlFor="mpesa-phone"
          className="block font-label-caps text-label-caps uppercase text-secondary mb-1"
        >
          M-Pesa phone number
        </label>
        <input
          id="mpesa-phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="0712 345 678"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="w-full h-12 px-4 rounded-xl bg-surface-container-lowest border border-outline-variant font-body-md text-body-md text-on-surface focus:border-primary outline-none"
        />
      </div>

      {waiting && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl bg-tertiary/10 text-on-surface p-space-md font-body-sm text-body-sm"
        >
          <Icon
            name="progress_activity"
            className="text-[20px] animate-spin text-tertiary"
          />
          <span>
            We&apos;ve sent a prompt to your phone. Enter your M-Pesa PIN to
            finish. This page updates by itself.
          </span>
        </div>
      )}

      {failed && !waiting && (
        <div
          role="alert"
          className="rounded-xl bg-error-container text-on-error-container p-space-md font-body-sm text-body-sm"
        >
          {payment?.failure_reason || "The payment did not go through."} You can
          try again below.
        </div>
      )}

      {pay.isError && (
        <div
          role="alert"
          className="rounded-xl bg-error-container text-on-error-container p-space-md font-body-sm text-body-sm"
        >
          {errorMessage(pay.error)}
        </div>
      )}

      <button
        type="submit"
        disabled={pay.isPending}
        className="w-full h-14 rounded-full bg-primary-container text-on-primary font-label-lg text-label-lg hover:bg-primary transition-colors disabled:opacity-50"
      >
        {pay.isPending
          ? "Sending…"
          : waiting
            ? "Resend prompt"
            : failed
              ? "Try again"
              : "Send M-Pesa prompt"}
      </button>
    </form>
  );
}
