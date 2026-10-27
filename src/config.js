// Store settings — edit these directly.

// Your WhatsApp number in international format, no + or spaces or dashes.
// Example: country code 91, number 9876543210 -> "919876543210"
export const WHATSAPP_NUMBER = "919871335748";

export const STORE_NAME = "CASEWALL";
export const STORE_TAGLINE = "Cases for phones people actually love";

// Public Razorpay Key ID — this is NOT secret, it's meant to be shipped to
// the browser (it only identifies your account for the checkout widget).
// The Key Secret must never appear in frontend code — it lives only in
// server-side environment variables used by the /api functions.
export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || "";

// The return/refund policy lives in src/components/Returnpolicy.jsx (the
// /returnPolicy page). Summaries in src/faqs.js, InfoPages.jsx,
// OrderStatusPage.jsx, lib/seo.js and scripts/prerender.mjs must match it.

// Shipping configuration (frontend reads VITE_... variables via import.meta.env)
// Defaults: free for orders >= 500, otherwise flat 80 rupees
const _shipRate = Number(import.meta.env.VITE_SHIPPING_RATE_RUPEES);
const _shipThreshold = Number(import.meta.env.VITE_SHIPPING_FREE_THRESHOLD_RUPEES);
export const SHIPPING_RATE_RUPEES = Number.isFinite(_shipRate) && _shipRate >= 0 ? _shipRate : 80;
export const SHIPPING_FREE_THRESHOLD_RUPEES = Number.isFinite(_shipThreshold) && _shipThreshold >= 0 ? _shipThreshold : 500;

// Pop-up shown once per visit on the cart page (components/OfferPopup).
// To run a different offer, change these fields (give it a new `id` so people
// who closed the last one see it again). Set `enabled: false` to turn it off.
// `{threshold}` in the text is replaced with the free-shipping amount above.
// Set `showFreeShippingProgress: false` for offers not about free shipping.
export const CART_OFFER = {
  enabled: true,
  id: "diwali-2026",
  icon: "🪔",
  label: "Diwali offer",
  title: "Free shipping on orders above {threshold}",
  showFreeShippingProgress: true,
};

// Frontend trigger for cleanup-reservations: minutes between automatic frontend-initiated runs
// Set `VITE_CLEANUP_TRIGGER_INTERVAL_MINUTES` in your .env for development.
const _cleanupInterval = Number(import.meta.env.VITE_CLEANUP_TRIGGER_INTERVAL_MINUTES);
export const CLEANUP_TRIGGER_INTERVAL_MINUTES = Number.isFinite(_cleanupInterval) && _cleanupInterval > 0 ? _cleanupInterval : 15;
