import { useState } from "react";
import { Link } from "react-router-dom";

import { Icon } from "../components/Icon";
import { useCategories, useProducts } from "../hooks/useCatalog";
import { ProductCard } from "./ProductCard";

const chipBase =
  "px-3.5 py-1.5 font-label-md text-label-md shrink-0 transition-colors";
const chipActive = `${chipBase} bg-on-surface text-on-secondary`;
const chipIdle = `${chipBase} bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-on-surface`;

export function FeaturedPieces() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { data: categories } = useCategories();

  const params = selectedCategory
    ? { category: selectedCategory }
    : { featured: true };
  const { data, isLoading, isError, refetch } = useProducts(params);

  const shopLink = selectedCategory
    ? `/shop?category=${selectedCategory}`
    : "/shop";

  return (
    <section
      id="featured-collection"
      className="w-full bg-surface py-space-2xl border-b border-surface-variant"
    >
      <div className="max-w-7xl mx-auto px-margin lg:px-margin-desktop">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-space-lg gap-4">
          <div>
            <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary font-semibold">
              Crafted in Karen
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface mt-1">
              Featured Pieces
            </h2>
            <p className="font-body-sm text-body-sm text-secondary">
              Handcrafted essentials ready for your space.
            </p>
          </div>

          <div
            className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0"
            role="group"
            aria-label="Filter by room"
          >
            <button
              type="button"
              aria-pressed={selectedCategory === null}
              className={selectedCategory === null ? chipActive : chipIdle}
              onClick={() => setSelectedCategory(null)}
            >
              Featured
            </button>
            {categories?.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={selectedCategory === category.slug}
                className={
                  selectedCategory === category.slug ? chipActive : chipIdle
                }
                onClick={() => setSelectedCategory(category.slug)}
              >
                {category.name} ({category.product_count})
              </button>
            ))}
          </div>
        </div>

        {isError && (
          <div
            role="alert"
            className="bg-error-container text-on-error-container p-space-md flex items-center justify-between"
          >
            <span className="font-body-sm text-body-sm">
              We could not load the pieces right now.
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

        {data && data.results.length === 0 && (
          <p className="font-body-md text-body-md text-secondary py-space-xl">
            Nothing matches that yet. Try another room or search term.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading &&
            Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="aspect-[4/6] bg-surface-container animate-pulse"
                data-testid="product-skeleton"
              />
            ))}
          {data?.results.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        <div className="mt-space-xl flex justify-center">
          <Link
            to={shopLink}
            className="inline-flex items-center gap-2 px-space-lg h-12 border border-on-secondary-fixed text-on-secondary-fixed font-label-lg text-label-lg rounded hover:bg-on-secondary-fixed hover:text-surface transition-all duration-200"
          >
            View the full shop{" "}
            <Icon name="arrow_forward" className="text-[18px]" />
          </Link>
        </div>

        <div className="mt-space-xl p-space-lg bg-surface-container-low border border-surface-variant flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Icon name="architecture" className="text-[24px]" />
            </div>
            <div>
              <h4 className="font-title text-title text-on-surface">
                Looking for custom dimensions or contract quantities?
              </h4>
              <p className="font-body-sm text-body-sm text-secondary">
                We tailor length, timber finish, and upholstery for architects,
                interior designers, and homeowners.
              </p>
            </div>
          </div>
          <a
            className="whitespace-nowrap inline-flex items-center gap-1 font-label-lg text-label-lg text-primary hover:text-primary-container font-semibold"
            href="#showroom-booking"
          >
            Inquire with bespoke workshop{" "}
            <Icon name="arrow_forward" className="text-[18px]" />
          </a>
        </div>
      </div>
    </section>
  );
}
