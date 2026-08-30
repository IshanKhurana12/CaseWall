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

// Shown on the product page, cart, and checkout so customers see it before
// they pay.
export const RETURN_POLICY_SHORT =
  "All sales are final — orders are non-refundable. Replacement only if the item arrives damaged, and only if you recorded an unboxing video.";

export const RETURN_POLICY_FULL = [
  "All orders are non-refundable. We don't offer cash/UPI refunds or cancellations once an order is placed and paid for.",
  "The only exception is a damaged item on arrival — in that case we offer a free replacement, not a refund.",
  "To claim a replacement, you must record a continuous, unedited video from the moment you open the sealed delivery package to fully unboxing the product. The video must clearly show the package's shipping label/AWB number and the damage.",
  "Replacement claims without an unboxing video showing the damage cannot be accepted.",
  "Report damage within 24 hours of delivery on WhatsApp with the video attached.",
];

// Shipping configuration (frontend reads VITE_... variables via import.meta.env)
// Defaults: free for orders >= 500, otherwise flat 80 rupees
const _shipRate = Number(import.meta.env.VITE_SHIPPING_RATE_RUPEES);
const _shipThreshold = Number(import.meta.env.VITE_SHIPPING_FREE_THRESHOLD_RUPEES);
export const SHIPPING_RATE_RUPEES = Number.isFinite(_shipRate) && _shipRate >= 0 ? _shipRate : 80;
export const SHIPPING_FREE_THRESHOLD_RUPEES = Number.isFinite(_shipThreshold) && _shipThreshold >= 0 ? _shipThreshold : 500;

// Frontend trigger for cleanup-reservations: minutes between automatic frontend-initiated runs
// Set `VITE_CLEANUP_TRIGGER_INTERVAL_MINUTES` in your .env for development.
const _cleanupInterval = Number(import.meta.env.VITE_CLEANUP_TRIGGER_INTERVAL_MINUTES);
export const CLEANUP_TRIGGER_INTERVAL_MINUTES = Number.isFinite(_cleanupInterval) && _cleanupInterval > 0 ? _cleanupInterval : 15;
