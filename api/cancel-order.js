import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { getOrderPayments, terminateCashfreeOrder } from "./_lib/cashfree.js";
import { confirmPaidOrder } from "./_lib/confirmPayment.js";

// Called by checkout when the Cashfree pop-up closes without a payment, so
// the stock hold is released now instead of after the 15-minute expiry.
// Nothing the browser says is trusted: we ask Cashfree whether the order was
// paid (or a payment is still in progress) before cancelling anything.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { orderId } = req.body || {};
    if (typeof orderId !== "string" || !/^[A-Za-z0-9]{1,64}$/.test(orderId)) {
      return res.status(400).json({ error: "Missing order id." });
    }

    const db = getAdminDb();
    const orderRef = db.collection("orders").doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Order not found." });
    if (snap.data().status !== "reserved") return res.status(200).json({ ok: true, status: snap.data().status });

    const payments = await getOrderPayments(orderId);
    const paid = payments.find((p) => p.payment_status === "SUCCESS");
    if (paid) {
      // The customer did pay (e.g. the pop-up closed late) — confirm instead.
      const result = await confirmPaidOrder(db, orderId, paid, "cancel-check");
      return res.status(200).json({ ok: result.ok, paid: true });
    }
    if (payments.some((p) => p.payment_status === "PENDING")) {
      // A UPI/bank payment is still being processed — keep the hold.
      return res.status(409).json({ error: "A payment is still in progress." });
    }

    // Stop the Cashfree order being paid later. If this fails, a late payment
    // is still handled safely by confirmPaidOrder (flagged paidAfterCancel).
    try {
      await terminateCashfreeOrder(orderId);
    } catch (termErr) {
      console.warn("Could not terminate Cashfree order", orderId, termErr.message);
    }

    // Release the hold on whichever doc holds it (variant, or the product doc
    // for "_legacy" items) and cancel — only if still reserved.
    await db.runTransaction(async (tx) => {
      const s = await tx.get(orderRef);
      const order = s.data();
      if (order.status !== "reserved") return;
      const items = (order.items || []).map((it) => {
        const productRef = db.collection("products").doc(it.productId);
        return {
          ref: !it.variantId || it.variantId === "_legacy" ? productRef : productRef.collection("variants").doc(it.variantId),
          qty: it.qty || 0,
        };
      });
      const variantSnaps = [];
      for (const it of items) variantSnaps.push(await tx.get(it.ref));
      variantSnaps.forEach((vs, i) => {
        if (!vs.exists) return;
        tx.update(items[i].ref, { reservedStock: Math.max(0, (vs.data().reservedStock || 0) - items[i].qty) });
      });
      tx.update(orderRef, { status: "cancelled", cancelledAt: new Date().toISOString(), cancelledReason: "customer_cancelled" });
    });

    return res.status(200).json({ ok: true, status: "cancelled" });
  } catch (err) {
    console.error("cancel-order error:", err);
    return res.status(500).json({ error: "Could not cancel the order." });
  }
}
