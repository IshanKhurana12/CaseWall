import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { RAZORPAY_KEY_ID, RETURN_POLICY_SHORT, STORE_NAME, SHIPPING_RATE_RUPEES, SHIPPING_FREE_THRESHOLD_RUPEES } from "../config";
import { loadRazorpayScript } from "../lib/loadRazorpay";
import "../cartCheckout.css";

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

function formatPrice(value) {
  if (value === undefined || value === null || value === "") return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));
  } catch {
    return `₹${value}`;
  }
}

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const navigate = useNavigate();
  // Shipping uses site-wide configurable constants
  const shippingRupees = subtotal >= SHIPPING_FREE_THRESHOLD_RUPEES ? 0 : SHIPPING_RATE_RUPEES;
  const totalRupees = subtotal + shippingRupees;
  const [form, setForm] = useState(EMPTY_FORM);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function validate() {
    if (!form.name.trim()) return "Please enter your full name.";
    if (!/^\d{10}$/.test(form.phone.trim())) return "Please enter a valid 10-digit phone number.";
    if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Please enter a valid email address.";
    if (!form.line1.trim()) return "Please enter your address.";
    if (!form.city.trim()) return "Please enter your city.";
    if (!form.state.trim()) return "Please enter your state.";
    if (!/^\d{6}$/.test(form.pincode.trim())) return "Please enter a valid 6-digit pincode.";
    if (!agreed) return "Please confirm you've read the return policy to continue.";
    return "";
  }

  async function handlePay() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setLoading(true);

    try {
      // The server re-fetches each product's real price from Firestore —
      // the cart here only sends product ids/quantities, never amounts, so
      // a customer can't tamper with prices client-side.
      const createRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.id, qty: i.qty })),
          contact: { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() },
          address: {
            line1: form.line1.trim(),
            line2: form.line2.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            pincode: form.pincode.trim(),
          },
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Could not create your order. Please try again.");

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
          name: form.name.trim(),
          contact: form.phone.trim(),
          email: form.email.trim() || undefined,
        },
        notes: { orderId },
        theme: { color: "#E1552B" },
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

  if (items.length === 0) {
    return (
      <div className="page">
        <div className="cc-wrap">
          <div className="state-block">
            <p className="state-title">Your cart is empty.</p>
            <Link to="/" className="pp-btn pp-btn-primary" style={{ display: "inline-block", marginTop: 14, textDecoration: "none", textAlign: "center" }}>
              Browse {STORE_NAME}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="cc-wrap">
        <Link to="/cart" className="pp-back-link">← Back to cart</Link>
        <h1 className="cc-title">Checkout</h1>

        <div className="cart-summary" style={{ marginBottom: 24 }}>
          {items.map((i) => (
            <div className="checkout-summary-line" key={i.id}>
              <span>{i.name} × {i.qty}</span>
              <span>{formatPrice((Number(i.price) || 0) * i.qty)}</span>
            </div>
          ))}
          <div className="checkout-summary-line" style={{ borderTop: "1.5px solid var(--line)", marginTop: 8, paddingTop: 10, fontWeight: 700 }}>
            <span>Subtotal</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="checkout-summary-line">
            <span>Shipping</span>
            <span>{shippingRupees === 0 ? <span style={{ color: "green" }}>Free</span> : formatPrice(shippingRupees)}</span>
          </div>
          <div className="checkout-summary-line" style={{ borderTop: "1.5px solid var(--line)", marginTop: 8, paddingTop: 10, fontWeight: 700 }}>
            <span>Total</span>
            <span>{formatPrice(totalRupees)}</span>
          </div>
          <p className="cart-summary-note">Shipping cost is confirmed for your pincode after you place the order.</p>
        </div>

        <form className="checkout-form" onSubmit={(e) => e.preventDefault()}>
          <div className="form-row">
            <label htmlFor="name">Full name</label>
            <input id="name" value={form.name} onChange={update("name")} autoComplete="name" />
          </div>
          <div className="form-row-pair">
            <div className="form-row">
              <label htmlFor="phone">Phone number</label>
              <input id="phone" value={form.phone} onChange={update("phone")} inputMode="numeric" maxLength={10} autoComplete="tel" placeholder="10-digit mobile" />
            </div>
            <div className="form-row">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={form.email} onChange={update("email")} autoComplete="email" />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="line1">Address line 1</label>
            <input id="line1" value={form.line1} onChange={update("line1")} autoComplete="address-line1" placeholder="House no., street" />
          </div>
          <div className="form-row">
            <label htmlFor="line2">Address line 2 (optional)</label>
            <input id="line2" value={form.line2} onChange={update("line2")} autoComplete="address-line2" placeholder="Landmark, apartment" />
          </div>
          <div className="form-row-pair">
            <div className="form-row">
              <label htmlFor="city">City</label>
              <input id="city" value={form.city} onChange={update("city")} autoComplete="address-level2" />
            </div>
            <div className="form-row">
              <label htmlFor="state">State</label>
              <input id="state" value={form.state} onChange={update("state")} autoComplete="address-level1" />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="pincode">Pincode</label>
            <input id="pincode" value={form.pincode} onChange={update("pincode")} inputMode="numeric" maxLength={6} autoComplete="postal-code" />
          </div>

          <div className="checkout-policy-check">
            <input
              type="checkbox"
              id="agree"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <label htmlFor="agree">
             
              <span className="pp-policy-badge">Read the policy for return and refunds before placing the order</span>
              <p> <a href="/returnPolicy">Read the full policy →</a></p>
            
              {/* <a href="/#faq" target="_blank" rel="noreferrer">Read the full policy →</a> */}

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
            </label>
          </div>

          {error && <p className="checkout-error">{error}</p>}

          <button type="button" className="pp-btn pp-btn-primary" onClick={handlePay} disabled={loading}>
            {loading ? "Processing…" : `Pay ${formatPrice(totalRupees)} with Razorpay`}
          </button>
        </form>
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