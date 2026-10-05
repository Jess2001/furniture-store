// Shapes of the Django API responses (see the backend serializers).

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
}

export interface Category extends CategorySummary {
  description: string;
  image_url: string;
  product_count: number;
}

export interface ProductImage {
  id: string;
  image_url: string;
  alt_text: string;
  sort_order: number;
  is_primary: boolean;
}

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export interface VariantSummary {
  id: string;
  name: string;
  color: string;
  color_hex: string;
  dimensions: string;
  price: string;
  compare_at_price: string | null;
  in_stock: boolean;
}

/** One product card in a list. variants are cheapest first: variants[0] is the default. */
export interface ProductCardData {
  id: string;
  name: string;
  slug: string;
  badge: string;
  category: CategorySummary;
  primary_image: ProductImage | null;
  price_from: string | null;
  in_stock: boolean;
  stock_status: StockStatus;
  low_stock_count: number | null;
  variants: VariantSummary[];
}

export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
}

export type CartProblem = "unavailable" | "out_of_stock" | "insufficient_stock";

export interface CartItem {
  id: string;
  quantity: number;
  variant: {
    id: string;
    sku: string;
    name: string;
    color: string;
    color_hex: string;
    price: string;
    compare_at_price: string | null;
  };
  product: { name: string; slug: string; image_url: string | null };
  line_total: string;
  problem: CartProblem | null;
  max_available: number | null;
}

export interface Cart {
  id: string;
  items: CartItem[];
  item_count: number;
  subtotal: string;
  has_problems: boolean;
}

/** What the shop sidebar can offer, from GET /products/facets/ */
export interface Facets {
  price: { min: string | null; max: string | null };
  materials: { name: string; count: number }[];
  colors: { name: string; hex: string; count: number }[];
  in_stock_count: number;
}
