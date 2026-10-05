import { Link } from "react-router-dom";

import { Icon } from "../components/Icon";

export function BespokeStrip() {
  return (
    <section className="w-full bg-surface-container-high py-space-2xl px-margin md:px-margin-tablet lg:px-margin-desktop shadow-inner">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-space-xl">
        <div className="flex items-start gap-space-md max-w-2xl">
          <div className="w-12 h-12 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center shrink-0 shadow-sm">
            <Icon name="architecture" className="text-[24px]" />
          </div>
          <div className="space-y-1">
            <h3 className="font-headline-md text-headline-md text-on-surface font-normal">
              Need custom dimensions or specific timber matching?
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Our Karen workshop crafts bespoke pieces tailored for high-end
              residential interiors and hospitality spaces. Collaborate directly
              with our master joiners on grain selection, dimensions, and custom
              upholstery swatches.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-space-md shrink-0 w-full sm:w-auto">
          <a
            className="px-6 py-3.5 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-md text-label-md tracking-wider uppercase transition-colors shadow-sm text-center flex-1 sm:flex-initial"
            href="tel:+254700123456"
          >
            Call Atelier
          </a>
          <Link
            to="/#showroom-booking"
            className="px-7 py-3.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md tracking-wider uppercase transition-colors shadow-md text-center flex-1 sm:flex-initial"
          >
            Book Material Consultation
          </Link>
        </div>
      </div>
    </section>
  );
}
