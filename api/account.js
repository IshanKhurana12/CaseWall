// Signed-in customer data: saved addresses and order history.
//
//   GET  /api/account?view=addresses
//   GET  /api/account?view=orders
//   POST /api/account  { action: "saveAddress", id?, address, makeDefault? }
//   POST /api/account  { action: "deleteAddress", id }
//   POST /api/account  { action: "setDefault", id }
//
// Every request needs "Authorization: Bearer <Firebase ID token>". All reads
// and writes go through the Admin SDK here; firestore.rules give browsers no
// direct access to users/* and no way to query orders.
import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { InvalidTokenError, cleanAddress, getUserFromRequest, upsertAddress } from "./_lib/auth.js";

// Abandoned or failed checkouts aren't real orders — keep them out of history.
const HIDDEN_STATUSES = new Set(["created", "reserved", "cancelled", "payment_failed"]);

function summarizeOrder(id, o) {
  return {
    id,
    status: o.status || "created",
    createdAt: o.createdAt || null,
    amount: Number(o.amount) || 0,
    paymentMethod: o.paymentMethod || "PREPAID",
    codAmount: Number(o.codAmount) || 0,
    items: (o.items || []).map((it) => ({
      name: it.name || "Item",
      qty: it.qty || 1,
      price: it.price ?? null,
      model: it.model || null,
      color: it.color || null,
      image: it.image || it.imageUrl || null,
      productId: it.productId || null,
    })),
    city: o.address?.city || null,
  };
}

async function listOrders(db, user) {
  // Orders placed while signed in carry the uid. Earlier guest orders are
  // matched by email — safe because Google accounts have verified emails.
  const queries = [db.collection("orders").where("uid", "==", user.uid).limit(100).get()];
  if (user.email && user.emailVerified) {
    queries.push(db.collection("orders").where("contact.email", "==", user.email).limit(100).get());
  }
  const snaps = await Promise.all(queries);
  const byId = new Map();
  for (const snap of snaps) for (const d of snap.docs) byId.set(d.id, d.data());
  return [...byId.entries()]
    .filter(([, o]) => !HIDDEN_STATUSES.has(o.status || "created"))
    .map(([id, o]) => summarizeOrder(id, o))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function listAddresses(db, uid) {
  const snap = await db.collection("users").doc(uid).collection("addresses").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.isDefault === true) - (a.isDefault === true) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let user;
  try {
    user = await getUserFromRequest(req);
  } catch (err) {
    if (err instanceof InvalidTokenError) {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
    console.error("account auth error:", err);
    return res.status(500).json({ error: "Something went wrong on our side. Please try again." });
  }
  if (!user) return res.status(401).json({ error: "Please sign in." });

  const db = getAdminDb();
  try {
    if (req.method === "GET") {
      const view = String(req.query?.view || "");
      if (view === "orders") return res.status(200).json({ orders: await listOrders(db, user) });
      if (view === "addresses") return res.status(200).json({ addresses: await listAddresses(db, user.uid) });
      return res.status(400).json({ error: "Unknown view." });
    }

    if (req.method === "POST") {
      const { action, id, address, makeDefault } = req.body || {};
      const col = db.collection("users").doc(user.uid).collection("addresses");

      if (action === "saveAddress") {
        const clean = cleanAddress(address);
        if (id) {
          const ref = col.doc(String(id));
          if (!(await ref.get()).exists) return res.status(404).json({ error: "Address not found." });
          await ref.update({ ...clean, updatedAt: new Date().toISOString() });
          if (makeDefault) await setDefault(db, col, ref.id);
        } else {
          await upsertAddress(db, user.uid, clean, { makeDefault: !!makeDefault });
        }
      } else if (action === "deleteAddress") {
        const ref = col.doc(String(id || ""));
        const snap = await ref.get();
        if (snap.exists) {
          await ref.delete();
          // Keep a default if one was just removed.
          if (snap.data().isDefault) {
            const next = (await listAddresses(db, user.uid))[0];
            if (next) await col.doc(next.id).update({ isDefault: true });
          }
        }
      } else if (action === "setDefault") {
        await setDefault(db, col, String(id || ""));
      } else {
        return res.status(400).json({ error: "Unknown action." });
      }
      return res.status(200).json({ addresses: await listAddresses(db, user.uid) });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("account error:", err);
    return res.status(400).json({ error: err.message || "Something went wrong." });
  }
}

async function setDefault(db, col, id) {
  const snap = await col.get();
  if (!snap.docs.some((d) => d.id === id)) throw new Error("Address not found.");
  const batch = db.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { isDefault: d.id === id }));
  await batch.commit();
}
