import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { createShiprocketOrder } from "./_lib/shiprocket.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { orderId } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId." });
    }

    const db = getAdminDb();
    const orderRef = db.collection("orders").doc(orderId);
    const snap = await orderRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "Order not found." });
    }

    const order = snap.data();
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    if (order.status !== "paid") {
      return res.status(400).json({ error: "Order must be paid before Shiprocket shipment creation." });
    }

    if (order.shiprocket?.waybill) {
      return res.status(200).json({
        ok: true,
        alreadyBooked: true,
        shipment: order.shiprocket,
      });
    }

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

    return res.status(200).json({ ok: true, shipment, orderId });
  } catch (err) {
    console.error("shiprocket-create error:", err);
    return res.status(500).json({ error: err.message || "Could not create Shiprocket order." });
  }
}
