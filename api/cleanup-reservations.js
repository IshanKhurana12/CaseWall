import { getAdminDb } from "./_lib/firebaseAdmin.js";

// This endpoint scans for orders in "reserved" state whose reservedUntil
// timestamp has passed, cancels them, and restores the product stock.
// It is intended to be called periodically (e.g. via a cron job) or run
// manually by the operator.

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

          // Restore stock for each item
          for (const it of order.items || []) {
            const prodRef = db.collection("products").doc(it.productId);
            const prodSnap = await tx.get(prodRef);
            if (!prodSnap.exists) continue;
            const prod = prodSnap.data();
            if (typeof prod.stock === "number") {
              tx.update(prodRef, { stock: (prod.stock || 0) + (it.qty || 0) });
            }
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
