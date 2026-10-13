import { useState, type FormEvent } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/useCart";
import { useCategories } from "../hooks/useCatalog";
import { useUi } from "../hooks/UiContext";
import { formatKES } from "../lib/format";
import { Icon } from "./Icon";

/** How many rooms fit in the top nav; every room is still one click away on the homepage tiles and in the shop sidebar. */
const NAV_ROOMS = 4;

const navLink =
  "font-label-lg text-label-lg whitespace-nowrap h-full flex items-center border-b-2 transition-colors";
const navIdle =
  "text-on-surface-variant hover:text-on-surface border-transparent";
const navActive = "text-primary border-primary font-semibold";

const iconButton =
  "hidden sm:flex w-10 h-10 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors";

export function Header() {
  const { user, openAuth, logout } = useAuth();
  const { setCartOpen } = useUi();
  const { data: categories } = useCategories();
  const { data: cart } = useCart();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const [query, setQuery] = useState("");

  const onShop = pathname === "/shop";
  const shopRoom = params.get("category");

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    const text = query.trim();
    navigate(text ? `/shop?search=${encodeURIComponent(text)}` : "/shop");
  };

  const onCartClick = () => (user ? setCartOpen(true) : openAuth());

  const cartLabel =
    user && cart
      ? `Cart (${cart.item_count}) — ${formatKES(cart.subtotal)}`
      : "Cart";
  const initials = user
    ? (user.first_name[0] ?? user.email[0]).toUpperCase()
    : "";

  return (
    <header className="fixed top-0 left-0 w-full z-50 bg-surface/95 backdrop-blur shadow-sm">
      <div className="bg-inverse-surface text-inverse-on-surface py-2 px-margin lg:px-margin-desktop">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="font-label-md text-label-md tracking-wider flex items-center gap-2">
            <Icon
              name="local_shipping"
              className="text-[16px] text-primary-fixed"
            />
            <span>
              White-glove delivery across Nairobi &amp; Kiambu | Showroom open
              Mon-Sat along Ngong Road
            </span>
          </p>
          <div className="flex items-center gap-space-lg font-label-md text-label-md">
            <span className="flex items-center gap-1 font-semibold text-inverse-on-surface">
              <Icon name="payments" className="text-[15px]" />
              KES (KSh)
            </span>
            <span className="text-surface-variant/40">|</span>
            <a
              className="hover:text-primary-fixed transition-colors flex items-center gap-1"
              href="tel:+254700123456"
            >
              <Icon name="call" className="text-[15px]" />
              +254 (0) 700 123 456
            </a>
          </div>
        </div>
      </div>

      <div className="h-20 max-w-7xl mx-auto px-margin lg:px-margin-desktop flex items-center justify-between gap-space-md">
        <Link
          className="flex items-center gap-3 shrink-0"
          to="/"
          aria-label="Luxury Living home"
        >
          {/* <img
            alt=""
            className="h-8 w-auto object-contain"
            src={designImages.logo}
            onError={(event) => (event.currentTarget.style.display = "none")}
          /> */}
          <div className="flex flex-col">
            <span className="font-title text-title tracking-[0.15em] text-on-surface font-semibold uppercase leading-none">
              Luxury
            </span>
            <span className="font-label-caps text-label-caps tracking-[0.25em] text-on-surface-variant uppercase mt-0.5 leading-none">
              LIVING
            </span>
          </div>
        </Link>

        <nav
          aria-label="Main"
          className="hidden xl:flex items-center gap-space-lg 2xl:gap-space-xl h-full min-w-0"
        >
          <Link
            to="/shop"
            className={`${navLink} ${onShop && !shopRoom ? navActive : navIdle}`}
          >
            Shop
          </Link>
          {categories?.slice(0, NAV_ROOMS).map((category) => (
            <Link
              key={category.id}
              to={`/shop?category=${category.slug}`}
              className={`${navLink} ${onShop && shopRoom === category.slug ? navActive : navIdle}`}
            >
              {category.name}
            </Link>
          ))}
          <Link to="/#craft" className={`${navLink} ${navIdle}`}>
            About
          </Link>
          <Link to="/#showroom-booking" className={`${navLink} ${navIdle}`}>
            Showroom
          </Link>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <form
            role="search"
            onSubmit={onSearch}
            className="hidden md:flex items-center rounded-full bg-surface-container px-4 py-2 focus-within:ring-2 focus-within:ring-primary/40 transition-shadow"
          >
            <Icon name="search" className="text-outline text-[18px] mr-2" />
            <input
              aria-label="Search furniture"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-transparent border-none outline-none font-body-sm text-body-sm text-on-surface placeholder:text-outline w-24 focus:w-44 transition-all duration-300"
              placeholder="Search"
              type="search"
            />
          </form>

          {user ? (
            <button
              type="button"
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className={iconButton}
            >
              <Icon name="logout" className="text-[22px]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={openAuth}
              aria-label="Account"
              title="Account"
              className={iconButton}
            >
              <Icon name="person" className="text-[22px]" />
            </button>
          )}

          <button
            type="button"
            disabled
            aria-label="Wishlist (coming soon)"
            title="Wishlist is coming soon"
            className={`${iconButton} opacity-60`}
          >
            <Icon name="favorite" className="text-[22px]" />
          </button>

          <button
            type="button"
            onClick={onCartClick}
            className="flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-on-primary hover:bg-primary-container transition-colors"
          >
            <Icon name="shopping_bag" className="text-[18px]" />
            <span className="font-label-md text-label-md font-semibold tracking-tight">
              {cartLabel}
            </span>
          </button>

          {user && (
            <div
              aria-label={`Signed in as ${user.email}`}
              className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center shrink-0 text-on-primary font-label-lg text-label-lg"
            >
              {initials}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
