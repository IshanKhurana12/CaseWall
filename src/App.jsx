import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CasesPage from "./components/CasesPage";
import JewelryCollection from "./components/JewelryCollection";
import ProductPage from "./components/ProductPage";
import CartPage from "./components/CartPage";
import CheckoutPage from "./components/CheckoutPage";
import OrderStatusPage from "./components/OrderStatusPage";
import OrderStatusLookup from "./components/OrderStatusLookup";
import { CartProvider } from "./context/CartContext";
import { Analytics } from "@vercel/analytics/react";
import SiteMarquee from "./components/SiteMarquee";
import { CLEANUP_TRIGGER_INTERVAL_MINUTES } from "./config";

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

    // trigger immediately on first load
    callCleanup();

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
        <Routes>
          <Route path="/" element={<CasesPage />} />
          <Route path="/devir" element={<JewelryCollection />} />
          <Route path="/product/:id" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orderstatus" element={<OrderStatusLookup />} />
          <Route path="/order/:orderId" element={<OrderStatusPage />} />
        </Routes>
        <Analytics />
      </BrowserRouter>
    </CartProvider>
  );
}
