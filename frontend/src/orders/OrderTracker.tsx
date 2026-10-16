import { Icon } from "../components/Icon";

export const statusLabel: Record<string, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const steps = [
  { status: "PENDING_PAYMENT", label: "Order placed" },
  { status: "PAID", label: "Payment received" },
  { status: "PROCESSING", label: "Processing" },
  { status: "SHIPPED", label: "Shipped" },
  { status: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { status: "DELIVERED", label: "Delivered" },
];

export function OrderTracker({ status }: { status: string }) {
  if (status === "CANCELLED") {
    return (
      <div className="rounded-2xl bg-error-container text-on-error-container p-space-md font-body-md text-body-md">
        This order was cancelled and the reserved stock has been released.
      </div>
    );
  }

  const current = steps.findIndex((step) => step.status === status);

  return (
    <ol className="grid grid-cols-2 sm:grid-cols-6 gap-space-md">
      {steps.map((step, index) => {
        const done = index <= current;
        return (
          <li
            key={step.status}
            className="flex sm:flex-col items-center sm:text-center gap-2"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                done
                  ? "bg-primary-container text-on-primary"
                  : "bg-surface-container text-outline"
              }`}
            >
              {done ? <Icon name="check" className="text-[18px]" /> : index + 1}
            </span>
            <span
              className={`font-label-md text-label-md ${
                done ? "text-on-surface font-semibold" : "text-secondary"
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
