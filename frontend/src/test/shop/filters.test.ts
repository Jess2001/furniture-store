import { describe, expect, it } from "vitest";

import {
  DEFAULT_FILTERS,
  activeFilterCount,
  parseFilters,
  toApiQuery,
  toUrlParams,
  toggleValue,
  withChange,
} from "../../shop/filters";
import { pageWindow } from "../../shop/Pagination";

const parse = (query: string) => parseFilters(new URLSearchParams(query));

describe("parseFilters", () => {
  it("falls back to the defaults for a bare /shop", () => {
    expect(parse("")).toEqual(DEFAULT_FILTERS);
  });

  it("reads every filter from the address", () => {
    const filters = parse(
      "search=teak&category=dining,bedroom&material=Mvule&color=Forest,Sand%20Linen&in_stock=1&min_price=40000&max_price=80000&sort=price_desc&page=3",
    );

    expect(filters).toEqual({
      search: "teak",
      categories: ["dining", "bedroom"],
      materials: ["Mvule"],
      colors: ["Forest", "Sand Linen"],
      inStock: true,
      minPrice: "40000",
      maxPrice: "80000",
      sort: "price_desc",
      page: 3,
    });
  });

  it("ignores rubbish instead of breaking", () => {
    const filters = parse(
      "sort=hax&page=-4&min_price=abc&max_price=-1&category=,,&in_stock=yes",
    );

    expect(filters).toEqual(DEFAULT_FILTERS);
  });
});

describe("toUrlParams", () => {
  it("leaves out everything that is a default", () => {
    expect(toUrlParams(DEFAULT_FILTERS).toString()).toBe("");
    expect(
      toUrlParams({ ...DEFAULT_FILTERS, sort: "featured", page: 1 }).toString(),
    ).toBe("");
  });

  it("round-trips a full set of filters", () => {
    const filters = parse(
      "search=teak&category=dining,bedroom&color=Forest&in_stock=1&min_price=1&sort=newest&page=2",
    );

    expect(parseFilters(toUrlParams(filters))).toEqual(filters);
  });
});

describe("toApiQuery", () => {
  it("always asks for an ordering and a page", () => {
    const query = new URLSearchParams(toApiQuery(DEFAULT_FILTERS));

    expect(query.get("ordering")).toBe("-is_featured,-created_at");
    expect(query.get("page")).toBe("1");
    expect([...query.keys()].sort()).toEqual(["ordering", "page"]);
  });

  it("translates each filter into the API's words", () => {
    const query = new URLSearchParams(
      toApiQuery({
        search: "teak",
        categories: ["dining", "bedroom"],
        materials: ["Mvule", "Teak"],
        colors: ["Forest"],
        inStock: true,
        minPrice: "40000",
        maxPrice: "80000",
        sort: "price_asc",
        page: 2,
      }),
    );

    expect(Object.fromEntries(query)).toEqual({
      search: "teak",
      category: "dining,bedroom",
      material: "Mvule,Teak",
      color: "Forest",
      in_stock: "true",
      min_price: "40000",
      max_price: "80000",
      ordering: "price_from",
      page: "2",
    });
  });
});

describe("helpers", () => {
  it("any change goes back to page 1, unless a page is given", () => {
    const on3 = { ...DEFAULT_FILTERS, page: 3 };

    expect(withChange(on3, { inStock: true }).page).toBe(1);
    expect(withChange(on3, { page: 4 }).page).toBe(4);
  });

  it("toggles a value in and out of a list", () => {
    expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  });

  it("counts a price range once, however many ends are set", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        ...DEFAULT_FILTERS,
        categories: ["a", "b"],
        colors: ["c"],
        inStock: true,
        minPrice: "1",
        maxPrice: "2",
      }),
    ).toBe(5);
  });
});

describe("pageWindow", () => {
  it("shows every page when there are few", () => {
    expect(pageWindow(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps the ends and the neighbours of a long list", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, "…", 20]);
    expect(pageWindow(10, 20)).toEqual([1, "…", 9, 10, 11, "…", 20]);
    expect(pageWindow(20, 20)).toEqual([1, "…", 19, 20]);
    expect(pageWindow(3, 8)).toEqual([1, 2, 3, 4, "…", 8]);
  });
});
