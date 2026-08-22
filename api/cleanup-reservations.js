import { getAdminDb } from "./_lib/firebaseAdmin.js";

// This endpoint scans for orders in "reserved" state whose reservedUntil
// timestamp has passed, cancels them, and releases the held reservedStock
// on whichever doc actually holds it — a real variant, or (for old flat
// products with no variants subcollection) the product doc itself.
// It is intended to be called periodically (e.g. via a Vercel cron job).

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = getAdminDb();
    const now = new Date().toISOString();

    // Find a batch of expired reservations
    const q = db.collection("orders").where("status", "==", "reserved").where("reservedUntil", "<", now).limit(50);
    const snap = await q.get();
    if (snap.empty) return res.status(200).json({ processed: 0 });

    let processed = 0;
    const promises = [];
    snap.forEach((orderDoc) => {
      const orderRef = orderDoc.ref;
      promises.push(
        db.runTransaction(async (tx) => {
          const s = await tx.get(orderRef);
          if (!s.exists) return;
          const order = s.data();
          if (order.status !== "reserved") return;
          if (!order.reservedUntil || order.reservedUntil > new Date().toISOString()) return;

          // Release the held reservedStock for each item
          for (const it of order.items || []) {
            const productRef = db.collection("products").doc(it.productId);
            const variantRef =
              !it.variantId || it.variantId === "_legacy"
                ? productRef
                : productRef.collection("variants").doc(it.variantId);
            const variantSnap = await tx.get(variantRef);
            if (!variantSnap.exists) continue;
            const variant = variantSnap.data();
            tx.update(variantRef, { reservedStock: Math.max(0, (variant.reservedStock || 0) - (it.qty || 0)) });
          }

          tx.update(orderRef, { status: "cancelled", cancelledAt: new Date().toISOString(), cancelledReason: "reservation_expired" });
          processed += 1;
        })
      );
    });

    await Promise.all(promises);
    return res.status(200).json({ processed });
  } catch (err) {
    console.error("cleanup-reservations error:", err);
    return res.status(500).json({ error: "Could not cleanup reservations." });
  }
}