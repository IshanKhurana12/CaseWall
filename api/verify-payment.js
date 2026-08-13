import crypto from "node:crypto";
import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { getRazorpay } from "./_lib/razorpay.js";
import { sendOrderConfirmationEmail } from "./_lib/mailer.js";
import { createShiprocketOrder } from "./_lib/shiprocket.js";

function isValidSignature(orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature || ""), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { orderId, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};
    if (!orderId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment details." });
    }

    const db = getAdminDb();
    const orderRef = db.collection("orders").doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Order not found." });
    const order = snap.data();

    // The order must reference the same Razorpay order we created earlier —
    // this stops someone from replaying a signature from a different order.
    if (order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ error: "Order mismatch." });
    }

    // This is the actual trust boundary: only a request signed with the
    // Razorpay Key Secret (which only Razorpay and this server know) can
    // pass this check. Nothing the browser claims is trusted on its own.
    if (!isValidSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      return res.status(400).json({ error: "Payment signature verification failed." });
    }

    // Fetch payment details from Razorpay to verify amount and capture status.
    try {
      const razorpay = getRazorpay();
      const payment = await razorpay.payments.fetch(razorpay_payment_id);
      // Razorpay returns amount in paise; our order.amount is stored in paise.
      if (Number(payment.amount) !== Number(order.amount)) {
        console.error("Payment amount mismatch for order", orderId, payment.amount, order.amount);
        await orderRef.update({ paymentAmountMismatch: true, paymentAmount: payment.amount, expectedAmount: order.amount });
        return res.status(400).json({ error: "Payment amount does not match order amount." });
      }
      if (!payment.captured && payment.status !== "captured") {
        console.error("Payment not captured for order", orderId, payment.status);
        return res.status(400).json({ error: "Payment not captured yet." });
      }
    } catch (fetchErr) {
      console.error("Could not fetch payment from Razorpay:", fetchErr);
      return res.status(500).json({ error: "Could not verify payment details." });
    }

    // Idempotent: if the webhook already marked this order paid, don't redo work.
    if (order.status !== "paid") {
      await orderRef.update({
        status: "paid",
        razorpayPaymentId: razorpay_payment_id,
        paidAt: new Date().toISOString(),
      });
      // Send confirmation email (best-effort)
      try {
        await sendOrderConfirmationEmail(order, orderId);
      } catch (mailErr) {
        console.error("Failed to send order confirmation email:", mailErr);
      }
    }

    if (!order.shiprocket?.waybill) {
      try {
        const shipment = await createShiprocketOrder(order, orderId);
        const waybill = shipment.waybill || shipment.trackingId || shipment.shipmentId || null;
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

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("verify-payment error:", err);
    return res.status(500).json({ error: "Could not verify payment." });
  }
}
