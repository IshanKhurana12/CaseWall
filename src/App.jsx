import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CasesPage from "./components/CasesPage";
import { CartProvider } from "./context/CartContext";
import { Analytics } from "@vercel/analytics/react";
import SiteMarquee from "./components/SiteMarquee";
import { CLEANUP_TRIGGER_INTERVAL_MINUTES } from "./config";

// Every page except the catalog is split into its own chunk, so the homepage
// doesn't download checkout, order tracking, etc.
const JewelryCollection = lazy(() => import("./components/JewelryCollection"));
const ProductPage = lazy(() => import("./components/ProductPage"));
const CartPage = lazy(() => import("./components/CartPage"));
const CheckoutPage = lazy(() => import("./components/CheckoutPage"));
const OrderStatusPage = lazy(() => import("./components/OrderStatusPage"));
const OrderStatusLookup = lazy(() => import("./components/OrderStatusLookup"));
const ReturnPolicy = lazy(() => import("./components/Returnpolicy"));
const AboutPage = lazy(() => import("./components/InfoPages").then((m) => ({ default: m.AboutPage })));
const ShippingPolicyPage = lazy(() =>
  import("./components/InfoPages").then((m) => ({ default: m.ShippingPolicyPage }))
);
const PrivacyPolicyPage = lazy(() =>
  import("./components/InfoPages").then((m) => ({ default: m.PrivacyPolicyPage }))
);

function PageFallback() {
  return (
    <div className="page">
      <div className="state-block">
        <p>Loading…</p>
      </div>
    </div>
  );
}

export default function App() {
  React.useEffect(() => {
    let cancelled = false;
    async function callCleanup() {
      try {
        // Fire-and-forget; server will limit/ignore excessive runs
        const res = await fetch("/api/cleanup-reservations", { method: "GET", cache: "no-store" });
        if (!cancelled) {
          // optional: log in dev for visibility
          if (import.meta.env.DEV) console.log("cleanup-reservations status:", res.status);
        }
      } catch (e) {
        if (import.meta.env.DEV) console.error("cleanup trigger failed", e);
      }
    }

    // first run once the page is idle, so it never competes with page load
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 3000));
    idle(callCleanup);

    // schedule periodic triggers (minutes)
    const intervalMs = Math.max(1, Number(CLEANUP_TRIGGER_INTERVAL_MINUTES || 15)) * 60 * 1000;
    const id = setInterval(callCleanup, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);
  return (
    <CartProvider>
      <BrowserRouter>
        <SiteMarquee />
        <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<CasesPage />} />
          <Route path="/cases/:modelSlug" element={<CasesPage />} />
          <Route path="/devir" element={<JewelryCollection />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orderstatus" element={<OrderStatusLookup />} />
          <Route path="/order/:orderId" element={<OrderStatusPage />} />
          <Route path="/returnPolicy" element={<ReturnPolicy />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        </Routes>
        </Suspense>
        <Analytics />
      </BrowserRouter>
    </CartProvider>
  );
}
