import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Icon } from "../components/Icon";

const slides = [
  {
    src: "/images/hero2.jpg",
    alt: "Sunlit living room with a sofa and solid wood coffee table",
  },
  {
    src: "/images/hero3.jpg",
    alt: "Dining room with a solid timber table and upholstered chairs",
  },
  {
    src: "/images/hero4.jpg",
    alt: "Calm bedroom with a platform bed and natural linen",
  },
];

export function Hero() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    )?.matches;
    if (reduceMotion) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      id="top"
      className="relative w-full overflow-hidden flex items-center min-h-[calc(100vh-7rem)]"
    >
      {slides.map((slide, i) => (
        <img
          key={slide.src}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
          alt={slide.alt}
          src={slide.src}
          loading={i === 0 ? "eager" : "lazy"}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/10" />

      <div className="relative z-10 w-full px-margin lg:px-margin-desktop py-space-2xl">
        <div className="max-w-xl flex flex-col space-y-space-md">
          <div className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-fixed-dim" />
            <span className="font-label-caps text-label-caps uppercase text-white font-semibold tracking-widest drop-shadow">
              Atelier &amp; Showroom Nairobi
            </span>
          </div>
          <h1 className="font-display text-display-mobile lg:text-[72px] lg:leading-[1.05] text-white tracking-tight drop-shadow-lg">
            Furniture made for living.
          </h1>
          <p className="font-body-lg text-body-lg lg:text-[19px] text-white leading-relaxed drop-shadow">
            Thoughtfully designed solid wood and upholstered pieces for
            comfortable homes, beautiful spaces, and everyday living in East
            Africa.
          </p>
          <div className="pt-space-xs flex flex-wrap items-center gap-space-sm">
            <Link
              className="inline-flex items-center justify-center px-space-lg h-12 bg-primary-container text-on-primary font-label-lg text-label-lg rounded-full hover:bg-primary transition-all duration-200"
              to="/shop?sort=newest"
            >
              Shop New Arrivals
            </Link>
            <a
              className="inline-flex items-center justify-center px-space-lg h-12 border border-white text-white font-label-lg text-label-lg rounded-full hover:bg-white hover:text-on-surface transition-all duration-200"
              href="#room-categories"
            >
              Explore Collections
            </a>
          </div>
          <div className="pt-space-md border-t border-white/30 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              ["forest", "Kiln-dried hardwoods"],
              ["inventory_2", "Made to order & stock"],
              ["local_shipping", "White-glove assembly"],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-center gap-2">
                <Icon name={icon} className="text-[18px] text-white" />
                <span className="font-body-sm text-body-sm text-white">
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        {slides.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Show slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === index ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
