import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { tokenStore } from "../../lib/api";
import type { ProductDetail, VariantDetail } from "../../lib/types";
import { currentUrl, renderApp } from "../render";
import { createServer, maraDetail } from "../server";

beforeEach(() => {
  vi.unstubAllGlobals();
  document.title = "";
});

const MARA = "/product/mara-3-seater-linen-sofa";

async function openMara(options: Parameters<typeof createServer>[0] = {}) {
  const server = createServer(options);
  renderApp(server, MARA);
  await screen.findByRole("heading", { level: 1, name: "Mara 3-Seater Linen Sofa" });
  return server;
}

describe("the product page", () => {
  it("shows the piece with its price, stock and description", async () => {
    await openMara();

    expect(screen.getByText("SKU: MARA-SOFA-SAND")).toBeInTheDocument(); // the cheapest variant is the default
    expect(screen.getByText("KES 84,500")).toBeInTheDocument();
    expect(screen.getByText("KES 92,000")).toHaveClass("line-through");
    expect(screen.getByText("Save KES 7,500")).toBeInTheDocument();
    expect(screen.getByText("In Stock (3 left)")).toBeInTheDocument();
    expect(screen.getByText("Best Seller")).toBeInTheDocument();
    expect(screen.getByText(/Deep, hand-upholstered three-seater/)).toBeInTheDocument();
  });

  it("links the breadcrumb back to the room and the home page", async () => {
    await openMara();
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumbs" });

    expect(within(crumbs).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(crumbs).getByRole("link", { name: "Living Room" })).toHaveAttribute("href", "/shop?category=living-room");
    expect(within(crumbs).getByText("Mara 3-Seater Linen Sofa")).toBeInTheDocument();
  });

  it("warns when only a few pieces are left", async () => {
    await openMara();

    expect(screen.getByText("Only 3 pieces left in Nairobi")).toBeInTheDocument();
  });

  it("does not shout about stock when there is plenty", async () => {
    const plenty = maraDetail.variants.map((v) => ({ ...v, stock_status: "in_stock" as const, low_stock_count: null }));
    await openMara({
      details: { [maraDetail.slug]: { ...maraDetail, stock_status: "in_stock", low_stock_count: null, variants: plenty } },
    });

    expect(screen.getByText("In Stock")).toBeInTheDocument();
    expect(screen.queryByText(/pieces left/)).not.toBeInTheDocument();
  });

  it("says plainly when a piece is out of stock", async () => {
    const none = maraDetail.variants.map((v) => ({ ...v, in_stock: false, stock_status: "out_of_stock" as const, low_stock_count: null }));
    await openMara({
      details: { [maraDetail.slug]: { ...maraDetail, in_stock: false, stock_status: "out_of_stock", low_stock_count: null, variants: none } },
    });

    expect(screen.getAllByText("Out of Stock").length).toBeGreaterThan(0);
  });

  it("sets the browser tab title to the piece", async () => {
    await openMara();

    await waitFor(() => expect(document.title).toBe("Mara 3-Seater Linen Sofa | Kilima Living"));
  });

  it("shows no price claims when a piece has no variants yet", async () => {
    await openMara({ details: { [maraDetail.slug]: { ...maraDetail, variants: [], price_from: null } } });

    expect(screen.getByText("Price on request")).toBeInTheDocument();
    expect(screen.queryByText(/SKU:/)).not.toBeInTheDocument();
  });
});

describe("the gallery", () => {
  it("starts on the primary picture and lets the shopper look at the others", async () => {
    const user = userEvent.setup();
    await openMara();
    const main = screen.getByTestId("main-image");

    expect(main).toHaveAttribute("src", "https://cdn.example/mara-front.jpg");
    expect(main).toHaveAttribute("alt", "Mara sofa, front view");
    const thumbs = within(screen.getByRole("group", { name: "More pictures" })).getAllByRole("button");
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0]).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Show picture: Linen weave close-up" }));

    expect(main).toHaveAttribute("src", "https://cdn.example/mara-weave.jpg");
    expect(main).toHaveAttribute("alt", "Linen weave close-up");
    expect(screen.getByRole("button", { name: "Show picture: Linen weave close-up" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Show picture: Mara sofa, front view" })).toHaveAttribute("aria-pressed", "false");
  });

  it("uses the primary picture even when it is not first in the list", async () => {
    const images = [
      { ...maraDetail.images[1], sort_order: 0 },
      { ...maraDetail.images[0], sort_order: 1 },
    ];
    await openMara({ details: { [maraDetail.slug]: { ...maraDetail, images } } });

    expect(screen.getByTestId("main-image")).toHaveAttribute("src", "https://cdn.example/mara-front.jpg");
  });

  it("swaps a placeholder primary picture for the design photo while real photography is missing", async () => {
    const images = [{ ...maraDetail.images[0], image_url: "https://placehold.co/800x1000" }];
    await openMara({ details: { [maraDetail.slug]: { ...maraDetail, images } } });

    expect(screen.getByTestId("main-image").getAttribute("src")).toContain("googleusercontent");
  });

  it("shows no thumbnail strip for a single picture", async () => {
    await openMara({ details: { [maraDetail.slug]: { ...maraDetail, images: [maraDetail.images[0]] } } });

    expect(screen.queryByRole("group", { name: "More pictures" })).not.toBeInTheDocument();
  });

  it("copes with a piece that has no pictures at all", async () => {
    await openMara({ details: { [maraDetail.slug]: { ...maraDetail, images: [] } } });

    expect(screen.getByTestId("gallery-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("main-image")).not.toBeInTheDocument();
  });
});

describe("when things go wrong", () => {
  it("explains an unknown piece and points back to the shop", async () => {
    const server = createServer();
    renderApp(server, "/product/does-not-exist");

    expect(await screen.findByRole("heading", { name: "We could not find that piece" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse the shop" })).toHaveAttribute("href", "/shop");
    expect(server.callsTo("/products/does-not-exist/")).toHaveLength(1); // a 404 is not retried
  });

  it("offers a retry when the server fails", async () => {
    renderApp(createServer({ detailStatus: 500 }), MARA);

    expect(await screen.findByText("We could not load this piece right now.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows a placeholder while loading", async () => {
    renderApp(createServer(), MARA);

    expect(screen.getByTestId("product-skeleton")).toBeInTheDocument();
    await screen.findByRole("heading", { level: 1, name: "Mara 3-Seater Linen Sofa" });
    expect(screen.queryByTestId("product-skeleton")).not.toBeInTheDocument();
  });
});

describe("getting there", () => {
  it("opens from a product card on the homepage", async () => {
    const user = userEvent.setup();
    renderApp(createServer());
    const card = (await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" })).closest("article") as HTMLElement;

    await user.click(within(card).getByRole("link", { name: "Mara 3-Seater Linen Sofa" }));

    expect(currentUrl()).toBe(MARA);
    expect(await screen.findByRole("heading", { level: 1, name: "Mara 3-Seater Linen Sofa" })).toBeInTheDocument();
  });

  it("opens from a product card in the shop", async () => {
    const user = userEvent.setup();
    renderApp(createServer(), "/shop");
    const card = (await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" })).closest("article") as HTMLElement;

    await user.click(within(card).getByRole("link", { name: "Mara 3-Seater Linen Sofa" }));

    expect(currentUrl()).toBe(MARA);
    expect(await screen.findByText("SKU: MARA-SOFA-SAND")).toBeInTheDocument();
  });

  it("goes back to the room from the breadcrumb", async () => {
    const user = userEvent.setup();
    await openMara();

    await user.click(within(screen.getByRole("navigation", { name: "Breadcrumbs" })).getByRole("link", { name: "Living Room" }));

    expect(currentUrl()).toBe("/shop?category=living-room");
  });
});


// ---------- choosing options and buying ----------

const variant = (extra: Partial<VariantDetail> & Pick<VariantDetail, "id" | "sku" | "material" | "color" | "dimensions" | "price">): VariantDetail => ({
  name: extra.sku, color_hex: extra.color === "Sand" ? "#E3DDD1" : "#3F5A3A", compare_at_price: null,
  in_stock: true, stock_status: "in_stock", low_stock_count: null, ...extra,
});

const configurable: ProductDetail = {
  ...maraDetail,
  variants: [
    variant({ id: "c1", sku: "C-LS-220", material: "Linen", color: "Sand", dimensions: "220cm", price: "84500.00", compare_at_price: "92000.00", stock_status: "low_stock", low_stock_count: 3 }),
    variant({ id: "c2", sku: "C-LF-220", material: "Linen", color: "Forest", dimensions: "220cm", price: "88000.00", compare_at_price: "96000.00" }),
    variant({ id: "c3", sku: "C-LS-255", material: "Linen", color: "Sand", dimensions: "255cm", price: "98500.00" }),
    variant({ id: "c4", sku: "C-RS-220", material: "Leather", color: "Sand", dimensions: "220cm", price: "99000.00", in_stock: false, stock_status: "out_of_stock" }),
  ],
};
const openConfigurable = () => openMara({ details: { [maraDetail.slug]: configurable } });
const radio = (name: string) => screen.getByRole("radio", { name });

describe("choosing options", () => {
  it("asks only about what differs, in order, starting from the default", async () => {
    await openConfigurable();

    expect(screen.getByText("1. Material")).toBeInTheDocument();
    expect(screen.getByText("2. Colour")).toBeInTheDocument();
    expect(screen.getByText("3. Size")).toBeInTheDocument();
    expect(radio("Linen")).toHaveAttribute("aria-checked", "true");
    expect(radio("Sand")).toHaveAttribute("aria-checked", "true");
    expect(radio("220cm")).toHaveAttribute("aria-checked", "true");
  });

  it("shows a single choice as a fact, not a question", async () => {
    await openMara(); // only the colour differs between these two variants

    expect(screen.getByText("1. Colour")).toBeInTheDocument();
    expect(screen.queryByText(/2\. /)).not.toBeInTheDocument();
    expect(screen.getByText("Material:").nextSibling).toHaveTextContent("Linen");
    expect(screen.getByText("Size:").nextSibling).toHaveTextContent("220 x 95 x 85 cm");
  });

  it("updates price, savings, SKU and stock when an option changes", async () => {
    const user = userEvent.setup();
    await openConfigurable();

    await user.click(radio("Forest"));

    expect(screen.getByText("KES 88,000")).toBeInTheDocument();
    expect(screen.getByText("KES 96,000")).toHaveClass("line-through");
    expect(screen.getByText("Save KES 8,000")).toBeInTheDocument();
    expect(screen.getByText("SKU: C-LF-220")).toBeInTheDocument();
    expect(screen.getByText("In Stock")).toBeInTheDocument();
    expect(screen.queryByText(/left of this option/)).not.toBeInTheDocument();
  });

  it("moves to the nearest real combination when the one asked for does not exist", async () => {
    const user = userEvent.setup();
    await openConfigurable();

    await user.click(radio("Leather (out of stock)")); // only exists as Sand / 220cm
    expect(radio("Leather (out of stock)")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Out of Stock" })).toBeDisabled();

    await user.click(radio("255cm")); // no Leather in 255cm: falls back to Linen / Sand / 255cm
    expect(radio("Linen")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("SKU: C-LS-255")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add to Order/ })).toBeEnabled();
  });

  it("marks an option that is sold out everywhere", async () => {
    await openConfigurable();

    expect(radio("Leather (out of stock)")).toHaveClass("line-through");
    expect(radio("Linen")).not.toHaveClass("line-through");
  });
});

describe("quantity", () => {
  it("cannot go below one or above what is left", async () => {
    const user = userEvent.setup();
    await openConfigurable(); // the default option has 3 left
    const plus = screen.getByRole("button", { name: "Increase quantity" });
    const minus = screen.getByRole("button", { name: "Decrease quantity" });

    expect(minus).toBeDisabled();
    await user.click(plus);
    await user.click(plus);
    expect(screen.getByTestId("quantity")).toHaveTextContent("3");
    expect(plus).toBeDisabled();
    expect(screen.getByText("Only 3 left of this option")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to Order — KES 253,500" })).toBeInTheDocument();
  });

  it("is lowered when the chosen option has less stock", async () => {
    const user = userEvent.setup();
    await openMara(); // Sand has 3 left, Forest has 2
    const plus = screen.getByRole("button", { name: "Increase quantity" });
    await user.click(plus);
    await user.click(plus);
    expect(screen.getByTestId("quantity")).toHaveTextContent("3");

    await user.click(radio("Forest"));

    expect(screen.getByTestId("quantity")).toHaveTextContent("2");
  });
});

describe("adding to the cart", () => {
  it("asks a guest to sign in first", async () => {
    const user = userEvent.setup();
    const server = await openMara();

    await user.click(screen.getByRole("button", { name: /Add to Order/ }));

    expect(await screen.findByRole("dialog", { name: "Sign in" })).toBeInTheDocument();
    expect(server.callsTo("/cart/items/", "POST")).toHaveLength(0);
  });

  it("adds the chosen option and quantity, then shows the cart", async () => {
    tokenStore.set({ access: "ACCESS", refresh: "REFRESH" });
    const user = userEvent.setup();
    const server = createServer();
    renderApp(server, MARA);
    await screen.findByRole("button", { name: "Sign out" });
    await screen.findByRole("heading", { level: 1, name: "Mara 3-Seater Linen Sofa" });

    await user.click(radio("Forest"));
    await user.click(screen.getByRole("button", { name: "Increase quantity" }));
    await user.click(screen.getByRole("button", { name: "Add to Order — KES 176,000" }));

    await waitFor(() => expect(server.callsTo("/cart/items/", "POST")).toHaveLength(1));
    expect(server.callsTo("/cart/items/", "POST")[0].body).toEqual({ variant_id: "v-forest", quantity: 2 });
    expect(await screen.findByRole("dialog", { name: "Your cart" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cart (2) — KES 176,000" })).toBeInTheDocument();
  });

  it("cannot buy a sold-out piece", async () => {
    await openMara({
      details: {
        [maraDetail.slug]: {
          ...maraDetail,
          in_stock: false,
          stock_status: "out_of_stock",
          variants: maraDetail.variants.map((v) => ({ ...v, in_stock: false, stock_status: "out_of_stock" as const, low_stock_count: null })),
        },
      },
    });

    expect(screen.getByRole("button", { name: "Out of Stock" })).toBeDisabled();
  });
});