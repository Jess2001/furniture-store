import { vi } from "vitest";

import type {
  Cart,
  Category,
  Facets,
  Page,
  ProductCardData,
  User,
} from "../lib/types";

export const categories: Category[] = [
  {
    id: "c1",
    name: "Living Room",
    slug: "living-room",
    description: "Deep sectionals.",
    image_url: "https://placehold.co/800x600",
    product_count: 3,
  },
  {
    id: "c2",
    name: "Dining",
    slug: "dining",
    description: "Solid timber tables.",
    image_url: "https://placehold.co/800x600",
    product_count: 1,
  },
  {
    id: "c3",
    name: "Bedroom",
    slug: "bedroom",
    description: "Platform beds.",
    image_url: "https://placehold.co/800x600",
    product_count: 1,
  },
];

const base = { primary_image: null, price_from: null, in_stock: true };

export const mara: ProductCardData = {
  ...base,
  id: "p1",
  name: "Mara 3-Seater Linen Sofa",
  slug: "mara-3-seater-linen-sofa",
  badge: "Best Seller",
  category: { id: "c1", name: "Living Room", slug: "living-room" },
  price_from: "84500.00",
  stock_status: "low_stock",
  low_stock_count: 3,
  variants: [
    {
      id: "v-sand",
      name: "Mara Sofa, Sand Linen",
      color: "Sand Linen",
      color_hex: "#E3DDD1",
      dimensions: "",
      price: "84500.00",
      compare_at_price: "92000.00",
      in_stock: true,
    },
    {
      id: "v-forest",
      name: "Mara Sofa, Forest",
      color: "Forest",
      color_hex: "#3F5A3A",
      dimensions: "",
      price: "88000.00",
      compare_at_price: "96000.00",
      in_stock: true,
    },
  ],
};

export const bed: ProductCardData = {
  ...base,
  id: "p2",
  name: "Baringo Platform Bed + Stands",
  slug: "baringo-platform-bed-stands",
  badge: "Bespoke Option",
  category: { id: "c3", name: "Bedroom", slug: "bedroom" },
  price_from: "96000.00",
  stock_status: "low_stock",
  low_stock_count: 4,
  variants: [
    {
      id: "v-queen",
      name: "Baringo Bed, Queen",
      color: "",
      color_hex: "",
      dimensions: "Queen 160 x 200 cm",
      price: "96000.00",
      compare_at_price: null,
      in_stock: true,
    },
    {
      id: "v-king",
      name: "Baringo Bed, King",
      color: "",
      color_hex: "",
      dimensions: "King 180 x 200 cm",
      price: "112000.00",
      compare_at_price: null,
      in_stock: false,
    },
  ],
};

export const chair: ProductCardData = {
  ...base,
  id: "p3",
  name: "Runda Executive Chair",
  slug: "runda-executive-chair",
  badge: "",
  category: { id: "c4", name: "Home Office", slug: "home-office" },
  price_from: "36500.00",
  in_stock: false,
  stock_status: "out_of_stock",
  low_stock_count: null,
  variants: [
    {
      id: "v-chair",
      name: "Runda Chair, Grey",
      color: "Grey",
      color_hex: "#8A8D91",
      dimensions: "",
      price: "36500.00",
      compare_at_price: null,
      in_stock: false,
    },
  ],
};

export const dining: ProductCardData = {
  ...base,
  id: "p4",
  name: "Naivasha Teak Dining Table",
  slug: "naivasha-teak-dining-table",
  badge: "Solid Wood",
  category: { id: "c2", name: "Dining", slug: "dining" },
  price_from: "115000.00",
  stock_status: "in_stock",
  low_stock_count: null,
  variants: [
    {
      id: "v-teak",
      name: "Naivasha Table, Natural Teak",
      color: "Natural Teak",
      color_hex: "#B07A45",
      dimensions: "",
      price: "115000.00",
      compare_at_price: null,
      in_stock: true,
    },
  ],
};

export const facets: Facets = {
  price: { min: "28500.00", max: "135000.00" },
  materials: [
    { name: "Linen", count: 1 },
    { name: "Mvule", count: 1 },
    { name: "Teak", count: 1 },
  ],
  colors: [
    { name: "Sand Linen", hex: "#E3DDD1", count: 1 },
    { name: "Forest", hex: "#3F5A3A", count: 1 },
  ],
  in_stock_count: 3,
};

/** which material each fake product is made of (the compact card does not carry it) */
const materialOf: Record<string, string> = {
  p1: "Linen",
  p2: "Mvule",
  p3: "Rattan",
  p4: "Teak",
};

export const user: User = {
  id: "u1",
  email: "jess@example.com",
  first_name: "Jess",
  last_name: "Mary",
  phone: "",
  role: "CUSTOMER",
};

const split = (raw: string | null) =>
  (raw ?? "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

interface ServerOptions {
  productsStatus?: number;
  categories?: Category[];
  products?: ProductCardData[];
  pageSize?: number;
  facets?: Facets;
}

/** An in-memory fake of the Django API, enough for the homepage and shop flows. */
export function createServer(options: ServerOptions = {}) {
  let cart: Cart = {
    id: "cart1",
    items: [],
    item_count: 0,
    subtotal: "0.00",
    has_problems: false,
  };
  const calls: {
    method: string;
    path: string;
    body?: unknown;
    auth?: string;
  }[] = [];

  const recompute = () => {
    cart.item_count = cart.items.reduce((n, i) => n + i.quantity, 0);
    cart.subtotal = cart.items
      .reduce((sum, i) => sum + Number(i.variant.price) * i.quantity, 0)
      .toFixed(2);
    cart.items.forEach(
      (i) => (i.line_total = (Number(i.variant.price) * i.quantity).toFixed(2)),
    );
  };

  const all = options.products ?? [mara, bed, chair, dining];
  const pageSize = options.pageSize ?? 12;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const listProducts = (url: URL) => {
    const q = url.searchParams;
    let items = [...all];

    if (q.get("featured") === "true")
      items = items.filter((p) => ["p1", "p2", "p3", "p4"].includes(p.id));
    const rooms = split(q.get("category"));
    if (rooms.length)
      items = items.filter((p) => rooms.includes(p.category.slug));
    const search = q.get("search")?.toLowerCase();
    if (search)
      items = items.filter((p) => p.name.toLowerCase().includes(search));
    if (q.get("in_stock") === "true") items = items.filter((p) => p.in_stock);
    if (q.get("min_price"))
      items = items.filter(
        (p) => Number(p.price_from) >= Number(q.get("min_price")),
      );
    if (q.get("max_price"))
      items = items.filter(
        (p) => Number(p.price_from) <= Number(q.get("max_price")),
      );
    const colors = split(q.get("color"));
    if (colors.length)
      items = items.filter((p) =>
        p.variants.some((v) => colors.includes(v.color.toLowerCase())),
      );
    const mats = split(q.get("material"));
    if (mats.length)
      items = items.filter((p) =>
        mats.includes((materialOf[p.id] ?? "").toLowerCase()),
      );

    const ordering = q.get("ordering");
    if (ordering === "price_from")
      items.sort((a, b) => Number(a.price_from) - Number(b.price_from));
    if (ordering === "-price_from")
      items.sort((a, b) => Number(b.price_from) - Number(a.price_from));

    const page = Number(q.get("page") ?? 1);
    const pages = Math.max(1, Math.ceil(items.length / pageSize));
    if (page > pages) return json({ detail: "Invalid page." }, 404);
    const results = items.slice((page - 1) * pageSize, page * pageSize);
    const body: Page<ProductCardData> = {
      count: items.length,
      next: page < pages ? "next" : null,
      previous: page > 1 ? "prev" : null,
      results,
    };
    return json(body);
  };

  const handler = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace("/api/v1", "");
    const method = (init.method ?? "GET").toUpperCase();
    const headers = (init.headers ?? {}) as Record<string, string>;
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({
      method,
      path: path + url.search,
      body,
      auth: headers.Authorization,
    });

    if (path === "/categories/") return json(options.categories ?? categories);
    if (path === "/products/facets/") return json(options.facets ?? facets);

    if (path === "/products/") {
      if (options.productsStatus && options.productsStatus !== 200)
        return json({ detail: "boom" }, options.productsStatus);
      return listProducts(url);
    }

    if (path === "/auth/login/") {
      return body.password === "correct-horse"
        ? json({ access: "ACCESS", refresh: "REFRESH" })
        : json(
            { detail: "No active account found with the given credentials" },
            401,
          );
    }
    if (path === "/auth/me/")
      return headers.Authorization ? json(user) : json({ detail: "no" }, 401);
    if (path === "/auth/logout/") return new Response(null, { status: 204 });

    if (path === "/cart/") return json(cart);
    if (path === "/cart/items/" && method === "POST") {
      const variant = all
        .flatMap((p) => p.variants.map((v) => ({ p, v })))
        .find(({ v }) => v.id === body.variant_id);
      if (!variant)
        return json({ variant_id: ["This item is not available."] }, 400);
      const existing = cart.items.find((i) => i.variant.id === variant.v.id);
      if (existing) existing.quantity += body.quantity;
      else
        cart.items.push({
          id: `item-${cart.items.length + 1}`,
          quantity: body.quantity,
          variant: {
            id: variant.v.id,
            sku: "SKU",
            name: variant.v.name,
            color: variant.v.color,
            color_hex: variant.v.color_hex,
            price: variant.v.price,
            compare_at_price: variant.v.compare_at_price,
          },
          product: {
            name: variant.p.name,
            slug: variant.p.slug,
            image_url: null,
          },
          line_total: "0.00",
          problem: null,
          max_available: null,
        });
      recompute();
      return json(cart, 201);
    }
    const itemMatch = path.match(/^\/cart\/items\/([^/]+)\/$/);
    if (itemMatch) {
      const item = cart.items.find((i) => i.id === itemMatch[1]);
      if (!item) return json({ detail: "Not found." }, 404);
      if (method === "PATCH") item.quantity = body.quantity;
      if (method === "DELETE")
        cart.items = cart.items.filter((i) => i !== item);
      recompute();
      return json(cart);
    }
    return json({ detail: `unmocked ${method} ${path}` }, 404);
  };

  const fetchMock = vi.fn(handler);
  return {
    fetchMock,
    calls,
    setCart(next: Cart) {
      cart = next;
    },
    callsTo: (path: string, method = "GET") =>
      calls.filter((c) => c.path.startsWith(path) && c.method === method),
    /** every request the shop made for a product list, as readable query params */
    listQueries: () =>
      calls
        .filter((c) => c.path.startsWith("/products/?"))
        .map((c) => new URLSearchParams(c.path.split("?")[1])),
    lastListQuery: () => {
      const queries = calls.filter((c) => c.path.startsWith("/products/?"));
      return new URLSearchParams(
        queries[queries.length - 1].path.split("?")[1],
      );
    },
  };
}

/** n generated products, newest first, for pagination tests */
export function manyProducts(n: number): ProductCardData[] {
  return Array.from({ length: n }, (_, i) => ({
    ...dining,
    id: `gen-${i + 1}`,
    name: `Piece ${String(i + 1).padStart(2, "0")}`,
    slug: `piece-${i + 1}`,
    price_from: String(10000 + i * 1000) + ".00",
    variants: [
      {
        ...dining.variants[0],
        id: `gen-v-${i + 1}`,
        price: String(10000 + i * 1000) + ".00",
      },
    ],
  }));
}
