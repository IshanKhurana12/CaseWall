import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import AddressForm, { AddressSummary, EMPTY_ADDRESS, validateAddress } from "./AddressForm";
import SignInButton from "./SignInButton";
import { LockIcon, PlusIcon } from "./Icons";
import { responsiveImg } from "../lib/images";
import "../siteChrome.css";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { RAZORPAY_KEY_ID, STORE_NAME, SHIPPING_RATE_RUPEES, SHIPPING_FREE_THRESHOLD_RUPEES } from "../config";
import { loadRazorpayScript } from "../lib/loadRazorpay";
import "../cartCheckout.css";
import useSeo from "../hooks/useSeo";

// Must match COD_HANDLING_FEE_RUPEES on the server (create-order.js / env
// var). This is only used for display here — the actual amount charged is
// whatever the server returns from /api/create-order.
const COD_HANDLING_FEE_RUPEES = 50;

function formatPrice(value) {
  if (value === undefined || value === null || value === "") return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));
  } catch {
    return `₹${value}`;
  }
}

export default function CheckoutPage() {
  useSeo({ title: "Checkout | CASEWALL", path: "/checkout", noindex: true });
  const { items, subtotal, clearCart, couponCode, couponDiscount } = useCart();
  const { user, ready, authFetch } = useAuth();
  const navigate = useNavigate();
  const discountedSubtotal = Math.max(0, subtotal - (Number(couponDiscount) || 0));
  // Shipping uses site-wide configurable constants
  const shippingRupees = discountedSubtotal >= SHIPPING_FREE_THRESHOLD_RUPEES ? 0 : SHIPPING_RATE_RUPEES;
  const totalRupees = discountedSubtotal + shippingRupees;
  // COD handling fee is a flat charge paid online now; the full order value
  // (totalRupees) remains due on delivery — it is NOT subtracted from totalRupees.
  const codGrandTotal = totalRupees + COD_HANDLING_FEE_RUPEES;

  const [email, setEmail] = useState("");
  const [savedAddresses, setSavedAddresses] = useState(null); // null = not loaded / guest
  const [selectedAddressId, setSelectedAddressId] = useState(null); // null = using the form
  const [draft, setDraft] = useState(EMPTY_ADDRESS);
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("PREPAID");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Signed in: use the Google email and load saved addresses (default first).
  useEffect(() => {
    if (!user) {
      setSavedAddresses(null);
      setSelectedAddressId(null);
      return;
    }
    setDraft((d) => (d.name ? d : { ...d, name: user.displayName || "" }));
    let cancelled = false;
    authFetch("/api/account?view=addresses")
      .then(({ addresses }) => {
        if (cancelled) return;
        setSavedAddresses(addresses);
        if (addresses.length) setSelectedAddressId(addresses[0].id);
      })
      .catch(() => !cancelled && setSavedAddresses([]));
    return () => {
      cancelled = true;
    };
  }, [user, authFetch]);

  // Clear a validation message as soon as the customer edits something.
  useEffect(() => {
    setError("");
  }, [draft, email, selectedAddressId, paymentMethod]);

  // Warn the user if they try to refresh/close the tab while a payment is in flight
  useEffect(() => {
    function handleBeforeUnload(e) {
      if (loading) {
        e.preventDefault();
        e.returnValue = ""; // required for Chrome to show the confirmation dialog
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [loading]);

  // Signed in with Google → the account email is used for the order; no field.
  const signedInEmail = user?.email || "";
  const orderEmail = signedInEmail || email;

    const selectedAddress = savedAddresses?.find((a) => a.id === selectedAddressId) || null;
  const usingForm = !selectedAddress;
  const address = selectedAddress || draft;

  // Same order as the page: address first, then email.
  function validate() {
    const addressError = validateAddress(address);
    if (addressError) return addressError;
    if (!orderEmail.trim() || !/^\S+@\S+\.\S+$/.test(orderEmail.trim())) return "Please enter a valid email address.";
    return "";
  }

  // Scroll to and focus the first incomplete field, so a tap on the pinned
  // Pay button (phones) shows exactly what's missing.
  function focusFirstProblem() {
    const checks = usingForm
      ? [
          ["co-name", !draft.name.trim()],
          ["co-phone", !/^\d{10}$/.test(draft.phone.trim())],
          ["co-line1", !draft.line1.trim()],
          ["co-pincode", !/^\d{6}$/.test(draft.pincode.trim())],
          ["co-city", !draft.city.trim()],
          ["co-state", !draft.state.trim()],
        ]
      : [];
    if (!signedInEmail) checks.push(["co-email", !email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())]);
    const hit = checks.find(([, bad]) => bad);
    const el = hit && document.getElementById(hit[0]);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus({ preventScroll: true });
    }
  }

  async function handlePay() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      focusFirstProblem();
      return;
    }
    setError("");
    setLoading(true);

    try {
      // The server re-fetches each variant's real price from Firestore —
      // the cart here only sends productId/variantId/qty, never amounts, so
      // a customer can't tamper with prices client-side. The server also
      // decides the actual amount charged online (full total for prepaid,
      // just the COD handling fee for COD) — the `amount` it returns below
      // is authoritative, not anything computed here.
      // authFetch adds the sign-in token (if any) so the order is linked to
      // the customer's account.
      const createData = await authFetch("/api/create-order", {
        method: "POST",
        body: {
          items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })),
          couponCode: couponCode || "",
          contact: { name: address.name.trim(), phone: address.phone.trim(), email: orderEmail.trim() },
          address: {
            label: address.label || "Home",
            line1: address.line1.trim(),
            line2: (address.line2 || "").trim(),
            city: address.city.trim(),
            state: address.state.trim(),
            pincode: address.pincode.trim(),
          },
          paymentMethod,
          saveAddress: Boolean(user && usingForm && saveNewAddress),
        },
      });

      const { orderId, razorpayOrderId, amount, currency, keyId } = createData;

      const Razorpay = await loadRazorpayScript();

      const rzp = new Razorpay({
        key: keyId || RAZORPAY_KEY_ID,
        order_id: razorpayOrderId,
        amount,
        currency,
        name: STORE_NAME,
        description: `Order #${orderId}`,
        prefill: {
          name: address.name.trim(),
          contact: address.phone.trim(),
          email: orderEmail.trim() || undefined,
        },
        notes: { orderId },
        theme: { color: "#111827" },
        handler: async function (response) {
          try {
            // Payment success from the widget is only a hint — it is NOT
            // trusted on its own. The server independently verifies the
            // Razorpay signature before marking the order "paid" in
            // Firestore, and a Razorpay webhook double-checks the same
            // thing server-to-server as a safety net.
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok || !verifyData.ok) {
              throw new Error(verifyData.error || "Payment verification failed.");
            }
            clearCart();
            navigate(`/order/${orderId}`);
          } catch (err) {
            console.error(err);
            setError("Payment was received but we couldn't confirm it automatically. Don't worry — message us on WhatsApp with your order id and we'll confirm manually.");
            navigate(`/order/${orderId}`);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      });

      rzp.on("payment.failed", function () {
        setError("Payment failed or was cancelled. You can try again.");
        setLoading(false);
      });

      rzp.open();
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const errorBox = error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;

  const payButton = (
    <button type="button" className="btn btn-primary btn-block btn-lg" onClick={handlePay} disabled={loading}>
      <LockIcon size={18} />
      {loading
        ? "Processing…"
        : paymentMethod === "COD"
        ? `Pay ${formatPrice(COD_HANDLING_FEE_RUPEES)} & place order`
        : `Pay ${formatPrice(totalRupees)} securely`}
    </button>
  );

  if (items.length === 0) {
    return (
      <div className="page">
        <div className="cc-wrap">
          <div className="empty-panel card-panel">
            <p className="empty-title">Your cart is empty</p>
            <Link to="/" className="btn btn-primary">
              Continue shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="co-wrap">
        <Link to="/cart" className="crumb-back">← Back to cart</Link>
        <h1 className="co-title">Checkout</h1>
        {signedInEmail && (
          <p className="co-signed-in-bar">
            Signed in as <strong>{signedInEmail}</strong> · order confirmation and tracking go here
          </p>
        )}
        {ready && !user && (
          <div className="co-signin-hint">
            <p>
              <strong>Faster checkout:</strong> sign in to use saved addresses.
            </p>
            <SignInButton label="Sign in with Google" />
          </div>
        )}

        <div className="co-grid">
          <div className="co-main">
            {/* 1. Payment */}
            <section className="card-panel co-step">
              <h2 className="co-step-title">
                <span className="co-step-num">1</span> Payment
              </h2>
              <div className="pay-options" role="radiogroup" aria-label="Payment method">
                <label className={"pay-option" + (paymentMethod === "PREPAID" ? " pay-option-active" : "")}>
                  <input type="radio" name="paymentMethod" value="PREPAID" checked={paymentMethod === "PREPAID"} onChange={() => setPaymentMethod("PREPAID")} />
                  <span>
                    <strong>Pay online</strong>
                    <small>UPI, debit/credit card, net banking</small>
                  </span>
                  <span className="pay-option-amt">{formatPrice(totalRupees)}</span>
                </label>
                <label className={"pay-option" + (paymentMethod === "COD" ? " pay-option-active" : "")}>
                  <input type="radio" name="paymentMethod" value="COD" checked={paymentMethod === "COD"} onChange={() => setPaymentMethod("COD")} />
                  <span>
                    <strong>Cash on delivery</strong>
                    <small>Pay {formatPrice(COD_HANDLING_FEE_RUPEES)} COD fee now, {formatPrice(totalRupees)} in cash on delivery</small>
                  </span>
                  <span className="pay-option-amt">+{formatPrice(COD_HANDLING_FEE_RUPEES)}</span>
                </label>
              </div>
            </section>
            {/* 2. Delivery address */}
            <section className="card-panel co-step">
              <h2 className="co-step-title">
                <span className="co-step-num">2</span> Delivery address
              </h2>

              {savedAddresses && savedAddresses.length > 0 && (
                <div className="co-addr-list" role="radiogroup" aria-label="Saved addresses">
                  {savedAddresses.map((a) => (
                    <label key={a.id} className={"co-addr-option" + (a.id === selectedAddressId ? " co-addr-option-active" : "")}>
                      <input
                        type="radio"
                        name="saved-address"
                        checked={a.id === selectedAddressId}
                        onChange={() => setSelectedAddressId(a.id)}
                      />
                      <AddressSummary address={a} />
                    </label>
                  ))}
                  <label className={"co-addr-option co-addr-new" + (usingForm ? " co-addr-option-active" : "")}>
                    <input type="radio" name="saved-address" checked={usingForm} onChange={() => setSelectedAddressId(null)} />
                    <span>
                      <PlusIcon size={16} /> Deliver to a new address
                    </span>
                  </label>
                </div>
              )}

              {usingForm && (
                <>
                  <AddressForm value={draft} onChange={setDraft} idPrefix="co" showLabel={Boolean(user)} />
                  {user && (
                    <label className="check-row">
                      <input type="checkbox" checked={saveNewAddress} onChange={(e) => setSaveNewAddress(e.target.checked)} />
                      Save this address to my account
                    </label>
                  )}
                </>
              )}
            </section>

            {/* 3. Email — only for guests. Signed-in customers use their Google
                email (shown under the title), so there's nothing to fill in. */}
            {!signedInEmail && (
              <section className="card-panel co-step">
                <h2 className="co-step-title">
                  <span className="co-step-num">3</span> Email for order updates
                </h2>
                <div className="field">
                  <label htmlFor="co-email">We'll send your order confirmation and tracking here</label>
                  <input
                    id="co-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>
              </section>
            )}

          </div>

          {/* Order summary */}
          <aside className="co-summary card-panel" aria-label="Order summary">
            <h2 className="panel-title">Order summary</h2>
            <ul className="co-items">
              {items.map((i) => (
                <li key={i.key}>
                  <span className="co-item-img">
                    {i.image && <img {...responsiveImg(i.image, "56px", 320)} alt="" />}
                    <span className="co-item-qty">{i.qty}</span>
                  </span>
                  <span className="co-item-name">
                    {i.name}
                    {(i.model || i.color) && (
                      <small>
                        {i.model}
                        {i.model && i.color ? " · " : ""}
                        {i.color}
                      </small>
                    )}
                  </span>
                  <span>{formatPrice((Number(i.price) || 0) * i.qty)}</span>
                </li>
              ))}
            </ul>
            <div className="sum-line">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            {couponCode && (
              <div className="sum-line sum-good">
                <span>Coupon {couponCode}</span>
                <span>−{formatPrice(couponDiscount)}</span>
              </div>
            )}
            <div className="sum-line">
              <span>Shipping</span>
              <span>{shippingRupees === 0 ? <span className="sum-good">Free</span> : formatPrice(shippingRupees)}</span>
            </div>
            <div className="sum-line sum-total">
              <span>Order total</span>
              <span>{formatPrice(totalRupees)}</span>
            </div>
            {paymentMethod === "COD" && (
              <>
                <div className="sum-line">
                  <span>COD fee (pay now)</span>
                  <span>{formatPrice(COD_HANDLING_FEE_RUPEES)}</span>
                </div>
                <div className="sum-line">
                  <span>Cash due on delivery</span>
                  <span>{formatPrice(totalRupees)}</span>
                </div>
                <div className="sum-line sum-total">
                  <span>You'll pay in total</span>
                  <span>{formatPrice(codGrandTotal)}</span>
                </div>
              </>
            )}

            <div className="co-pay-desktop">
              {errorBox}
              {payButton}
            </div>
            <p className="co-secure-note">
              Payments are processed securely by Razorpay. By placing the order you agree to our{" "}
              <Link to="/returnPolicy">return policy</Link>.
            </p>
          </aside>
        </div>
      </div>

      {/* Phones: pay button always visible at the bottom of the screen. */}
      <div className="co-paybar">
        {errorBox}
        <div className="co-paybar-row">
          <div className="co-paybar-total">
            <small>{paymentMethod === "COD" ? "Pay now" : "Total"}</small>
            <strong>{formatPrice(paymentMethod === "COD" ? COD_HANDLING_FEE_RUPEES : totalRupees)}</strong>
          </div>
          {payButton}
        </div>
      </div>

      {loading && (
        <div className="payment-lock-overlay" role="alertdialog" aria-live="assertive">
          <div className="payment-lock-box">
            <div className="payment-lock-spinner" />
            <p className="payment-lock-title">Processing your payment…</p>
            <p className="payment-lock-sub">
              Please don't close, refresh, or go back while we confirm your payment with Razorpay.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
