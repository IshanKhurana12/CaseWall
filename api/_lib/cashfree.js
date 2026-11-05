// Server-side only. CASHFREE_SECRET_KEY must never be sent to the browser.
// Talks to the Cashfree Payment Gateway REST API directly (no SDK needed).
import crypto from "node:crypto";

const API_VERSION = "2023-08-01";

export function isCashfreeProduction() {
  return String(process.env.CASHFREE_ENV || "sandbox").toLowerCase() === "production";
}

function credentials() {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  if (!appId || !secretKey) {
    throw new Error("Missing CASHFREE_APP_ID / CASHFREE_SECRET_KEY in the server environment.");
  }
  return { appId, secretKey };
}

async function cashfreeRequest(path, { method = "GET", body } = {}) {
  const { appId, secretKey } = credentials();
  const base = isCashfreeProduction() ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-version": API_VERSION,
      "x-client-id": appId,
      "x-client-secret": secretKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Cashfree ${method} ${path} failed (${res.status}): ${data.message || "unknown error"}`);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

// Creates a Cashfree order. We reuse our Firestore order id as Cashfree's
// order_id, so a payment can always be looked up by our own id.
// `amount` is in RUPEES — Cashfree takes rupees, not paise.
export function createCashfreeOrder({ orderId, amount, customer, returnUrl, notifyUrl, expiresAt }) {
  return cashfreeRequest("/orders", {
    method: "POST",
    body: {
      order_id: orderId,
      order_amount: amount,
      order_currency: "INR",
      customer_details: {
        customer_id: customer.id,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
      },
      order_meta: {
        ...(returnUrl ? { return_url: returnUrl } : {}),
        ...(notifyUrl ? { notify_url: notifyUrl } : {}),
      },
      ...(expiresAt ? { order_expiry_time: expiresAt } : {}),
      order_note: `Order ${orderId}`,
    },
  });
}

// Every payment attempt on an order (SUCCESS, PENDING, FAILED, USER_DROPPED…).
export async function getOrderPayments(orderId) {
  const payments = await cashfreeRequest(`/orders/${encodeURIComponent(orderId)}/payments`);
  return Array.isArray(payments) ? payments : [];
}

// Returns the successful payment for an order, or null if it isn't paid yet.
export async function getSuccessfulPayment(orderId) {
  return (await getOrderPayments(orderId)).find((p) => p.payment_status === "SUCCESS") || null;
}

// Closes a Cashfree order so it can no longer be paid.
export function terminateCashfreeOrder(orderId) {
  return cashfreeRequest(`/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    body: { order_status: "TERMINATED" },
  });
}

// Cashfree signs webhooks as base64(HMAC-SHA256(timestamp + rawBody, secretKey)).
export function isValidWebhookSignature(rawBody, timestamp, signature) {
  const { secretKey } = credentials();
  if (!timestamp || !signature) return false;
  const expected = crypto.createHmac("sha256", secretKey).update(String(timestamp) + rawBody).digest("base64");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
