import { trackDelhiveryShipment } from "./_lib/delhivery.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const waybill = req.query?.waybill;
  if (!waybill || !/^[A-Za-z0-9]+$/.test(String(waybill))) {
    return res.status(400).json({ error: "Missing or invalid waybill." });
  }

  try {
    const data = await trackDelhiveryShipment(String(waybill));
    return res.status(200).json(data);
  } catch (err) {
    console.error("delhivery-track error:", err);
    return res.status(502).json({ error: "Could not fetch tracking status right now." });
  }
}
