import { Link, Route, Routes } from "react-router-dom";

import { AuthModal } from "./components/AuthModal";
import { CartDrawer } from "./components/CartDrawer";
import { Header } from "./components/Header";
import { ScrollToTop } from "./components/ScrollToTop";
import { Toaster } from "./components/Toaster";
import { HomePage } from "./pages/HomePage";
import { ShopPage } from "./pages/ShopPage";
import { Footer } from "./sections/Footer";

function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-margin lg:px-margin-desktop py-space-3xl text-center space-y-space-md">
      <h1 className="font-display text-display text-on-surface">
        Page not found
      </h1>
      <p className="font-body-lg text-body-lg text-secondary">
        That page does not exist, or has moved.
      </p>
      <Link
        to="/"
        className="inline-block px-space-lg py-3 bg-primary text-on-primary rounded font-label-lg text-label-lg"
      >
        Back to the homepage
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Header />
      <main className="w-full pt-28 bg-surface min-h-screen">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <AuthModal />
      <CartDrawer />
      <Toaster />
    </>
  );
}
