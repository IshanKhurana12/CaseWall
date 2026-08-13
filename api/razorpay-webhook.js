import crypto from "node:crypto";
import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { createDelhiveryShipment } from "./_lib/delhivery.js";

// Needed so we can verify the raw request body against the signature —
// Razorpay signs the exact bytes it sent, so any JSON re-serialization
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
// finishes), Razorpay calls this URL directly, server-to-server, so the
// order still gets marked "paid" correctly and safely.
//
// Configure this URL (https://yourdomain.com/api/razorpay-webhook) with the
// "payment.captured" event in the Razorpay Dashboard → Settings → Webhooks,
// and set the same secret you enter there as RAZORPAY_WEBHOOK_SECRET below.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers["x-razorpay-signature"];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is not set — rejecting webhook.");
      return res.status(500).end();
    }

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(String(signature || ""), "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(400).json({ error: "Invalid webhook signature." });
    }

    const event = JSON.parse(rawBody);

    if (event.event === "payment.captured" || event.event === "order.paid") {
      const payment = event.payload?.payment?.entity;
      const razorpayOrderId = payment?.order_id;
      const orderId = payment?.notes?.orderId;

      if (orderId) {
        const db = getAdminDb();
        const orderRef = db.collection("orders").doc(orderId);
        const snap = await orderRef.get();

        if (snap.exists) {
          const order = snap.data();
          if (order.razorpayOrderId === razorpayOrderId && order.status !== "paid") {
            // Verify payment amount matches expected server-side amount (paise)
            const paidAmount = payment.amount;
            if (Number(paidAmount) !== Number(order.amount)) {
              console.error("Webhook payment amount mismatch", orderId, paidAmount, order.amount);
              await orderRef.update({ paymentAmountMismatch: true, paymentAmount: paidAmount, expectedAmount: order.amount });
            } else {
              await orderRef.update({
                status: "paid",
                razorpayPaymentId: payment.id,
                paidAt: new Date().toISOString(),
                confirmedVia: "webhook",
              });

              // Send confirmation email (best-effort)
              try {
                const { sendOrderConfirmationEmail } = await import("./_lib/mailer.js");
                await sendOrderConfirmationEmail(order, orderId);
              } catch (mailErr) {
                console.error("Failed to send order confirmation email (webhook):", mailErr);
              }

              if (!order.delhivery?.waybill) {
                try {
                  const { waybill } = await createDelhiveryShipment(order, orderId);
                  await orderRef.update({ delhivery: { waybill, bookedAt: new Date().toISOString() }, status: "shipped" });
                } catch (shipErr) {
                  console.error("Delhivery shipment creation failed (webhook) for order", orderId, shipErr);
                  await orderRef.update({ delhiveryError: String(shipErr.message || shipErr) });
                }
              }
            }
            
          }
        }
      }
    }

    // Always 200 once signature is valid, so Razorpay doesn't keep retrying.
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("razorpay-webhook error:", err);
    return res.status(500).json({ error: "Webhook processing failed." });
  }
}
