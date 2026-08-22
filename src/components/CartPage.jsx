import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { doc, getDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { RETURN_POLICY_SHORT, STORE_NAME, SHIPPING_RATE_RUPEES, SHIPPING_FREE_THRESHOLD_RUPEES } from "../config";
import "../cartCheckout.css";
import NotifyModal from "./NotifyModal";

function formatPrice(value, currency = "INR") {
  if (value === undefined || value === null || value === "") return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `${currency} ${value}`;
  }
}

export default function CartPage() {
  const { items, updateQty, removeItem, subtotal } = useCart();
  const navigate = useNavigate();
  const [modalMsg, setModalMsg] = React.useState("");
  // Shipping uses site-wide configurable constants
  const shippingRupees = subtotal >= SHIPPING_FREE_THRESHOLD_RUPEES ? 0 : SHIPPING_RATE_RUPEES;
  const totalRupees = subtotal + shippingRupees;

  // Re-checks live stock before bumping qty up. Reads from the variant doc
  // if this item has a real variantId, otherwise falls back to the product
  // doc itself for legacy (non-variant) products — same fallback logic
  // used server-side in create-order.js.
  async function checkAvailableStock(productId, variantId) {
    if (!variantId || variantId === "_legacy") {
      const snap = await getDoc(doc(db, "products", productId));
      if (!snap.exists()) return { exists: false };
      const product = snap.data();
      if (typeof product.stock !== "number") return { exists: true, unlimited: true };
      return { exists: true, available: Math.max(0, product.stock - (product.reservedStock || 0)) };
    }
    const snap = await getDoc(doc(db, "products", productId, "variants", variantId));
    if (!snap.exists()) return { exists: false };
    const variant = snap.data();
    if (typeof variant.stock !== "number") return { exists: true, unlimited: true };
    return { exists: true, available: Math.max(0, variant.stock - (variant.reservedStock || 0)) };
  }

  return (
    <div className="page">
      <div className="cc-wrap">
        <Link to="/" className="pp-back-link">← Continue shopping</Link>
        <h1 className="cc-title">Your Cart</h1>

        {items.length === 0 ? (
          <div className="state-block">
            <p className="state-title">Your cart is empty.</p>
            <Link to="/" className="pp-btn pp-btn-primary" style={{ display: "inline-block", marginTop: 14, textDecoration: "none", textAlign: "center" }}>
              Browse {STORE_NAME}
            </Link>
          </div>
        ) : (
          <>
            <div className="cart-list">
              {items.map((item) => (
                <div className="cart-row" key={item.key}>
                  <div className="cart-row-image">
                    {item.image ? <img src={item.image} alt={item.name} /> : <div className="card-media-fallback">No image</div>}
                  </div>
                  <div className="cart-row-body">
                    {(item.model || item.color) && (
                      <p className="card-model">
                        {item.model}
                        {item.model && item.color ? " · " : ""}
                        {item.color}
                      </p>
                    )}
                    <p className="cart-row-name">{item.name}</p>
                    <p className="cart-row-price">{formatPrice(item.price, item.currency)}</p>
                  </div>
                  <div className="cart-row-controls">
                    <div className="pp-qty-stepper">
                      <button
                        onClick={() => updateQty(item.productId, item.variantId, item.qty - 1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span>{item.qty}</span>
                      <button
                        onClick={async () => {
                          const desired = item.qty + 1;
                          try {
                            const result = await checkAvailableStock(item.productId, item.variantId);
                            if (!result.exists) {
                              setModalMsg("This product is no longer available.");
                              return;
                            }
                            if (!result.unlimited) {
                              if (result.available <= 0) {
                                setModalMsg("This product is out of stock.");
                                return;
                              }
                              if (desired > result.available) {
                                setModalMsg(`Only ${result.available} unit(s) available.`);
                                updateQty(item.productId, item.variantId, result.available);
                                return;
                              }
                            }
                            updateQty(item.productId, item.variantId, desired);
                          } catch (err) {
                            console.error(err);
                            updateQty(item.productId, item.variantId, desired);
                          }
                        }}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    <button className="cart-remove" onClick={() => removeItem(item.productId, item.variantId)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-summary">
              <div className="cart-summary-row">
                <span>Subtotal</span>
                <span className="cart-summary-total">{formatPrice(subtotal)}</span>
              </div>
              <div className="cart-summary-row">
                <span>Shipping</span>
                <span className="cart-summary-total">
                  {shippingRupees === 0 ? (
                    <span style={{ color: "green" }}>Free</span>
                  ) : (
                    formatPrice(shippingRupees)
                  )}
                </span>
              </div>
              <div className="cart-summary-row" style={{ fontWeight: 700, marginTop: 8 }}>
                <span>Total</span>
                <span className="cart-summary-total">{formatPrice(totalRupees)}</span>
              </div>
              <p className="cart-summary-note">{`Shipping is Free for Orders above ${SHIPPING_FREE_THRESHOLD_RUPEES}.`}</p>

              <button className="pp-btn pp-btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={() => navigate("/checkout")}>
                Proceed to Checkout
              </button>
            </div>
          </>
        )}
        <NotifyModal message={modalMsg} onClose={() => setModalMsg("")} />
      </div>
    </div>
  );
}