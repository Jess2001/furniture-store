import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { vi } from "vitest";

import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import { UiProvider } from "../hooks/UiContext";
import type { createServer } from "./server";

let currentLocation = "";

function LocationSpy() {
  const location = useLocation();
  currentLocation = location.pathname + location.search + location.hash;
  return null;
}

/** The address bar as the app currently sees it, e.g. "/shop?category=dining". */
export const currentUrl = () => currentLocation;

export function renderApp(
  server: ReturnType<typeof createServer>,
  route = "/",
) {
  vi.stubGlobal("fetch", server.fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[route]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AuthProvider>
          <UiProvider>
            <LocationSpy />
            <App />
          </UiProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
