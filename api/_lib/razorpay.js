// Server-side only. RAZORPAY_KEY_SECRET must never be sent to the browser.
import Razorpay from "razorpay";

let client;
export function getRazorpay() {
  if (!client) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      throw new Error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in the server environment.");
    }
    client = new Razorpay({ key_id, key_secret });
  }
  return client;
}
