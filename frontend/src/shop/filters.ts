export const PAGE_SIZE = 12;

export type SortKey = "featured" | "price_asc" | "price_desc" | "newest";

export const SORTS: { key: SortKey; label: string; ordering: string }[] = [
  {
    key: "featured",
    label: "Sort: Featured",
    ordering: "-is_featured,-created_at",
  },
  { key: "price_asc", label: "Price: Low to High", ordering: "price_from" },
  { key: "price_desc", label: "Price: High to Low", ordering: "-price_from" },
  { key: "newest", label: "Newest Arrivals", ordering: "-created_at" },
];

export interface ShopFilters {
  search: string;
  categories: string[];
  materials: string[];
  colors: string[];
  inStock: boolean;
  minPrice: string;
  maxPrice: string;
  sort: SortKey;
  page: number;
}

export const DEFAULT_FILTERS: ShopFilters = {
  search: "",
  categories: [],
  materials: [],
  colors: [],
  inStock: false,
  minPrice: "",
  maxPrice: "",
  sort: "featured",
  page: 1,
};

const list = (raw: string | null) =>
  (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const price = (raw: string | null) => {
  const value = Number(raw);
  return raw && Number.isFinite(value) && value >= 0 ? String(value) : "";
};

/** The address bar is the source of truth: links, refreshes and the back button all just work. */
export function parseFilters(params: URLSearchParams): ShopFilters {
  const sort = params.get("sort") as SortKey | null;
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    search: (params.get("search") ?? "").trim(),
    categories: list(params.get("category")),
    materials: list(params.get("material")),
    colors: list(params.get("color")),
    inStock: params.get("in_stock") === "1",
    minPrice: price(params.get("min_price")),
    maxPrice: price(params.get("max_price")),
    sort: SORTS.some((option) => option.key === sort)
      ? (sort as SortKey)
      : "featured",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Only what differs from the defaults, so a plain shop stays a clean /shop. */
export function toUrlParams(filters: ShopFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.categories.length)
    params.set("category", filters.categories.join(","));
  if (filters.materials.length)
    params.set("material", filters.materials.join(","));
  if (filters.colors.length) params.set("color", filters.colors.join(","));
  if (filters.inStock) params.set("in_stock", "1");
  if (filters.minPrice) params.set("min_price", filters.minPrice);
  if (filters.maxPrice) params.set("max_price", filters.maxPrice);
  if (filters.sort !== "featured") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}

/** The request the API understands (see the backend's ProductFilter). */
export function toApiQuery(filters: ShopFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.categories.length)
    params.set("category", filters.categories.join(","));
  if (filters.materials.length)
    params.set("material", filters.materials.join(","));
  if (filters.colors.length) params.set("color", filters.colors.join(","));
  if (filters.inStock) params.set("in_stock", "true");
  if (filters.minPrice) params.set("min_price", filters.minPrice);
  if (filters.maxPrice) params.set("max_price", filters.maxPrice);
  params.set(
    "ordering",
    (SORTS.find((option) => option.key === filters.sort) ?? SORTS[0]).ordering,
  );
  params.set("page", String(filters.page));
  return params.toString();
}

/** Any change to what is being shown starts again from page 1, unless a page is given. */
export function withChange(
  filters: ShopFilters,
  change: Partial<ShopFilters>,
): ShopFilters {
  return { ...filters, page: 1, ...change };
}

export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
}

/** How many separate things the shopper has narrowed by (a price range counts once). */
export function activeFilterCount(filters: ShopFilters): number {
  return (
    filters.categories.length +
    filters.materials.length +
    filters.colors.length +
    (filters.inStock ? 1 : 0) +
    (filters.minPrice || filters.maxPrice ? 1 : 0)
  );
}

export const PRICE_BANDS = [
  { label: "< KES 40k", min: "", max: "40000" },
  { label: "KES 40k–80k", min: "40000", max: "80000" },
  { label: "KES 80k–150k", min: "80000", max: "150000" },
  { label: "> KES 150k", min: "150000", max: "" },
];
