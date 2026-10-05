import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { currentUrl, renderApp } from "../render";
import { createServer, manyProducts } from "../server";

beforeEach(() => {
  vi.unstubAllGlobals();
});

const sidebar = () =>
  within(screen.getByRole("complementary", { name: "Filters" }));
const urlParams = () => new URLSearchParams(currentUrl().split("?")[1] ?? "");
// the cards only: the sidebar has headings of its own
const productNames = () =>
  within(screen.getByTestId("product-grid"))
    .getAllByRole("heading")
    .map((h) => h.textContent);

async function openShop(
  route = "/shop",
  options: Parameters<typeof createServer>[0] = {},
) {
  const server = createServer(options);
  renderApp(server, route);
  await screen.findByRole("heading", { name: "All Furniture & Living Pieces" });
  return server;
}

describe("the shop page", () => {
  it("shows the banner, the room pills and the first page of pieces", async () => {
    const server = await openShop();
    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });

    expect(screen.getByTestId("catalogue-total")).toHaveTextContent("5"); // 3 + 1 + 1 pieces across the rooms
    expect(screen.getByRole("button", { name: "All (5)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/handcrafted pieces/)).toHaveTextContent(
      "Showing 1–4 of 4 handcrafted pieces",
    );
    const query = server.lastListQuery();
    expect(query.get("ordering")).toBe("-is_featured,-created_at");
    expect(query.get("page")).toBe("1");
  });

  it("reads its filters from the address, so shared links and refreshes work", async () => {
    const server = await openShop(
      "/shop?category=dining&in_stock=1&min_price=100000&sort=price_desc",
    );
    await screen.findByRole("heading", { name: "Naivasha Teak Dining Table" });

    const query = server.lastListQuery();
    expect(query.get("category")).toBe("dining");
    expect(query.get("in_stock")).toBe("true");
    expect(query.get("min_price")).toBe("100000");
    expect(query.get("ordering")).toBe("-price_from");
    expect(sidebar().getByRole("checkbox", { name: /Dining/ })).toBeChecked();
    expect(sidebar().getByRole("checkbox", { name: /In Stock/ })).toBeChecked();
    expect(sidebar().getByLabelText("Minimum price")).toHaveValue(100000);
    expect(screen.getByRole("combobox", { name: "Sort pieces" })).toHaveValue(
      "price_desc",
    );
    expect(sidebar().getByText("Active (3)")).toBeInTheDocument();
  });

  it("lists each facet the API offers, with counts", async () => {
    await openShop();

    expect(
      await sidebar().findByRole("checkbox", { name: /Mvule/ }),
    ).toBeInTheDocument();
    expect(
      sidebar().getByRole("checkbox", { name: /Living Room/ }),
    ).toHaveAccessibleName(/3/);
    expect(
      sidebar().getByRole("button", { name: "Forest" }),
    ).toBeInTheDocument();
    expect(sidebar().getByText("KES 28,500 – KES 135,000")).toBeInTheDocument();
  });

  it("hides the material and colour groups when the catalogue has none", async () => {
    await openShop("/shop", {
      facets: {
        price: { min: null, max: null },
        materials: [],
        colors: [],
        in_stock_count: 0,
      },
    });

    expect(
      screen.queryByText("Timber & Core Materials"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Upholstery Tones")).not.toBeInTheDocument();
  });
});

describe("filtering", () => {
  it("narrows by several rooms at once", async () => {
    const user = userEvent.setup();
    const server = await openShop();

    await user.click(
      await sidebar().findByRole("checkbox", { name: /Dining/ }),
    );
    await user.click(sidebar().getByRole("checkbox", { name: /Bedroom/ }));

    await waitFor(() =>
      expect(server.lastListQuery().get("category")).toBe("dining,bedroom"),
    );
    expect(urlParams().get("category")).toBe("dining,bedroom");
    await waitFor(() =>
      expect(productNames()).toEqual([
        "Baringo Platform Bed + Stands",
        "Naivasha Teak Dining Table",
      ]),
    );
  });

  it("a room pill picks just that room, and All clears the choice", async () => {
    const user = userEvent.setup();
    const server = await openShop("/shop?category=dining,bedroom");
    await screen.findByRole("heading", { name: "Naivasha Teak Dining Table" });

    await user.click(screen.getByRole("button", { name: "Dining (1)" }));

    await waitFor(() =>
      expect(server.lastListQuery().get("category")).toBe("dining"),
    );
    expect(screen.getByRole("button", { name: "Dining (1)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "All (5)" }));

    await waitFor(() => expect(urlParams().has("category")).toBe(false));
    expect(screen.getByRole("button", { name: "All (5)" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("narrows by material and by colour, and can undo each", async () => {
    const user = userEvent.setup();
    const server = await openShop();

    await user.click(await sidebar().findByRole("checkbox", { name: /Mvule/ }));
    await waitFor(() =>
      expect(server.lastListQuery().get("material")).toBe("Mvule"),
    );

    await user.click(sidebar().getByRole("button", { name: "Forest" }));
    await waitFor(() =>
      expect(server.lastListQuery().get("color")).toBe("Forest"),
    );
    expect(sidebar().getByRole("button", { name: "Forest" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      sidebar().getByText("Forest", { selector: "strong" }),
    ).toBeInTheDocument();

    await user.click(sidebar().getByRole("button", { name: "Forest" }));
    await waitFor(() => expect(urlParams().has("color")).toBe(false)); // a cached result, so no new request
    expect(sidebar().getByRole("button", { name: "Forest" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(urlParams().get("material")).toBe("Mvule");
  });

  it("narrows to what is in stock", async () => {
    const user = userEvent.setup();
    const server = await openShop();
    await screen.findByRole("heading", { name: "Runda Executive Chair" });

    await user.click(sidebar().getByRole("checkbox", { name: /In Stock/ }));

    await waitFor(() =>
      expect(server.lastListQuery().get("in_stock")).toBe("true"),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Runda Executive Chair" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("narrows by a price band, and the same band clears it again", async () => {
    const user = userEvent.setup();
    const server = await openShop();

    await user.click(sidebar().getByRole("button", { name: "KES 80k–150k" }));

    await waitFor(() => {
      expect(server.lastListQuery().get("min_price")).toBe("80000");
      expect(server.lastListQuery().get("max_price")).toBe("150000");
    });
    expect(sidebar().getByLabelText("Minimum price")).toHaveValue(80000);

    await user.click(sidebar().getByRole("button", { name: "KES 80k–150k" }));

    await waitFor(() => expect(urlParams().has("min_price")).toBe(false)); // a cached result, so no new request
    expect(sidebar().getByLabelText("Minimum price")).toHaveValue(null);
    expect(
      sidebar().getByRole("button", { name: "KES 80k–150k" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("takes a typed price range when the box loses focus", async () => {
    const user = userEvent.setup();
    const server = await openShop();

    await user.type(sidebar().getByLabelText("Minimum price"), "50000");
    await user.tab();

    await waitFor(() =>
      expect(server.lastListQuery().get("min_price")).toBe("50000"),
    );
    expect(urlParams().get("min_price")).toBe("50000");
  });

  it("sorts by price in both directions", async () => {
    const user = userEvent.setup();
    const server = await openShop();
    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sort pieces" }),
      "Price: Low to High",
    );

    await waitFor(() =>
      expect(server.lastListQuery().get("ordering")).toBe("price_from"),
    );
    expect(urlParams().get("sort")).toBe("price_asc");
    await waitFor(() =>
      expect(productNames()[0]).toBe("Runda Executive Chair"),
    );

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sort pieces" }),
      "Price: High to Low",
    );

    await waitFor(() =>
      expect(productNames()[0]).toBe("Naivasha Teak Dining Table"),
    );
  });

  it("searches once typing pauses", async () => {
    const user = userEvent.setup();
    const server = await openShop();
    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });

    await user.type(
      screen.getByRole("searchbox", { name: /Filter by timber/ }),
      "mara",
    );

    await waitFor(() =>
      expect(server.lastListQuery().get("search")).toBe("mara"),
    );
    expect(urlParams().get("search")).toBe("mara");
    await waitFor(() =>
      expect(productNames()).toEqual(["Mara 3-Seater Linen Sofa"]),
    );
    // one request per pause, not one per keystroke
    expect(server.listQueries().filter((q) => q.get("search")).length).toBe(1);
  });

  it("clears every filter with Reset all", async () => {
    const user = userEvent.setup();
    const server = await openShop(
      "/shop?category=dining&in_stock=1&sort=price_asc&search=teak",
    );
    await screen.findByRole("heading", { name: "Naivasha Teak Dining Table" });

    await user.click(screen.getByRole("button", { name: /Reset all/ }));

    await waitFor(() => expect(currentUrl()).toBe("/shop"));
    expect(
      screen.getByRole("searchbox", { name: /Filter by timber/ }),
    ).toHaveValue("");
    expect(
      sidebar().getByRole("checkbox", { name: /Dining/ }),
    ).not.toBeChecked();
    expect(
      sidebar().getByRole("checkbox", { name: /In Stock/ }),
    ).not.toBeChecked();
    expect(server.listQueries().length).toBeGreaterThan(0);
  });

  it("explains an empty result and offers a way out", async () => {
    const user = userEvent.setup();
    await openShop("/shop?search=zzz");

    expect(
      await screen.findByRole("heading", {
        name: "No pieces match these filters",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("No pieces found")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reset all filters" }));

    expect(
      await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" }),
    ).toBeInTheDocument();
  });
});

describe("paging", () => {
  const thirty = { products: manyProducts(30) };

  it("walks through the pages with the right ranges", async () => {
    const user = userEvent.setup();
    const server = await openShop("/shop", thirty);
    await screen.findByRole("heading", { name: "Piece 01" });

    expect(screen.getByText(/handcrafted pieces/)).toHaveTextContent(
      "Showing 1–12 of 30 handcrafted pieces",
    );
    expect(
      screen.getByRole("button", { name: "Previous page" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Page 1" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("40% viewed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Page 2" }));

    await screen.findByRole("heading", { name: "Piece 13" });
    expect(server.lastListQuery().get("page")).toBe("2");
    expect(currentUrl()).toBe("/shop?page=2");
    expect(screen.getByText(/handcrafted pieces/)).toHaveTextContent(
      "Showing 13–24 of 30 handcrafted pieces",
    );

    await user.click(screen.getByRole("button", { name: "Next page" }));

    await screen.findByRole("heading", { name: "Piece 25" });
    expect(screen.getByText(/handcrafted pieces/)).toHaveTextContent(
      "Showing 25–30 of 30 handcrafted pieces",
    );
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByText("100% viewed")).toBeInTheDocument();
  });

  it("goes back to page 1 when a filter changes", async () => {
    const user = userEvent.setup();
    const server = await openShop("/shop?page=2", thirty);
    await screen.findByRole("heading", { name: "Piece 13" });

    await user.click(sidebar().getByRole("checkbox", { name: /In Stock/ }));

    await waitFor(() => expect(server.lastListQuery().get("page")).toBe("1"));
    expect(urlParams().has("page")).toBe(false);
  });

  it("falls back to page 1 when the address asks for a page that does not exist", async () => {
    const server = await openShop("/shop?page=9");

    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });

    expect(currentUrl()).toBe("/shop");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(server.lastListQuery().get("page")).toBe("1");
  });

  it("shows no pager when everything fits on one page", async () => {
    await openShop();
    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });

    expect(
      screen.queryByRole("navigation", { name: "Pagination" }),
    ).not.toBeInTheDocument();
  });
});

describe("the rest of the page", () => {
  it("switches between three and four columns", async () => {
    const user = userEvent.setup();
    await openShop();
    const grid = screen.getByTestId("product-grid");
    expect(grid).toHaveClass("lg:grid-cols-3");

    await user.click(screen.getByRole("button", { name: "4 columns" }));

    expect(grid).toHaveClass("lg:grid-cols-4");
    expect(grid).not.toHaveClass("lg:grid-cols-3");
  });

  it("offers a retry when the pieces cannot be loaded", async () => {
    await openShop("/shop", { productsStatus: 500 });

    expect(
      await screen.findByText("We could not load the pieces right now."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("opens the filters in a panel on small screens", async () => {
    const user = userEvent.setup();
    const server = await openShop();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const panel = await screen.findByRole("dialog", {
      name: "Filter products",
    });
    await user.click(within(panel).getByRole("checkbox", { name: /Dining/ }));

    await waitFor(() =>
      expect(server.lastListQuery().get("category")).toBe("dining"),
    );
    await user.click(
      within(panel).getByRole("button", { name: /^Show \d+ piece/ }),
    );
    expect(
      screen.queryByRole("dialog", { name: "Filter products" }),
    ).not.toBeInTheDocument();
  });

  it("asks a guest to sign in when they try to buy from the shop", async () => {
    const user = userEvent.setup();
    const server = await openShop();
    const card = (
      await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" })
    ).closest("article") as HTMLElement;

    await user.click(within(card).getByRole("button", { name: "Add to Cart" }));

    expect(
      await screen.findByRole("dialog", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(server.callsTo("/cart/items/", "POST")).toHaveLength(0);
  });
});
