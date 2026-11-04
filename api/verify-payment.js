import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { getSuccessfulPayment } from "./_lib/cashfree.js";
import { confirmPaidOrder } from "./_lib/confirmPayment.js";

// Called by the browser after Cashfree checkout closes (or when the customer
// lands back on /order/:id). The browser only sends our order id — nothing it
// claims about the payment is trusted. We ask Cashfree directly, using the
// secret key only this server knows, whether the order was actually paid.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { orderId } = req.body || {};
    if (!orderId || typeof orderId !== "string") {
      return res.status(400).json({ error: "Missing order id." });
    }

    const db = getAdminDb();
    const snap = await db.collection("orders").doc(orderId).get();
    if (!snap.exists) return res.status(404).json({ error: "Order not found." });

    let payment;
    try {
      payment = await getSuccessfulPayment(orderId);
    } catch (fetchErr) {
      console.error("Could not fetch payments from Cashfree:", fetchErr);
      return res.status(500).json({ error: "Could not verify payment details." });
    }
    if (!payment) return res.status(200).json({ ok: false, pending: true, error: "Payment not completed yet." });

    const result = await confirmPaidOrder(db, orderId, payment, "verify");
    if (!result.ok) return res.status(400).json(result);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("verify-payment error:", err);
    return res.status(500).json({ error: "Could not verify payment." });
  }
}
