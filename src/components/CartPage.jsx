import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { doc, getDoc, collection } from "firebase/firestore/lite";
import { db } from "../firebase";
import { STORE_NAME, SHIPPING_RATE_RUPEES, SHIPPING_FREE_THRESHOLD_RUPEES } from "../config";
import "../cartCheckout.css";
import NotifyModal from "./NotifyModal";
import Footer from "./Footer";
import useSeo from "../hooks/useSeo";
import { responsiveImg } from "../lib/images";
import { LockIcon, TruckIcon } from "./Icons";
import "../siteChrome.css";

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
  useSeo({ title: "Your Cart | CASEWALL", path: "/cart", noindex: true });
  const { items, updateQty, removeItem, subtotal, couponCode, couponDiscount, setCouponCode, clearCoupon } = useCart();
  const navigate = useNavigate();
  const [modalMsg, setModalMsg] = React.useState("");
  const [couponInput, setCouponInput] = React.useState(couponCode || "");
  const [couponError, setCouponError] = React.useState("");
  const [couponLoading, setCouponLoading] = React.useState(false);
  const [couponSuccess, setCouponSuccess] = React.useState("");
  const itemsRef = React.useRef(items);
  itemsRef.current = items;
  // Shipping uses site-wide configurable constants
  const discountedSubtotal = Math.max(0, subtotal - (Number(couponDiscount) || 0));
  // Same rule as checkout and api/create-order.js: free shipping is decided
  // on the total after the coupon.
  const shippingRupees = discountedSubtotal >= SHIPPING_FREE_THRESHOLD_RUPEES ? 0 : SHIPPING_RATE_RUPEES;
  const totalRupees = discountedSubtotal + shippingRupees;

  React.useEffect(() => {
    setCouponInput(couponCode || "");
  }, [couponCode]);

  React.useEffect(() => {
    if (!couponCode || items.length === 0) return undefined;

    let cancelled = false;

    async function revalidateCoupon() {
      try {
        const response = await fetch("/api/validate-discount", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            couponCode,
            items: items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              qty: item.qty,
              price: item.price,
            })),
          }),
        });

        const payload = await response.json();
        if (cancelled) return;

        if (!response.ok) {
          clearCoupon();
          setCouponSuccess("");
          setCouponError(payload.error || "This coupon is no longer valid for your cart.");
          return;
        }

        setCouponCode(payload.code, payload.discountAmount || 0);
      } catch (err) {
        if (!cancelled) console.error("Could not revalidate coupon:", err);
      }
    }

    revalidateCoupon();
    return () => {
      cancelled = true;
    };
  }, [items, couponCode]);

  async function applyCoupon() {
    const raw = couponInput.trim();
    if (!raw) {
      setCouponError("Please enter a coupon code.");
      setCouponSuccess("");
      return;
    }

    setCouponLoading(true);
    setCouponError("");
    setCouponSuccess("");
    const itemsAtRequest = items;

    try {
      const response = await fetch("/api/validate-discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponCode: raw,
          items: items.map((item) => ({ productId: item.productId, variantId: item.variantId, qty: item.qty, price: item.price })),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        clearCoupon();
        throw new Error(payload.error || "This coupon is invalid.");
      }

      if (itemsRef.current !== itemsAtRequest) return;

      setCouponCode(payload.code, payload.discountAmount || 0);
      setCouponSuccess(payload.message || `${payload.code} applied successfully.`);
    } catch (err) {
      setCouponError(err.message || "Coupon could not be applied.");
    } finally {
      setCouponLoading(false);
    }
  }

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
      <div className="co-wrap">
        <Link to="/" className="crumb-back">← Continue shopping</Link>
        <h1 className="co-title">Your cart</h1>

        {items.length === 0 ? (
          <div className="empty-panel card-panel">
            <p className="empty-title">Your cart is empty</p>
            <p className="muted">Find a case you'll love for your phone.</p>
            <Link to="/" className="btn btn-primary">
              Browse {STORE_NAME}
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-list">
              {items.map((item) => (
                <div className="cart-row" key={item.key}>
                  <div className="cart-row-image">
                    {item.image ? <img {...responsiveImg(item.image, "120px", 320)} alt={item.name} loading="lazy" decoding="async" /> : <div className="card-media-fallback">No image</div>}
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
                    <div className="qty-stepper">
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

            <aside className="cart-summary card-panel" aria-label="Order summary">
              <h2 className="panel-title">Order summary</h2>
              {shippingRupees > 0 && (
                <p className="free-ship-hint">
                  <TruckIcon size={18} />
                  Add {formatPrice(SHIPPING_FREE_THRESHOLD_RUPEES - discountedSubtotal)} more for free delivery
                </p>
              )}
              {couponCode && (
                <div className="cart-summary-row" style={{ color: "var(--grip)", marginBottom: 6 }}>
                  <span>Coupon {couponCode}</span>
                  <span className="cart-summary-total">−{formatPrice(couponDiscount)}</span>
                </div>
              )}
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
              <div className="cart-summary-row cart-summary-grand">
                <span>Total</span>
                <span className="cart-summary-total">{formatPrice(totalRupees)}</span>
              </div>
              <div className="coupon-box">
                <label className="coupon-label" htmlFor="coupon-input">Coupon code</label>
                <div className="coupon-row">
                  <input
                    id="coupon-input"
                    className="coupon-input"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter code"
                  />
                  <button type="button" className="coupon-button" onClick={applyCoupon} disabled={couponLoading}>
                    {couponLoading ? "Checking…" : couponCode ? "Update" : "Apply"}
                  </button>
                </div>
                {couponError && <p className="checkout-error" style={{ marginTop: 8 }}>{couponError}</p>}
                {couponSuccess && <p className="coupon-success" style={{ marginTop: 8 }}>{couponSuccess}</p>}
                {couponCode && (
                  <button type="button" className="coupon-remove" onClick={clearCoupon}>
                    Remove coupon
                  </button>
                )}
              </div>
              <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }} onClick={() => navigate("/checkout")}>
                <LockIcon size={18} /> Proceed to checkout
              </button>
              <p className="co-secure-note">Secure checkout · UPI, cards, net banking or cash on delivery</p>
            </aside>
          </div>
        )}
        <NotifyModal message={modalMsg} onClose={() => setModalMsg("")} />
      </div>
      <Footer />
    </div>
  );
}