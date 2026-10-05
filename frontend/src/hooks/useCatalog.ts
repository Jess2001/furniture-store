import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "../lib/api";
import type { Category, Facets, Page, ProductCardData } from "../lib/types";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/categories/", { auth: false }),
    staleTime: 5 * 60_000,
  });
}

export interface ProductParams {
  featured?: boolean;
  category?: string | null;
  search?: string;
}

export function useProducts(params: ProductParams) {
  const query = new URLSearchParams();
  if (params.featured) query.set("featured", "true");
  if (params.category) query.set("category", params.category);
  if (params.search) query.set("search", params.search);

  return useQuery({
    queryKey: ["products", params],
    queryFn: () =>
      api<Page<ProductCardData>>(`/products/?${query.toString()}`, {
        auth: false,
      }),
    staleTime: 60_000,
  });
}

/** The shop page's list. `query` is the finished API query string (see shop/filters.ts). */
export function useProductList(query: string) {
  return useQuery({
    queryKey: ["products", "list", query],
    queryFn: () =>
      api<Page<ProductCardData>>(`/products/?${query}`, { auth: false }),
    placeholderData: keepPreviousData, // keep showing the old grid while the new one loads
    staleTime: 30_000,
  });
}

export function useFacets() {
  return useQuery({
    queryKey: ["facets"],
    queryFn: () => api<Facets>("/products/facets/", { auth: false }),
    staleTime: 5 * 60_000,
  });
}
