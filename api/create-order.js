import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { getRazorpay } from "./_lib/razorpay.js";

const RESERVATION_MINUTES = 15;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { items, contact, address } = req.body || {};

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

    // Normalize requested items
    const requested = items
      .map((raw) => {
        const productId = String(raw.productId || "");
        const qty = Math.max(1, Math.min(20, parseInt(raw.qty, 10) || 1));
        if (!productId) return null;
        return { productId, qty };
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
      const stockUpdates = [];

      // PASS 1: all reads. Firestore transactions require every tx.get()
      // to happen before any tx.set()/tx.update() — so we can't decrement
      // stock for item N before reading item N+1.
      for (const it of requested) {
        const productRef = db.collection("products").doc(it.productId);
        const snap = await tx.get(productRef);
        if (!snap.exists) throw new Error("A product in your cart is no longer available.");
        const product = snap.data();
        if (product.inStock === false) throw new Error(`"${product.name}" is out of stock.`);
        const price = Number(product.price);
        if (!price || price <= 0) throw new Error(`"${product.name}" doesn't have a valid price.`);

        if (typeof product.stock === "number") {
          if (product.stock <= 0) throw new Error(`"${product.name}" is out of stock.`);
          if (it.qty > product.stock) throw new Error(`Only ${product.stock} unit(s) of "${product.name}" are available.`);
          stockUpdates.push({ productRef, newStock: product.stock - it.qty });
        }

        itemsAmountRupees += price * it.qty;
        const resolvedItem = { productId: it.productId, name: product.name, price, qty: it.qty };
        // Only attach these if the product actually has them — don't
        // write hsnCode/gstRate as null/undefined for products that
        // don't have them set.
        if (product.hsnCode) resolvedItem.hsnCode = String(product.hsnCode);
        if (product.gstRate != null && product.gstRate !== "") resolvedItem.gstRate = Number(product.gstRate);
        resolved.push(resolvedItem);
      }

      if (resolved.length === 0) throw new Error("No valid items in cart.");

      // PASS 2: all writes. Safe now — every read above has completed.
      for (const { productRef, newStock } of stockUpdates) {
        tx.update(productRef, { stock: newStock });
      }

      const SHIPPING_RATE_RUPEES = Number(process.env.SHIPPING_RATE_RUPEES || 80);
      const SHIPPING_FREE_THRESHOLD_RUPEES = Number(process.env.SHIPPING_FREE_THRESHOLD_RUPEES || 500);
      const shippingRupees = itemsAmountRupees >= SHIPPING_FREE_THRESHOLD_RUPEES ? 0 : SHIPPING_RATE_RUPEES;

      // Rounded rupee values — these are what get stored in Firestore.
      const itemsAmountRupeesRounded = Math.round(itemsAmountRupees * 100) / 100;
      const shippingRupeesRounded = Math.round(shippingRupees * 100) / 100;
      const totalRupeesRounded = Math.round((itemsAmountRupeesRounded + shippingRupeesRounded) * 100) / 100;

      // Paise versions — only used for Razorpay + the API response, same as before.
      const itemsAmountPaiseLocal = Math.round(itemsAmountRupeesRounded * 100);
      const shippingPaiseLocal = Math.round(shippingRupeesRounded * 100);
      const totalPaiseLocal = itemsAmountPaiseLocal + shippingPaiseLocal;

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
        shippingAmount: shippingRupeesRounded,
        currency: "INR",
        status: "reserved",
        reservedUntil: reservationUntil,
        nonRefundable: true,
        replacementOnly: true,
        createdAt: new Date().toISOString(),
      });

      return { resolvedItems: resolved, itemsAmountPaise: itemsAmountPaiseLocal, shippingPaise: shippingPaiseLocal, totalAmountPaise: totalPaiseLocal };
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
            const prodRef = db.collection("products").doc(it.productId);
            const prodSnap = await tx.get(prodRef);
            if (!prodSnap.exists) continue;
            const prod = prodSnap.data();
            if (typeof prod.stock === "number") {
              tx.update(prodRef, { stock: prod.stock + (it.qty || 0) });
            }
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