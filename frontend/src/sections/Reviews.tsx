import { Icon } from "../components/Icon";
import { reviews } from "../content/static";

const Stars = ({ size }: { size: string }) => (
  <div className="flex text-primary" aria-label="5 out of 5 stars">
    {Array.from({ length: 5 }, (_, i) => (
      <Icon key={i} name="star" filled className={size} />
    ))}
  </div>
);

export function Reviews() {
  return (
    <section className="w-full bg-surface-container-low py-space-2xl border-b border-surface-variant">
      <div className="max-w-7xl mx-auto px-margin lg:px-margin-desktop">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl">
          <div>
            <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-semibold">Real Homes &amp; Living Spaces</span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">Verified Buyer Experiences</h2>
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0 font-body-sm text-body-sm text-on-surface">
            <Stars size="text-[18px]" />
            <span className="font-bold">4.9 / 5.0</span>
            <span className="text-secondary">(Over 320+ Kenyan homes furnished)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg">
          {reviews.map((review) => (
            <figure key={review.name} className="bg-surface-container-lowest p-space-lg border border-surface-variant flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-space-sm">
                  <Stars size="text-[16px]" />
                  <span className="font-label-caps text-label-caps text-tertiary flex items-center gap-1 font-semibold">
                    <Icon name="verified" className="text-[14px]" /> Verified Buyer
                  </span>
                </div>
                <blockquote className="font-body-md text-body-md text-on-surface italic leading-relaxed">“{review.quote}”</blockquote>
              </div>
              <figcaption className="mt-space-md pt-space-sm border-t border-surface-variant flex items-center justify-between">
                <div>
                  <span className="block font-title text-title text-on-surface font-semibold">{review.name}</span>
                  <span className="font-body-sm text-body-sm text-secondary">{review.place}</span>
                </div>
                <span className="font-label-caps text-label-caps text-secondary">{review.product}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
