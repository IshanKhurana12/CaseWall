// Shared by /api/verify-payment (browser return) and /api/cashfree-webhook
// (server-to-server). Whichever arrives first marks the order paid; the other
// sees it already done and does nothing, so stock is committed, the email is
// sent and the shipment is booked exactly once.
import { sendOrderConfirmationEmail } from "./mailer.js";
import { createShiprocketOrder } from "./shiprocket.js";

const DONE_STATUSES = new Set(["paid", "shipped", "delivered"]);

function variantRefFor(db, item) {
  const productRef = db.collection("products").doc(item.productId);
  return !item.variantId || item.variantId === "_legacy"
    ? productRef
    : productRef.collection("variants").doc(item.variantId);
}

// `payment` is a Cashfree payment object with payment_status === "SUCCESS".
// Returns { ok: true } or { ok: false, error }.
export async function confirmPaidOrder(db, orderId, payment, confirmedVia) {
  const orderRef = db.collection("orders").doc(orderId);

  // Cashfree amounts are in rupees, as are ours; compare in paise to dodge
  // floating-point noise.
  const snap = await orderRef.get();
  if (!snap.exists) return { ok: false, error: "Order not found." };
  const expectedPaise = Math.round(Number(snap.data().paymentAmount ?? snap.data().amount) * 100);
  const paidPaise = Math.round(Number(payment.payment_amount) * 100);
  if (paidPaise !== expectedPaise) {
    console.error("Payment amount mismatch for order", orderId, paidPaise, expectedPaise);
    await orderRef.update({ paymentAmountMismatch: true, paidAmountReceived: Number(payment.payment_amount) });
    return { ok: false, error: "Payment amount does not match order amount." };
  }

  // Flip to "paid" and commit stock (stock -= qty, reservedStock -= qty) in
  // one transaction, so two concurrent confirmations can't both deduct.
  const order = await db.runTransaction(async (tx) => {
    const s = await tx.get(orderRef);
    const current = s.data();
    if (DONE_STATUSES.has(current.status)) return null;

    const items = (current.items || []).map((it) => ({ ref: variantRefFor(db, it), qty: it.qty || 0 }));
    const variantSnaps = [];
    for (const it of items) variantSnaps.push(await tx.get(it.ref));

    // A payment can land after cleanup-reservations cancelled the order and
    // released its hold. Then there's no hold left to release — touching
    // reservedStock would eat into other customers' holds.
    const holdReleased = current.status === "cancelled";

    variantSnaps.forEach((vs, i) => {
      if (!vs.exists) return; // product/variant deleted since the order was placed
      const data = vs.data();
      const { ref, qty } = items[i];
      const update = {};
      if (!holdReleased) update.reservedStock = Math.max(0, (data.reservedStock || 0) - qty);
      if (typeof data.stock === "number") update.stock = Math.max(0, data.stock - qty);
      if (Object.keys(update).length) tx.update(ref, update);
    });

    tx.update(orderRef, {
      // Flag for the admin: stock may have sold out meanwhile, so check it
      // can be fulfilled (or refund from the Cashfree dashboard).
      ...(holdReleased ? { paidAfterCancel: true } : {}),
      status: "paid",
      cashfreePaymentId: String(payment.cf_payment_id),
      paymentGroup: payment.payment_group || null,
      paidAt: new Date().toISOString(),
      confirmedVia,
    });
    return current;
  });

  if (!order) return { ok: true }; // already confirmed elsewhere

  try {
    await sendOrderConfirmationEmail(order, orderId);
  } catch (mailErr) {
    console.error("Failed to send order confirmation email:", mailErr);
  }

  if (!order.shiprocket?.waybill) {
    try {
      const shipment = await createShiprocketOrder(order, orderId);
      const waybill = shipment.waybill || shipment.trackingId || shipment.shipmentId || null;
      if (!waybill && !shipment.shipmentId) {
        throw new Error("Shiprocket did not return a valid shipment/waybill for this order.");
      }

      await orderRef.update({
        shiprocket: {
          waybill,
          trackingId: shipment.trackingId || waybill,
          trackingUrl: shipment.trackingUrl || null,
          status: shipment.status || "booked",
          bookedAt: new Date().toISOString(),
        },
        shiprocketOrderId: shipment.shipmentId || null,
        shiprocketTrackingUrl: shipment.trackingUrl || null,
        shiprocketStatus: shipment.status || "booked",
        status: "shipped",
        shippedAt: new Date().toISOString(),
      });
    } catch (shipErr) {
      console.error("Shiprocket shipment creation failed for order", orderId, shipErr);
      await orderRef.update({ shiprocketError: String(shipErr.message || shipErr) });
    }
  }

  return { ok: true };
}
