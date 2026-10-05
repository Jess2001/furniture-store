import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { tokenStore } from "./lib/api";
import { currentUrl, renderApp } from "./test/render";
import { categories as baseCategories, createServer } from "./test/server";

const card = (name: string) =>
  screen.getByRole("heading", { name }).closest("article") as HTMLElement;

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("homepage catalog", () => {
  it("shows every room tile with its live item count", async () => {
    renderApp(createServer());

    const tile = await screen.findByRole("link", {
      name: /Living Room.*Deep sectionals/s,
    });

    expect(within(tile).getByText("3 Items")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Bedroom.*Platform beds/s }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("1 Item")).toHaveLength(2); // singular wording: Dining and Bedroom
  });

  it("loads the featured pieces by default", async () => {
    const server = createServer();
    renderApp(server);

    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });

    expect(server.listQueries()[0].get("featured")).toBe("true");
  });

  it("renders badge, sale price, stock label and swatches from the API", async () => {
    renderApp(createServer());
    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });
    const mara = card("Mara 3-Seater Linen Sofa");

    expect(within(mara).getByText("Best Seller")).toBeInTheDocument();
    expect(within(mara).getByText("KES 84,500")).toBeInTheDocument();
    expect(within(mara).getByText("KES 92,000")).toHaveClass("line-through");
    expect(within(mara).getByText("In Stock (3 left)")).toBeInTheDocument();
    expect(within(mara).getByText("Fabric:")).toBeInTheDocument();
    expect(
      within(mara).getByRole("button", { name: "Sand Linen" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(mara).getByRole("button", { name: "Forest" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("switches price when another swatch is chosen", async () => {
    const user = userEvent.setup();
    renderApp(createServer());
    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });
    const mara = card("Mara 3-Seater Linen Sofa");

    await user.click(within(mara).getByRole("button", { name: "Forest" }));

    expect(within(mara).getByText("KES 88,000")).toBeInTheDocument();
    expect(within(mara).getByText("KES 96,000")).toBeInTheDocument();
  });

  it("shows size chips for products sold by size and lets a sold-out size be seen but not bought", async () => {
    const user = userEvent.setup();
    renderApp(createServer());
    await screen.findByRole("heading", {
      name: "Baringo Platform Bed + Stands",
    });
    const bed = card("Baringo Platform Bed + Stands");

    expect(within(bed).getByRole("button", { name: "Queen" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      within(bed).getByRole("button", { name: "Add to Cart" }),
    ).toBeEnabled();

    await user.click(within(bed).getByRole("button", { name: "King" }));

    expect(within(bed).getByText("KES 112,000")).toBeInTheDocument();
    expect(
      within(bed).getByRole("button", { name: "Out of Stock" }),
    ).toBeDisabled();
  });

  it("disables buying for a product that is out of stock", async () => {
    renderApp(createServer());
    await screen.findByRole("heading", { name: "Runda Executive Chair" });
    const chair = card("Runda Executive Chair");

    expect(
      within(chair).getByText("Out of Stock", { selector: "span" }),
    ).toBeInTheDocument();
    expect(
      within(chair).getByRole("button", { name: "Out of Stock" }),
    ).toBeDisabled();
  });

  it("filters the featured pieces by room with the small chips", async () => {
    const user = userEvent.setup();
    const server = createServer();
    renderApp(server);
    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });

    await user.click(screen.getByRole("button", { name: "Dining (1)" }));

    await screen.findByRole("heading", { name: "Naivasha Teak Dining Table" });
    expect(server.lastListQuery().get("category")).toBe("dining");
    expect(
      screen.queryByRole("heading", { name: "Mara 3-Seater Linen Sofa" }),
    ).not.toBeInTheDocument();
  });

  it("offers a way into the full shop", async () => {
    renderApp(createServer());

    expect(
      await screen.findByRole("link", { name: /View the full shop/ }),
    ).toHaveAttribute("href", "/shop");
  });

  it("offers a retry when the catalog cannot be loaded", async () => {
    renderApp(createServer({ productsStatus: 500 }));

    expect(
      await screen.findByText("We could not load the pieces right now."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});

describe("moving between pages", () => {
  it("opens the shop on a room when its tile is clicked", async () => {
    const user = userEvent.setup();
    const server = createServer();
    renderApp(server);

    await user.click(
      await screen.findByRole("link", { name: /Bedroom.*Platform beds/s }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "All Furniture & Living Pieces",
      }),
    ).toBeInTheDocument();
    expect(currentUrl()).toBe("/shop?category=bedroom");
    await waitFor(() =>
      expect(server.lastListQuery().get("category")).toBe("bedroom"),
    );
  });

  it("opens the shop on a room from the header nav", async () => {
    const user = userEvent.setup();
    const server = createServer();
    renderApp(server);
    const nav = await screen.findByRole("navigation", { name: "Main" });

    await user.click(await within(nav).findByRole("link", { name: "Dining" }));

    expect(currentUrl()).toBe("/shop?category=dining");
    await waitFor(() =>
      expect(server.lastListQuery().get("category")).toBe("dining"),
    );
    expect(within(nav).getByRole("link", { name: "Dining" })).toHaveClass(
      "text-primary",
    );
  });

  it("searches from the header and lands on the shop with the results", async () => {
    const user = userEvent.setup();
    renderApp(createServer());
    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });

    await user.type(
      screen.getByRole("searchbox", { name: "Search furniture" }),
      "teak{Enter}",
    );

    expect(
      await screen.findByRole("heading", {
        name: "Naivasha Teak Dining Table",
      }),
    ).toBeInTheDocument();
    expect(currentUrl()).toBe("/shop?search=teak");
    expect(
      screen.getByRole("searchbox", { name: /Filter by timber/ }),
    ).toHaveValue("teak");
    expect(
      screen.queryByRole("heading", { name: "Mara 3-Seater Linen Sofa" }),
    ).not.toBeInTheDocument();
  });

  it("goes back home from the shop breadcrumb", async () => {
    const user = userEvent.setup();
    renderApp(createServer(), "/shop");

    await user.click(await screen.findByRole("link", { name: "Home" }));

    expect(
      await screen.findByRole("heading", {
        name: "Furniture made for living.",
      }),
    ).toBeInTheDocument();
    expect(currentUrl()).toBe("/");
  });

  it("jumps to a homepage section from another page", async () => {
    const user = userEvent.setup();
    renderApp(createServer(), "/shop");
    const nav = await screen.findByRole("navigation", { name: "Main" });

    await user.click(within(nav).getByRole("link", { name: "Showroom" }));

    expect(currentUrl()).toBe("/#showroom-booking");
    expect(
      await screen.findByRole("heading", { name: "Visit The Kilima Showroom" }),
    ).toBeInTheDocument();
  });

  it("shows a friendly page for an address that does not exist", async () => {
    renderApp(createServer(), "/nope");

    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to the homepage" }),
    ).toHaveAttribute("href", "/");
  });
});

describe("layout resilience", () => {
  const manyRooms = Array.from({ length: 9 }, (_, i) => ({
    ...baseCategories[0],
    id: `room-${i}`,
    name: `Room ${i + 1}`,
    slug: `room-${i + 1}`,
  }));

  it("keeps the top nav short when there are many rooms, without losing any of them", async () => {
    renderApp(createServer({ categories: manyRooms }));

    const nav = await screen.findByRole("navigation", { name: "Main" });
    await within(nav).findByRole("link", { name: "Room 1" });

    expect(
      within(nav).getByRole("link", { name: "Room 6" }),
    ).toBeInTheDocument();
    expect(
      within(nav).queryByRole("link", { name: "Room 7" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Room 9 \(3\)/ }),
    ).toBeInTheDocument(); // still a homepage chip
  });
});

describe("signing in", () => {
  it("asks guests to sign in instead of adding to the cart", async () => {
    const user = userEvent.setup();
    const server = createServer();
    renderApp(server);
    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });

    await user.click(
      within(card("Mara 3-Seater Linen Sofa")).getByRole("button", {
        name: "Add to Cart",
      }),
    );

    expect(
      await screen.findByRole("dialog", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(server.callsTo("/cart/items/", "POST")).toHaveLength(0);
  });

  it("shows the server's message when the password is wrong", async () => {
    const user = userEvent.setup();
    renderApp(createServer());
    await user.click(await screen.findByRole("button", { name: "Account" }));

    await user.type(screen.getByLabelText("Email"), "jess@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no active account/i,
    );
    expect(tokenStore.access).toBeNull();
  });

  it("closes the dialog with Escape", async () => {
    const user = userEvent.setup();
    renderApp(createServer());
    await user.click(await screen.findByRole("button", { name: "Account" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("restores a saved session on page load", async () => {
    tokenStore.set({ access: "ACCESS", refresh: "REFRESH" });
    const server = createServer();
    renderApp(server);

    expect(
      await screen.findByLabelText("Signed in as jess@example.com"),
    ).toHaveTextContent("J");
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
    expect(server.callsTo("/auth/me/")[0].auth).toBe("Bearer ACCESS");
  });
});

describe("shopping", () => {
  async function signIn(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Account" }));
    await user.type(screen.getByLabelText("Email"), "jess@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("button", { name: "Sign out" });
  }

  it("adds the chosen variant to the cart and updates the header", async () => {
    const user = userEvent.setup();
    const server = createServer();
    renderApp(server);
    await signIn(user);
    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });
    const mara = card("Mara 3-Seater Linen Sofa");

    await user.click(within(mara).getByRole("button", { name: "Forest" }));
    await user.click(within(mara).getByRole("button", { name: "Add to Cart" }));

    await waitFor(() =>
      expect(server.callsTo("/cart/items/", "POST")).toHaveLength(1),
    );
    expect(server.callsTo("/cart/items/", "POST")[0].body).toEqual({
      variant_id: "v-forest",
      quantity: 1,
    });
    expect(
      await screen.findByRole("button", { name: "Cart (1) — KES 88,000" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("dialog", { name: "Your cart" }),
    ).toBeInTheDocument();
  });

  it("changes quantity and removes lines from the drawer", async () => {
    const user = userEvent.setup();
    const server = createServer();
    renderApp(server);
    await signIn(user);
    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });
    await user.click(
      within(card("Mara 3-Seater Linen Sofa")).getByRole("button", {
        name: "Add to Cart",
      }),
    );
    const drawer = await screen.findByRole("dialog", { name: "Your cart" });

    await user.click(
      await within(drawer).findByRole("button", {
        name: /Increase quantity of Mara/,
      }),
    );

    await waitFor(() =>
      expect(server.callsTo("/cart/items/item-1/", "PATCH")[0].body).toEqual({
        quantity: 2,
      }),
    );
    // the line total and the subtotal both read KES 169,000 with a single line in the cart
    expect(await within(drawer).findAllByText("KES 169,000")).toHaveLength(2);

    await user.click(within(drawer).getByRole("button", { name: "Remove" }));

    expect(
      await within(drawer).findByText(/Your cart is empty/),
    ).toBeInTheDocument();
  });

  it("shows when a carted line has a stock problem", async () => {
    tokenStore.set({ access: "ACCESS", refresh: "REFRESH" });
    const server = createServer();
    server.setCart({
      id: "cart1",
      item_count: 5,
      subtotal: "422500.00",
      has_problems: true,
      items: [
        {
          id: "item-1",
          quantity: 5,
          variant: {
            id: "v-sand",
            sku: "S",
            name: "Mara Sofa, Sand Linen",
            color: "Sand Linen",
            color_hex: "#E3DDD1",
            price: "84500.00",
            compare_at_price: null,
          },
          product: {
            name: "Mara 3-Seater Linen Sofa",
            slug: "mara",
            image_url: null,
          },
          line_total: "422500.00",
          problem: "insufficient_stock",
          max_available: 3,
        },
      ],
    });
    const user = userEvent.setup();
    renderApp(server);

    await user.click(
      await screen.findByRole("button", { name: /^Cart \(5\)/ }),
    );

    expect(await screen.findByText("Only 3 available")).toBeInTheDocument();
  });

  it("signs out and forgets the session", async () => {
    const user = userEvent.setup();
    const server = createServer();
    renderApp(server);
    await signIn(user);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(
      await screen.findByRole("button", { name: "Account" }),
    ).toBeInTheDocument();
    expect(tokenStore.access).toBeNull();
    expect(server.callsTo("/auth/logout/", "POST")[0].body).toEqual({
      refresh: "REFRESH",
    });
  });
});

describe("pieces without a backend yet", () => {
  it("tells the visitor honestly that the enquiry form is not connected", async () => {
    const user = userEvent.setup();
    renderApp(createServer());

    await user.type(await screen.findByLabelText("Full Name"), "Grace Njeri");
    await user.type(screen.getByLabelText("Phone / WhatsApp"), "+254712345678");
    await user.click(
      screen.getByRole("button", { name: "Book Showroom Visit" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      /not connected to the backend yet/i,
    );
  });

  it("keeps the wishlist disabled", async () => {
    renderApp(createServer());
    await screen.findByRole("heading", { name: "Mara 3-Seater Linen Sofa" });

    expect(screen.getByRole("button", { name: "Wishlist" })).toBeDisabled();
    expect(
      screen.getAllByRole("button", { name: /Add to wishlist/ })[0],
    ).toBeDisabled();
  });
});
