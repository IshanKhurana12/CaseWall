import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { getDiscountForCart } from "./_lib/discounts.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { items, couponCode } = req.body || {};
    const normalizedCode = String(couponCode || "").trim();

    if (!normalizedCode) {
      return res.status(400).json({ error: "Please enter a coupon code." });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Your cart is empty." });
    }

    const db = getAdminDb();
    const discountSnap = await db.collection("discounts").where("code", "==", normalizedCode.toUpperCase()).limit(1).get();
    if (discountSnap.empty) {
      return res.status(400).json({ error: "This coupon is invalid or not available right now." });
    }

    const discount = discountSnap.docs[0].data();
    if (discount.active === false) {
      return res.status(400).json({ error: "This coupon is no longer active." });
    }

    const productIds = [...new Set(items.map((item) => String(item.productId || "")).filter(Boolean))];
    const productDocs = await Promise.all(productIds.map((productId) => db.collection("products").doc(productId).get()));
    const products = productDocs.filter((snap) => snap.exists).map((snap) => ({ id: snap.id, ...snap.data() }));

    const result = getDiscountForCart({ items, products, discount });
    if (!result.valid) {
      return res.status(400).json({ error: result.reason || "This coupon cannot be used for your cart yet." });
    }

    return res.status(200).json({
      valid: true,
      code: result.code,
      label: result.label,
      message: result.reason,
      discountAmount: result.discountAmount,
      requiredQty: result.requiredQty,
      totalMatchedQty: result.totalMatchedQty,
    });
  } catch (err) {
    console.error("validate-discount error:", err);
    return res.status(500).json({ error: err.message || "Could not validate this coupon right now." });
  }
}
