import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { isValidWebhookSignature } from "./_lib/cashfree.js";
import { confirmPaidOrder } from "./_lib/confirmPayment.js";

// Needed so we can verify the raw request body against the signature —
// Cashfree signs the exact bytes it sent, so any JSON re-serialization
// would break verification.
export const config = {
  api: { bodyParser: false },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

// This endpoint is the real safety net: even if the customer closes the
// tab right after paying (before the client-side verify-payment call
// finishes), Cashfree calls this URL directly, server-to-server, so the
// order still gets marked "paid" correctly and safely.
//
// create-order passes this URL to Cashfree as each order's notify_url, so no
// dashboard setup is required. Cashfree signs it with your Secret Key.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["x-webhook-signature"];
    const timestamp = req.headers["x-webhook-timestamp"];

    if (!isValidWebhookSignature(rawBody, timestamp, signature)) {
      return res.status(400).json({ error: "Invalid webhook signature." });
    }

    const event = JSON.parse(rawBody);
    const payment = event.data?.payment;
    const orderId = event.data?.order?.order_id;

    if (event.type === "PAYMENT_SUCCESS_WEBHOOK" && payment?.payment_status === "SUCCESS" && orderId) {
      const db = getAdminDb();
      // Our Firestore order id is the Cashfree order_id.
      const snap = await db.collection("orders").doc(orderId).get();
      if (snap.exists) {
        const result = await confirmPaidOrder(db, orderId, payment, "webhook");
        if (!result.ok) console.error("Webhook could not confirm order", orderId, result.error);
      }
    }

    // Always 200 once signature is valid, so Cashfree doesn't keep retrying.
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("cashfree-webhook error:", err);
    return res.status(500).json({ error: "Webhook processing failed." });
  }
}
