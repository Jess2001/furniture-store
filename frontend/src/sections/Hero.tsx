import { Link } from "react-router-dom";

import { Icon } from "../components/Icon";
import { designImages } from "../content/images";

export function Hero() {
  return (
    <section
      id="top"
      className="w-full bg-surface border-b border-surface-variant"
    >
      <div className="max-w-7xl mx-auto px-margin lg:px-margin-desktop py-space-xl lg:py-space-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-desktop items-center">
          <div className="lg:col-span-5 flex flex-col justify-center space-y-space-md lg:pr-space-md">
            <div className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-container" />
              <span className="font-label-caps text-label-caps uppercase text-primary font-semibold tracking-widest">
                Atelier &amp; Showroom Nairobi
              </span>
            </div>
            <h1 className="font-display text-display text-on-surface leading-[1.08] tracking-tight">
              Furniture made for living.
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg leading-relaxed">
              Thoughtfully designed solid wood and upholstered pieces for
              comfortable homes, beautiful spaces, and everyday living in East
              Africa.
            </p>
            <div className="pt-space-xs flex flex-wrap items-center gap-space-sm">
              <Link
                className="inline-flex items-center justify-center px-space-lg h-12 bg-primary-container text-on-primary font-label-lg text-label-lg rounded hover:bg-primary transition-all duration-200"
                to="/shop?sort=newest"
              >
                Shop New Arrivals
              </Link>
              <a
                className="inline-flex items-center justify-center px-space-lg h-12 border border-on-secondary-fixed text-on-secondary-fixed font-label-lg text-label-lg rounded hover:bg-on-secondary-fixed hover:text-surface transition-all duration-200"
                href="#room-categories"
              >
                Explore Collections
              </a>
            </div>
            <div className="pt-space-md border-t border-surface-variant/80 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                ["forest", "Kiln-dried hardwoods"],
                ["inventory_2", "Made to order & stock"],
                ["local_shipping", "White-glove assembly"],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-2">
                  <Icon name={icon} className="text-[18px] text-tertiary" />
                  <span className="font-body-sm text-body-sm text-secondary">
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 relative">
            <div className="relative overflow-hidden bg-surface-container aspect-[16/11] lg:aspect-[4/3]">
              <img
                className="w-full h-full object-cover"
                alt="Sunlit modern living room with a sand linen three-seater sofa and a solid teak coffee table"
                src={designImages.hero}
              />
              <div className="absolute bottom-4 left-4 bg-surface/95 backdrop-blur-sm px-4 py-3 border border-surface-variant flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="font-label-caps text-label-caps uppercase text-secondary">
                    Living Room Ensemble
                  </span>
                  <span className="font-title text-title text-on-surface">
                    The Mara Collection in Natural Mvule
                  </span>
                </div>
                <Link
                  className="text-primary hover:text-primary-container text-body-sm font-semibold flex items-center"
                  to="/shop?category=living-room"
                >
                  Explore{" "}
                  <Icon name="arrow_forward" className="text-[16px] ml-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
