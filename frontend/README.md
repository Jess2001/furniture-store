# LUXURY Living: storefront (React)

React 18 + TypeScript + Vite + Tailwind CSS 3 + TanStack Query. Talks to the Django API in `../backend`.

## Run it

```bash
cp .env.example .env          # VITE_API_URL=http://localhost:8000/api/v1
npm install
npm run dev                   # http://localhost:5173
```

The backend must be running (`make up`) with demo data (`docker compose exec backend python manage.py seed_demo`).
Vite's default port, 5173, is already allowed by the backend's CORS setting.

## Scripts

| Command             | What it does                                                    |
| ------------------- | --------------------------------------------------------------- |
| `npm run dev`       | dev server with hot reload                                      |
| `npm run build`     | type-check, then production build into `dist/`                  |
| `npm test`          | unit and integration tests (Vitest + Testing Library, fake API) |
| `npm run typecheck` | TypeScript only                                                 |

## Structure

```
src/
  lib/          api.ts (fetch + token refresh), types.ts (API shapes), format.ts (KES, stock labels)
  auth/         AuthContext: login, register, logout, session restore
  cart/         useCart: TanStack Query hooks; every cart call returns the whole updated cart
  hooks/        useCatalog (categories, products), UiContext (cart drawer, selected room, search, toast)
  components/   Header, AuthModal, CartDrawer, Modal, Toaster, Icon
  sections/     Hero, ExploreBySpace, FeaturedPieces, ProductCard, Craft, Reviews, Showroom, Footer
  content/      static copy and design photos for parts with no backend yet
  test/         fake API server used by the tests
tailwind.config.js   design tokens ported from the Stitch export
```

## What is real and what is not yet

| Real (talks to the API)                                          | Static or disabled for now                                |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| Room tiles and counts, nav, featured pieces, room filter, search | Reviews (Phase 7)                                         |
| Swatches, size chips, sale price, stock labels, badges           | Wishlist hearts (Phase 7)                                 |
| Sign in, register, sign out, session restore, token refresh      | Showroom form and newsletter (need an enquiries endpoint) |
| Add to cart, change quantity, remove, header total               | Checkout button (arrives with payments)                   |

## Notes

- Tokens are kept in `localStorage`. That is simple, but any XSS bug could read them. Moving the refresh token to an
  httpOnly cookie is a hardening task for later.
- Photos come from the Stitch export (`src/content/images.ts`) until you host your own. Product and category images
  that the API returns as `placehold.co` placeholders are swapped for the design photo in development.
