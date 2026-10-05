import { Icon } from "../components/Icon";
import { designImages } from "../content/images";
import { pillars } from "../content/static";

export function Craft() {
  const [a, b, c, d] = designImages.craft;
  const frame =
    "bg-surface-container overflow-hidden border border-surface-variant";

  return (
    <section
      id="craft"
      className="w-full bg-surface-container-lowest py-space-3xl border-b border-surface-variant"
    >
      <div className="max-w-7xl mx-auto px-margin lg:px-margin-desktop">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-2xl items-center">
          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className={`aspect-[3/4] ${frame}`}>
                <img
                  className="w-full h-full object-cover"
                  alt="Timber being prepared in the workshop"
                  src={a}
                />
              </div>
              <div className={`aspect-[1/1] ${frame}`}>
                <img
                  className="w-full h-full object-cover"
                  alt="Hand-finished wood detail"
                  src={b}
                />
              </div>
            </div>
            <div className="space-y-4 pt-8">
              <div className={`aspect-[1/1] ${frame}`}>
                <img
                  className="w-full h-full object-cover"
                  alt="Natural fabric texture"
                  src={c}
                />
              </div>
              <div className={`aspect-[3/4] ${frame}`}>
                <img
                  className="w-full h-full object-cover"
                  alt="Joinery in progress"
                  src={d}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col space-y-space-md">
            <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-semibold">
              Provenance &amp; Quality
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface leading-tight">
              Built for generations, not seasons.
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
              Every piece from LUXURY Living is handcrafted in our Karen
              workshops by master joiners who combine traditional East African
              timber wisdom with modern Scandinavian architectural clarity. We
              strictly reject particle board, veneer facades, and short-lived
              fast furniture.
            </p>
            <div className="space-y-space-md pt-space-sm">
              {pillars.map((pillar) => (
                <div key={pillar.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-sm bg-surface-container flex items-center justify-center shrink-0 border border-surface-variant">
                    <Icon
                      name={pillar.icon}
                      className="text-primary text-[20px]"
                    />
                  </div>
                  <div>
                    <h3 className="font-title text-title text-on-surface font-semibold">
                      {pillar.title}
                    </h3>
                    <p className="font-body-sm text-body-sm text-secondary mt-0.5">
                      {pillar.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-space-md">
              <a
                className="inline-flex items-center gap-2 font-label-lg text-label-lg text-primary hover:text-primary-container font-semibold border-b border-primary pb-0.5"
                href="#showroom-booking"
              >
                Read our full Timber &amp; Sustainability Ledger{" "}
                <Icon name="arrow_forward" className="text-[16px]" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
