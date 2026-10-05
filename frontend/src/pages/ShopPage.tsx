import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Icon } from "../components/Icon";
import { Modal } from "../components/Modal";
import { useCategories, useFacets, useProductList } from "../hooks/useCatalog";
import { ApiError } from "../lib/api";
import { scrollToId } from "../lib/dom";
import { BespokeStrip } from "../sections/BespokeStrip";
import { ProductCard } from "../sections/ProductCard";
import { FilterSidebar } from "../shop/FilterSidebar";
import {
  activeFilterCount,
  PAGE_SIZE,
  parseFilters,
  SORTS,
  toApiQuery,
  toUrlParams,
  withChange,
  type ShopFilters,
  type SortKey,
} from "../shop/filters";
import { Pagination } from "../shop/Pagination";

const pill =
  "px-5 py-2 rounded-lg font-label-md text-label-md tracking-wide shadow-sm shrink-0 transition-colors";

export function ShopPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);

  const { data: categories } = useCategories();
  const { data: facets } = useFacets();
  const { data, isLoading, isError, error, refetch, isPlaceholderData } =
    useProductList(toApiQuery(filters));

  const [columns, setColumns] = useState<3 | 4>(3);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchText, setSearchText] = useState(filters.search);

  const commit = (
    change: Partial<ShopFilters>,
    options?: { replace?: boolean },
  ) => setParams(toUrlParams(withChange(filters, change)), options);

  // the box follows the address bar (reset, back button) ...
  useEffect(() => setSearchText(filters.search), [filters.search]);

  // ... and the address bar follows the box once typing pauses
  useEffect(() => {
    if (searchText.trim() === filters.search) return;
    const timer = setTimeout(() => commit({ search: searchText.trim() }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  // a bookmarked page that no longer exists (fewer results now) falls back to page 1
  useEffect(() => {
    if (
      isError &&
      error instanceof ApiError &&
      error.status === 404 &&
      filters.page > 1
    ) {
      commit({ page: 1 }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, error]);

  const reset = () => setParams(new URLSearchParams());
  const goToPage = (page: number) => {
    commit({ page });
    scrollToId("shop-results");
  };

  const total = categories?.reduce(
    (sum, category) => sum + category.product_count,
    0,
  );
  const count = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const first = (filters.page - 1) * PAGE_SIZE + 1;
  const last = first + (data?.results.length ?? 0) - 1;
  const active = activeFilterCount(filters);
  const singleRoom =
    filters.categories.length === 1 ? filters.categories[0] : null;

  const sidebar = (
    <FilterSidebar
      filters={filters}
      facets={facets}
      categories={categories}
      onChange={commit}
      onReset={reset}
    />
  );

  return (
    <div className="flex flex-col w-full">
      {/* banner */}
      <section className="w-full bg-surface-container-low py-space-xl px-margin md:px-margin-tablet lg:px-margin-desktop">
        <div className="max-w-7xl mx-auto flex flex-col gap-space-md">
          <nav
            aria-label="Breadcrumbs"
            className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant"
          >
            <Link className="hover:text-primary transition-colors" to="/">
              Home
            </Link>
            <span className="text-outline-variant text-[10px]">/</span>
            <span className="text-on-surface font-semibold">
              Shop All Furniture
            </span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-lg">
            <div className="max-w-3xl space-y-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                <span className="font-label-caps text-label-caps uppercase tracking-widest text-primary">
                  Nairobi Atelier • Karen Workshop
                </span>
              </div>
              <h1 className="font-display text-display text-on-surface font-normal tracking-tight">
                All Furniture &amp; Living Pieces
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
                Thoughtfully crafted solid timber and tailored upholstered
                furniture, built for functional longevity across East African
                homes, coastal sanctuaries, and contemporary workspaces.
              </p>
            </div>

            <div className="hidden xl:flex items-center gap-space-lg bg-surface-container-lowest p-space-md rounded-lg shadow-sm">
              <div className="flex flex-col">
                <span
                  className="font-display text-headline-md text-primary leading-none"
                  data-testid="catalogue-total"
                >
                  {total ?? "–"}
                </span>
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-1">
                  Catalogued Pieces
                </span>
              </div>
              <div className="w-px h-8 bg-surface-variant" />
              <div className="flex flex-col">
                <span className="font-display text-headline-md text-tertiary leading-none">
                  100%
                </span>
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase mt-1">
                  Sustainable Timber
                </span>
              </div>
            </div>
          </div>

          <div
            className="flex items-center gap-2 overflow-x-auto pt-space-xs pb-1"
            role="group"
            aria-label="Quick room filter"
          >
            <button
              type="button"
              aria-pressed={filters.categories.length === 0}
              onClick={() => commit({ categories: [] })}
              className={`${pill} ${filters.categories.length === 0 ? "bg-inverse-surface text-inverse-on-surface" : "bg-surface-container-lowest text-on-surface hover:bg-surface-variant"}`}
            >
              All{total !== undefined ? ` (${total})` : ""}
            </button>
            {categories?.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={singleRoom === category.slug}
                onClick={() => commit({ categories: [category.slug] })}
                className={`${pill} ${singleRoom === category.slug ? "bg-inverse-surface text-inverse-on-surface" : "bg-surface-container-lowest text-on-surface hover:bg-surface-variant"}`}
              >
                {category.name} ({category.product_count})
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* control bar */}
      <section className="w-full bg-surface-container-lowest py-space-sm px-margin md:px-margin-tablet lg:px-margin-desktop sticky top-28 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-md w-full md:w-auto justify-between md:justify-start">
            <p
              className="font-body-sm text-body-sm text-on-surface"
              aria-live="polite"
            >
              {count > 0 ? (
                <>
                  Showing{" "}
                  <span className="font-semibold text-primary">
                    {first}–{last}
                  </span>{" "}
                  of {count} handcrafted pieces
                </>
              ) : data ? (
                "No pieces found"
              ) : (
                "Loading pieces…"
              )}
            </p>
            <button
              type="button"
              onClick={reset}
              className="font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors underline decoration-1 underline-offset-4 flex items-center gap-1"
            >
              Reset all <Icon name="close" className="text-[14px]" />
            </button>
          </div>

          <div className="flex items-center gap-space-md w-full md:w-auto justify-between md:justify-end">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="lg:hidden flex items-center gap-1.5 px-3 py-2 bg-surface-container hover:bg-surface-variant text-on-surface rounded font-label-md text-label-md font-semibold shrink-0"
            >
              <Icon name="tune" className="text-[18px] text-primary" />
              Filters
              {active > 0 && (
                <span className="bg-primary text-on-primary text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {active}
                </span>
              )}
            </button>

            <div className="relative flex-1 md:w-64">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]"
              />
              <input
                type="search"
                aria-label="Filter by timber, finish or name"
                placeholder="Filter by timber, finish..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full bg-surface-container-low pl-9 pr-3 py-2 rounded text-on-surface font-body-sm text-body-sm focus:outline-none focus:bg-surface shadow-inner"
              />
            </div>

            <div
              className="hidden lg:flex items-center bg-surface-container p-1 rounded"
              role="group"
              aria-label="Grid size"
            >
              {([3, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  title={`${n} Column View`}
                  aria-label={`${n} columns`}
                  aria-pressed={columns === n}
                  onClick={() => setColumns(n)}
                  className={`p-1 rounded ${columns === n ? "bg-surface-container-lowest text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                >
                  <Icon
                    name={n === 3 ? "grid_view" : "view_comfy"}
                    className="text-[18px] block"
                  />
                </button>
              ))}
            </div>

            <div className="relative shrink-0">
              <select
                aria-label="Sort pieces"
                value={filters.sort}
                onChange={(e) => commit({ sort: e.target.value as SortKey })}
                className="appearance-none bg-surface-container pl-3 pr-8 py-2 rounded font-label-md text-label-md text-on-surface font-semibold focus:outline-none cursor-pointer"
              >
                {SORTS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Icon
                name="expand_more"
                className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface text-[16px]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* sidebar + grid */}
      <section className="w-full py-space-xl px-margin md:px-margin-tablet lg:px-margin-desktop">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-space-xl items-start">
          <aside
            aria-label="Filters"
            className="hidden lg:block w-full lg:w-72 shrink-0 bg-surface-container-lowest p-space-lg rounded-xl shadow-md"
          >
            {sidebar}
          </aside>

          <div
            id="shop-results"
            className="flex-1 w-full space-y-space-2xl scroll-mt-48"
          >
            {isError &&
              !(
                error instanceof ApiError &&
                error.status === 404 &&
                filters.page > 1
              ) && (
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
              <div className="bg-surface-container-lowest p-space-xl rounded-xl text-center space-y-space-sm">
                <h2 className="font-headline-md text-headline-md text-on-surface">
                  No pieces match these filters
                </h2>
                <p className="font-body-md text-body-md text-secondary">
                  Try widening the price range or removing a filter.
                </p>
                <button
                  type="button"
                  onClick={reset}
                  className="px-6 py-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors"
                >
                  Reset all filters
                </button>
              </div>
            )}

            <div
              data-testid="product-grid"
              className={`grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-space-md lg:gap-space-lg transition-opacity ${
                columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"
              } ${isPlaceholderData ? "opacity-60" : ""}`}
            >
              {isLoading &&
                Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className="aspect-[4/6] bg-surface-container animate-pulse rounded-xl"
                    data-testid="product-skeleton"
                  />
                ))}
              {data?.results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {data && count > 0 && (
              <div className="w-full bg-surface-container-lowest p-space-xl rounded-xl shadow-sm flex flex-col items-center gap-space-lg text-center">
                <div className="w-full max-w-md space-y-2">
                  <div className="flex items-center justify-between font-label-md text-label-md text-on-surface">
                    <span>
                      Showing {last} of {count} items
                    </span>
                    <span className="font-semibold text-primary">
                      {Math.round((last / count) * 100)}% viewed
                    </span>
                  </div>
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-300"
                      style={{ width: `${(last / count) * 100}%` }}
                    />
                  </div>
                </div>
                <Pagination
                  page={filters.page}
                  totalPages={totalPages}
                  onChange={goToPage}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <BespokeStrip />

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        labelledBy="filters-title"
        placement="right"
      >
        <div className="flex items-center justify-between border-b border-surface-variant p-space-md">
          <h2
            id="filters-title"
            className="font-headline-md text-headline-md text-on-surface"
          >
            Filter products
          </h2>
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setFiltersOpen(false)}
            className="text-secondary hover:text-on-surface"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="p-space-md">{sidebar}</div>
        <div className="mt-auto border-t border-surface-variant p-space-md">
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="w-full bg-primary hover:bg-primary-container text-on-primary py-3 rounded-lg font-label-md text-label-md tracking-wider uppercase transition-colors"
          >
            Show {count} {count === 1 ? "piece" : "pieces"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
