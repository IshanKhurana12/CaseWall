// Customer reviews — only signed-in customers who bought the product.
//
//   GET  /api/reviews?productId=…   → { canReview, reason, review }  (the caller's own status)
//   POST /api/reviews  { productId, rating, text }  → { review }     (create or update)
//
// Both need "Authorization: Bearer <Firebase ID token>". Published reviews are
// read by the browser directly from the `reviews` collection (firestore.rules
// allow public reads, no writes), so every write goes through this function.
import crypto from "node:crypto";
import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { InvalidTokenError, getUserFromRequest } from "./_lib/auth.js";

// Order statuses that count as "purchased".
const PURCHASED_STATUSES = new Set(["paid", "shipped", "delivered"]);
const MIN_TEXT = 10;
const MAX_TEXT = 1000;

// Public review docs never contain the uid — the id holds a one-way hash so
// each customer gets one review per product that they can later edit.
function reviewId(productId, uid) {
  const hash = crypto.createHash("sha256").update(uid).digest("hex").slice(0, 24);
  return `${productId}_${hash}`;
}

// "Ishan Khurana" -> "Ishan K." (privacy: no full surnames on the site).
function publicName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Verified buyer";
  const first = parts[0].slice(0, 40);
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first;
}

// Returns the id of an order in which this customer bought the product, or null.
// Matches orders placed while signed in (uid) and earlier guest orders placed
// with the same verified Google email.
async function findPurchase(db, user, productId) {
  const queries = [db.collection("orders").where("uid", "==", user.uid).limit(200).get()];
  if (user.email && user.emailVerified) {
    queries.push(db.collection("orders").where("contact.email", "==", user.email).limit(200).get());
  }
  for (const snap of await Promise.all(queries)) {
    for (const d of snap.docs) {
      const o = d.data();
      if (PURCHASED_STATUSES.has(o.status) && (o.items || []).some((it) => it.productId === productId)) {
        return d.id;
      }
    }
  }
  return null;
}

function toPublic(id, r) {
  return {
    id,
    productId: r.productId,
    name: r.name,
    rating: r.rating,
    text: r.text,
    verifiedPurchase: true,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
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
    console.error("reviews auth error:", err);
    return res.status(500).json({ error: "Something went wrong on our side. Please try again." });
  }
  if (!user) return res.status(401).json({ error: "Please sign in to write a review." });

  const productId = String((req.method === "GET" ? req.query?.productId : req.body?.productId) || "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(productId)) return res.status(400).json({ error: "Unknown product." });

  const db = getAdminDb();
  try {
    const productSnap = await db.collection("products").doc(productId).get();
    if (!productSnap.exists) return res.status(404).json({ error: "Unknown product." });

    const ref = db.collection("reviews").doc(reviewId(productId, user.uid));

    if (req.method === "GET") {
      const [existing, orderId] = await Promise.all([ref.get(), findPurchase(db, user, productId)]);
      return res.status(200).json({
        canReview: Boolean(orderId),
        reason: orderId ? null : "not_purchased",
        review: existing.exists ? toPublic(existing.id, existing.data()) : null,
      });
    }

    if (req.method === "POST") {
      const rating = Number(req.body?.rating);
      const text = String(req.body?.text || "").trim().replace(/\s+\n/g, "\n");
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Please choose a star rating." });
      }
      if (text.length < MIN_TEXT) return res.status(400).json({ error: `Please write at least ${MIN_TEXT} characters.` });
      if (text.length > MAX_TEXT) return res.status(400).json({ error: `Please keep your review under ${MAX_TEXT} characters.` });

      const orderId = await findPurchase(db, user, productId);
      if (!orderId) {
        return res.status(403).json({ error: "Only customers who bought this product can review it." });
      }

      const now = new Date().toISOString();
      const existing = await ref.get();
      const data = {
        productId,
        name: publicName(user.name),
        rating,
        text,
        // No orderId/uid here: review docs are publicly readable, and an
        // order id would open that customer's order page (name, address).
        status: existing.exists ? existing.data().status || "published" : "published",
        verifiedPurchase: true,
        createdAt: existing.exists ? existing.data().createdAt : now,
        updatedAt: now,
      };
      await ref.set(data);
      return res.status(200).json({ review: toPublic(ref.id, data) });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("reviews error:", err);
    return res.status(500).json({ error: "Couldn't save your review. Please try again." });
  }
}
