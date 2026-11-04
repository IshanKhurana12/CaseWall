import { trackShiprocketShipment } from "./_lib/shiprocket.js";
import { getAdminFromRequest } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Booking a shipment costs money and tracking exposes order details, so
  // only store admins may call this.
  if (!(await getAdminFromRequest(req))) {
    return res.status(401).json({ error: "Admin sign-in required." });
  }

  try {
    const { awb, orderId } = req.query || {};
    const identifier = String(awb || orderId || "").trim();

    if (!identifier) {
      return res.status(400).json({ error: "Missing awb or orderId query parameter." });
    }

    const result = await trackShiprocketShipment(identifier);
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error("shiprocket-track error:", err);
    return res.status(500).json({ error: err.message || "Could not track Shiprocket shipment." });
  }
}
