import { Link } from "react-router-dom";

import { Icon } from "../components/Icon";
import { designImages } from "../content/images";
import { useCategories } from "../hooks/useCatalog";
import { pickImage } from "../lib/format";

// First tile is large (2 columns x 2 rows). With six rooms, the last tile
// stretches across the row on tablets so there is no orphan.
function tileSpan(index: number, total: number) {
  if (index === 0) return "sm:col-span-2 lg:row-span-2";
  if (total === 6 && index === 5) return "sm:col-span-2 lg:col-span-1";
  return "";
}

export function ExploreBySpace() {
  const { data: categories, isLoading, isError, refetch } = useCategories();
  return (
    <section id="room-categories" className="w-full bg-surface py-space-2xl">
      <div className="max-w-7xl mx-auto px-margin lg:px-margin-desktop">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl">
          <div>
            <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-semibold">
              Rooms &amp; Departments
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">
              Explore by Space
            </h2>
          </div>
          <p className="font-body-md text-body-md text-secondary mt-2 md:mt-0 max-w-md">
            Structured furniture suites engineered for functional harmony,
            tropical durability, and architectural grace.
          </p>
        </div>

        {isError && (
          <div
            role="alert"
            className="bg-error-container text-on-error-container p-space-md rounded-xl flex items-center justify-between"
          >
            <span className="font-body-sm text-body-sm">
              We could not load the rooms right now.
            </span>
            <button
              type="button"
              className="font-label-lg text-label-lg underline"
              onClick={() => refetch()}
            >
              Try again
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-[280px] gap-4 lg:gap-5">
          {isLoading &&
            Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="rounded-3xl bg-surface-container animate-pulse"
                data-testid="category-skeleton"
              />
            ))}

          {categories?.map((category, index) => {
            const image = pickImage(
              category.image_url,
              designImages.categories[category.slug],
            );
            const large = index === 0;
            return (
              <Link
                key={category.id}
                to={`/shop?category=${category.slug}`}
                className={`group relative block overflow-hidden rounded-3xl bg-primary-container ${tileSpan(index, categories.length)}`}
              >
                {image && (
                  <img
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                    alt=""
                    src={image}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                {!large && (
                  <span className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-on-surface opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <Icon name="arrow_forward" className="text-[20px]" />
                  </span>
                )}

                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <span className="inline-block rounded-full bg-white/20 backdrop-blur-sm px-3 py-1 font-label-caps text-label-caps uppercase tracking-wider">
                    {category.product_count}{" "}
                    {category.product_count === 1 ? "Item" : "Items"}
                  </span>
                  <h3
                    className={`mt-2 drop-shadow ${large ? "font-headline-lg text-headline-lg" : "font-headline-md text-headline-md"}`}
                  >
                    {category.name}
                  </h3>
                  <p
                    className={
                      large
                        ? "font-body-sm text-body-sm text-white/90 mt-1"
                        : "sr-only"
                    }
                  >
                    {category.description}
                  </p>
                  {large && (
                    <span className="mt-3 inline-flex items-center gap-1 font-label-md text-label-md font-semibold transition-transform group-hover:translate-x-1">
                      Shop category{" "}
                      <Icon name="arrow_forward" className="text-[16px]" />
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
