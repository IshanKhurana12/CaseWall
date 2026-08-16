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

              {/* <div className="pp-policy-notice" style={{ marginTop: 16 }}>
                <span className="pp-policy-badge">Non-refundable</span>
                <p>{RETURN_POLICY_SHORT}
                   </p>
              </div> */}
                     {/* <a className="wa-button wa-button-secondary"
            href={buildWhatsAppLink(product)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ask about ${product.name ?? "this cover"} on WhatsApp`}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12.004 2c-5.514 0-9.997 4.478-9.997 9.997 0 1.762.464 3.484 1.345 4.997L2 22l5.144-1.342a9.96 9.96 0 004.86 1.238h.004c5.514 0 9.997-4.478 9.997-9.997 0-2.671-1.04-5.182-2.927-7.07A9.935 9.935 0 0012.004 2zm0 18.153a8.13 8.13 0 01-4.144-1.134l-.297-.176-3.054.797.815-2.978-.193-.306a8.14 8.14 0 01-1.256-4.36c0-4.501 3.66-8.161 8.162-8.161 2.18 0 4.229.85 5.77 2.393a8.106 8.106 0 012.39 5.775c-.003 4.502-3.663 8.15-8.193 8.15z" />
            </svg>
            Ask on WhatsApp instead
          </a> */}
       

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
