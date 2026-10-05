import { useState, type FormEvent } from "react";

import { Icon } from "../components/Icon";
import { ENQUIRIES_CONNECTED, footerColumns } from "../content/static";
import { useUi } from "../hooks/UiContext";

export function Footer() {
  const { showToast } = useUi();
  const [email, setEmail] = useState("");

  const subscribe = (event: FormEvent) => {
    event.preventDefault();
    // TODO: POST to the newsletter endpoint once it exists (it is not built yet).
    showToast(
      ENQUIRIES_CONNECTED
        ? "You are subscribed. Asante!"
        : "Thanks! Newsletter signup is not connected yet, so nothing was saved.",
    );
    setEmail("");
  };

  return (
    <footer className="bg-inverse-surface text-inverse-on-surface">
      <div className="max-w-7xl mx-auto px-margin lg:px-margin-desktop py-space-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-space-xl">
          <div className="space-y-space-sm">
            <div className="flex flex-col">
              <span className="font-title text-title tracking-[0.15em] font-semibold uppercase leading-none">
                LUXURY
              </span>
              <span className="font-label-caps text-label-caps tracking-[0.25em] uppercase mt-0.5 leading-none opacity-80">
                LIVING
              </span>
            </div>
            <p className="font-body-sm text-body-sm opacity-80">
              Crafting timeless solid wood and upholstered furniture for
              contemporary living. Designed for longevity and everyday comfort.
            </p>
            <ul className="space-y-2 font-body-sm text-body-sm">
              <li className="flex items-start gap-2">
                <Icon name="location_on" className="text-[18px]" /> Karen
                Workshops &amp; Gallery, Ngong Road, Nairobi, Kenya
              </li>
              <li className="flex items-center gap-2">
                <Icon name="call" className="text-[18px]" /> +254 (0) 700 123
                456
              </li>
              <li className="flex items-center gap-2">
                <Icon name="mail" className="text-[18px]" />{" "}
                concierge@LUXURYliving.co.ke
              </li>
            </ul>
          </div>

          {footerColumns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="font-label-lg text-label-lg uppercase tracking-wider mb-space-sm">
                {column.title}
              </h3>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li
                    key={link}
                    className="font-body-sm text-body-sm opacity-80 hover:opacity-100 cursor-default"
                  >
                    {link}
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h3 className="font-label-lg text-label-lg uppercase tracking-wider mb-space-sm">
              Payment &amp; Trust
            </h3>
            <p className="font-body-sm text-body-sm opacity-80 mb-space-sm">
              Subscribe for new season catalogues &amp; private showroom
              previews.
            </p>
            <form onSubmit={subscribe} className="flex">
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="min-w-0 flex-1 h-10 px-3 bg-inverse-on-surface/10 border border-inverse-on-surface/30 font-body-sm text-body-sm outline-none focus:border-primary-fixed"
              />
              <button
                type="submit"
                className="h-10 px-4 bg-primary-container text-on-primary font-label-md text-label-md hover:bg-primary transition-colors"
              >
                Join
              </button>
            </form>
            <p className="mt-space-sm font-label-caps text-label-caps uppercase opacity-80">
              Accepted Secure Payments
            </p>
            <div className="mt-1 flex gap-2 font-label-md text-label-md">
              {["M-PESA", "VISA", "MC"].map((method) => (
                <span
                  key={method}
                  className="border border-inverse-on-surface/40 px-2 py-1"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-space-xl pt-space-md border-t border-inverse-on-surface/20 flex flex-col md:flex-row items-center justify-between gap-2 font-body-sm text-body-sm opacity-80">
          <span>Copyright © LUXURY Living Ltd. All rights reserved.</span>
          <span>Privacy Policy • Terms of Sale • Nairobi, Kenya</span>
        </div>
      </div>
    </footer>
  );
}
