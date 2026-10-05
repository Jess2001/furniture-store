import { Link } from "react-router-dom";

import { Icon } from "../components/Icon";
import { designImages } from "../content/images";
import { useCategories } from "../hooks/useCatalog";
import { pickImage } from "../lib/format";

export function ExploreBySpace() {
  const { data: categories, isLoading, isError, refetch } = useCategories();
  return (
    <section
      id="room-categories"
      className="w-full bg-surface-container-low py-space-2xl border-b border-surface-variant"
    >
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
            className="bg-error-container text-on-error-container p-space-md flex items-center justify-between"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-lg">
          {isLoading &&
            Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="aspect-[4/3] bg-surface-container animate-pulse"
                data-testid="category-skeleton"
              />
            ))}

          {categories?.map((category) => (
            <Link
              key={category.id}
              to={`/shop?category=${category.slug}`}
              className="group block text-left bg-surface-container-lowest border border-surface-variant overflow-hidden"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-surface-container">
                <img
                  className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  alt=""
                  src={pickImage(
                    category.image_url,
                    designImages.categories[category.slug],
                  )}
                />
                <span className="absolute top-3 right-3 bg-surface-container-lowest/90 px-2 py-1 font-label-caps text-label-caps uppercase text-on-surface">
                  {category.product_count}{" "}
                  {category.product_count === 1 ? "Item" : "Items"}
                </span>
              </div>
              <div className="p-space-md">
                <h3 className="font-headline-md text-headline-md text-on-surface group-hover:text-primary transition-colors">
                  {category.name}
                </h3>
                <p className="font-body-sm text-body-sm text-secondary mt-1">
                  {category.description}
                </p>
                <span className="inline-flex items-center gap-1 font-label-md text-label-md text-primary font-semibold mt-space-sm group-hover:translate-x-1 transition-transform">
                  Shop category{" "}
                  <Icon name="arrow_forward" className="text-[16px]" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
