import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { getRazorpay } from "./_lib/razorpay.js";
import { getDiscountForCart } from "./_lib/discounts.js";

const RESERVATION_MINUTES = 15;

// Resolve "variant" for a cart item — a real variant doc if the product has
// variants, otherwise the product doc itself acts as the (legacy) variant.
// This is what lets old flat products keep working with zero migration.
async function resolveVariant(tx, db, productRef, requestedVariantId) {
  const productSnap = await tx.get(productRef);
  if (!productSnap.exists) throw new Error("A product in your cart is no longer available.");
  const product = productSnap.data();

  if (!requestedVariantId || requestedVariantId === "_legacy") {
    return {
      product,
      variantRef: productRef,
      variant: {
        price: product.price,
        stock: product.stock,
        reservedStock: product.reservedStock || 0,
        model: product.model || null,
        color: null,
        active: product.inStock === false ? false : true,
      },
    };
  }

  const variantRef = productRef.collection("variants").doc(requestedVariantId);
  const variantSnap = await tx.get(variantRef);
  if (!variantSnap.exists) throw new Error("A product in your cart is no longer available.");
  return { product, variantRef, variant: variantSnap.data() };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { items, contact, address, couponCode } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Cart is empty." });
    }
    if (items.length > 50) {
      return res.status(400).json({ error: "Too many items in one order." });
    }
    if (!contact?.name || !contact?.phone || !/^\d{10}$/.test(String(contact.phone))) {
      return res.status(400).json({ error: "Please provide a valid name and 10-digit phone number." });
    }
    if (!contact?.email || !/^\S+@\S+\.\S+$/.test(String(contact.email))) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }
    if (!address?.line1 || !address?.city || !address?.state || !/^\d{6}$/.test(String(address.pincode))) {
      return res.status(400).json({ error: "Please provide a complete, valid address." });
    }

    const db = getAdminDb();
    let activeDiscount = null;
    let discountAmount = 0;

    if (typeof couponCode === "string" && couponCode.trim()) {
      const normalizedCode = couponCode.trim().toUpperCase();
      const discountSnap = await db.collection("discounts").where("code", "==", normalizedCode).limit(1).get();
      if (discountSnap.empty) {
        return res.status(400).json({ error: "This coupon is invalid or not available right now." });
      }
      activeDiscount = discountSnap.docs[0].data();
      if (activeDiscount.active === false) {
        return res.status(400).json({ error: "This coupon is no longer active." });
      }
    }

    // Normalize requested items. variantId is optional — missing/"_legacy"
    // means "old flat product, no variant subcollection".
    const requested = items
      .map((raw) => {
        const productId = String(raw.productId || "");
        const variantId = raw.variantId ? String(raw.variantId) : "_legacy";
        const qty = Math.max(1, Math.min(20, parseInt(raw.qty, 10) || 1));
        if (!productId) return null;
        return { productId, variantId, qty };
      })
      .filter(Boolean);

    if (requested.length === 0) return res.status(400).json({ error: "No valid items in cart." });

    const orderRef = db.collection("orders").doc();
    const orderId = orderRef.id;
    const reservationUntil = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000).toISOString();

    // Reserve stock and create order document atomically.
    // Firestore stores amounts in RUPEES. Razorpay still needs paise,
    // so we keep computing the paise versions too, only for the
    // Razorpay API call and the response below (unchanged behavior).
    const { resolvedItems, itemsAmountPaise, shippingPaise, totalAmountPaise } = await db.runTransaction(async (tx) => {
      let itemsAmountRupees = 0;
      const resolved = [];
      // key = variantRef.path → { variantRef, currentReserved, reserveQty }
      const stockUpdates = new Map();

      // PASS 1: all reads. Firestore transactions require every tx.get()
      // to happen before any tx.set()/tx.update().
      const productsById = new Map();
      for (const it of requested) {
        const productRef = db.collection("products").doc(it.productId);
        const { product, variantRef, variant } = await resolveVariant(tx, db, productRef, it.variantId);

        if (variant.active === false) throw new Error(`"${product.name}" is no longer available.`);
        productsById.set(it.productId, product);

        const price = Number(variant.price);
        if (!price || price <= 0) throw new Error(`"${product.name}" doesn't have a valid price.`);

        const label = variant.model
          ? `${product.name} (${variant.model}${variant.color ? ` - ${variant.color}` : ""})`
          : product.name;

        if (typeof variant.stock !== "number") throw new Error(`"${label}" has no stock configured.`);

        const key = variantRef.path;
        const already = stockUpdates.get(key);
        const currentReserved = already ? already.currentReserved : (variant.reservedStock || 0);
        const pendingReserve = already ? already.reserveQty : 0;
        const available = variant.stock - currentReserved - pendingReserve;

        if (available <= 0) throw new Error(`"${label}" is out of stock.`);
        if (it.qty > available) throw new Error(`Only ${available} unit(s) of "${label}" are available.`);

        if (already) {
          already.reserveQty += it.qty;
        } else {
          stockUpdates.set(key, {
            variantRef,
            currentReserved,
            reserveQty: it.qty,
          });
        }

        itemsAmountRupees += price * it.qty;
        const resolvedItem = {
          productId: it.productId,
          variantId: it.variantId, // "_legacy" for old flat products
          name: label,
          model: variant.model || null,
          color: variant.color || null,
          price,
          qty: it.qty,
        };
        // Only attach these if the product actually has them — don't
        // write hsnCode/gstRate as null/undefined for products that
        // don't have them set.
        if (product.hsnCode) resolvedItem.hsnCode = String(product.hsnCode);
        if (product.gstRate != null && product.gstRate !== "") resolvedItem.gstRate = Number(product.gstRate);
        resolved.push(resolvedItem);
      }

      if (resolved.length === 0) throw new Error("No valid items in cart.");

      if (activeDiscount) {
        const rule = getDiscountForCart({ items: resolved.map((item) => ({ ...item, price: item.price })), products: Array.from(productsById.values()), discount: activeDiscount });
        if (!rule.valid) {
          throw new Error(rule.reason || "This coupon cannot be used for your cart yet.");
        }
        discountAmount = Number(rule.discountAmount) || 0;
      }

      // PASS 2: all writes. No further reads allowed.
      // Holds stock via reservedStock instead of decrementing stock directly,
      // so `stock` only drops on confirmed payment and an expiry/cancel just
      // undoes the hold rather than needing to "add back" a possibly-stale number.
      for (const { variantRef, currentReserved, reserveQty } of stockUpdates.values()) {
        tx.update(variantRef, { reservedStock: currentReserved + reserveQty });
      }

      const SHIPPING_RATE_RUPEES = Number(process.env.SHIPPING_RATE_RUPEES || 80);
      const SHIPPING_FREE_THRESHOLD_RUPEES = Number(process.env.SHIPPING_FREE_THRESHOLD_RUPEES || 500);
      const discountedItemsAmount = Math.max(0, itemsAmountRupees - discountAmount);
      const shippingRupees = discountedItemsAmount >= SHIPPING_FREE_THRESHOLD_RUPEES ? 0 : SHIPPING_RATE_RUPEES;

      // Rounded rupee values — these are what get stored in Firestore.
      const itemsAmountRupeesRounded = Math.round(itemsAmountRupees * 100) / 100;
      const discountAmountRounded = Math.round(discountAmount * 100) / 100;
      const shippingRupeesRounded = Math.round(shippingRupees * 100) / 100;
      const totalRupeesRounded = Math.round((itemsAmountRupeesRounded - discountAmountRounded + shippingRupeesRounded) * 100) / 100;

      // Paise versions — only used for Razorpay + the API response, same as before.
      const itemsAmountPaiseLocal = Math.round(itemsAmountRupeesRounded * 100);
      const discountAmountPaiseLocal = Math.round(discountAmountRounded * 100);
      const shippingPaiseLocal = Math.round(shippingRupeesRounded * 100);
      const totalPaiseLocal = itemsAmountPaiseLocal - discountAmountPaiseLocal + shippingPaiseLocal;

      tx.set(orderRef, {
        items: resolved,
        contact: {
          name: String(contact.name).slice(0, 120),
          phone: String(contact.phone),
          email: String(contact.email).slice(0, 200),
        },
        address: {
          line1: String(address.line1).slice(0, 300),
          line2: address.line2 ? String(address.line2).slice(0, 300) : null,
          city: String(address.city).slice(0, 100),
          state: String(address.state).slice(0, 100),
          pincode: String(address.pincode),
        },
        // Stored in RUPEES (not paise).
        amount: totalRupeesRounded,
        itemsAmount: itemsAmountRupeesRounded,
        discountAmount: discountAmountRounded,
        shippingAmount: shippingRupeesRounded,
        couponCode: activeDiscount ? String(activeDiscount.code).toUpperCase() : null,
        currency: "INR",
        status: "reserved",
        reservedUntil: reservationUntil,
        nonRefundable: true,
        replacementOnly: true,
        createdAt: new Date().toISOString(),
      });

      return {
        resolvedItems: resolved,
        itemsAmountPaise: itemsAmountPaiseLocal,
        discountAmountPaise: discountAmountPaiseLocal,
        shippingPaise: shippingPaiseLocal,
        totalAmountPaise: Math.max(0, totalPaiseLocal),
      };
    });

    // Create Razorpay order; if it fails, restore stock and cancel
    const razorpay = getRazorpay();
    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: totalAmountPaise,
        currency: "INR",
        receipt: orderId,
        notes: { orderId },
      });
    } catch (rpErr) {
      console.error("Razorpay order creation failed, rolling back reservation:", rpErr);
      try {
        await db.runTransaction(async (tx) => {
          const orderSnap = await tx.get(orderRef);
          if (!orderSnap.exists) return;
          const orderDoc = orderSnap.data();
          for (const it of orderDoc.items || []) {
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
          tx.update(orderRef, { status: "cancelled", cancelledAt: new Date().toISOString(), cancelledReason: "razorpay_creation_failed" });
        });
      } catch (compErr) {
        console.error("Failed to compensate after razorpay order creation failure:", compErr);
      }
      return res.status(500).json({ error: "Could not create payment order. Please try again." });
    }

    try {
      await orderRef.update({ razorpayOrderId: razorpayOrder.id });
    } catch (uErr) {
      console.error("Failed to update order with razorpay id:", uErr);
    }

    return res.status(200).json({
      orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmountPaise,
      itemsAmount: itemsAmountPaise,
      shippingAmount: shippingPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      reservedUntil: reservationUntil,
    });
  } catch (err) {
    console.error("create-order error:", err);
    return res.status(500).json({ error: err.message || "Could not create your order. Please try again in a moment." });
  }
}