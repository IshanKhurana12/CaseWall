import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { doc, getDoc } from "firebase/firestore";
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
                <div className="cart-row" key={item.id}>
                  <div className="cart-row-image">
                    {item.image ? <img src={item.image} alt={item.name} /> : <div className="card-media-fallback">No image</div>}
                  </div>
                  <div className="cart-row-body">
                    {item.model && <p className="card-model">{item.model}</p>}
                    <p className="cart-row-name">{item.name}</p>
                    <p className="cart-row-price">{formatPrice(item.price, item.currency)}</p>
                  </div>
                  <div className="cart-row-controls">
                    <div className="pp-qty-stepper">
                      <button onClick={() => updateQty(item.id, item.qty - 1)} aria-label="Decrease quantity">−</button>
                      <span>{item.qty}</span>
                      <button onClick={async () => {
                        const desired = item.qty + 1;
                        try {
                          const snap = await getDoc(doc(db, "products", item.id));
                          if (!snap.exists()) {
                            setModalMsg("This product is no longer available.");
                            return;
                          }
                          const product = snap.data();
                          if (typeof product.stock === 'number') {
                            if (product.stock <= 0) {
                              setModalMsg("This product is out of stock.");
                              return;
                            }
                            if (desired > product.stock) {
                              setModalMsg(`Only ${product.stock} unit(s) available.`);
                              updateQty(item.id, product.stock);
                              return;
                            }
                          }
                          updateQty(item.id, desired);
                        } catch (err) {
                          console.error(err);
                          updateQty(item.id, desired);
                        }
                      }} aria-label="Increase quantity">+</button>
                    </div>
                    <button className="cart-remove" onClick={() => removeItem(item.id)}>
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

              <div className="pp-policy-notice" style={{ marginTop: 16 }}>
                <span className="pp-policy-badge">Non-refundable</span>
                <p>{RETURN_POLICY_SHORT} <a href="/#faq">Read the full policy →</a></p>
              </div>

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
