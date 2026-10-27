import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getFirestore, onSnapshot } from "firebase/firestore";
import { app } from "../firebase";

// Full SDK (not Lite) for live onSnapshot updates; only this page pays for it.
const db = getFirestore(app);
import { STORE_NAME, WHATSAPP_NUMBER } from "../config";
import "../cartCheckout.css";
import useSeo from "../hooks/useSeo";
import { useAuth } from "../context/AuthContext";
import { CheckIcon } from "./Icons";
import "../siteChrome.css";

const STEPS = [
  { key: "paid", label: "Confirmed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
];

function formatPrice(value) {
  if (value === undefined || value === null) return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));
  } catch {
    return `₹${value}`;
  }
}

// The order document's `status` field is only ever written by trusted
// server code (the /api functions, via the Firebase Admin SDK) — Firestore
// security rules block clients from writing it directly (see firestore.rules).
// This page just listens in real time and reflects whatever the server has
// confirmed, so "payment in process" always reads the true, verified state
// rather than something the browser assumed after a redirect.
export default function OrderStatusPage() {
  useSeo({ title: "Order Status | CASEWALL", noindex: true });
  const { orderId } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [state, setState] = useState("loading"); // loading | found | notfound | error

  useEffect(() => {
    const ref = doc(db, "orders", orderId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setState("notfound");
          return;
        }
        setOrder(snap.data());
        setState("found");
      },
      (err) => {
        console.error("Order listener error:", err);
        setState("error");
      }
    );
    return () => unsub();
  }, [orderId]);

  if (state === "loading") {
    return (
      <div className="page">
        <div className="order-status-wrap">
          <p>Loading order…</p>
        </div>
      </div>
    );
  }

  if (state === "notfound" || state === "error") {
    return (
      <div className="page">
        <div className="order-status-wrap">
          <p className="order-status-title">Couldn't find this order.</p>
          <Link to="/" className="pp-back-link">← Back to {STORE_NAME}</Link>
        </div>
      </div>
    );
  }

  const status = order.status || "created";
  const shiprocket = order.shiprocket || {};
  const waybill = shiprocket.waybill || shiprocket.trackingId || shiprocket.shipmentId || null;
  const trackingUrl = shiprocket.trackingUrl || (waybill ? `https://shiprocket.co/tracking/${waybill}` : null);

  // Only these two statuses actually mean "payment failed / no order".
  // Everything else (paid, shipped, delivered, or any status we don't
  // recognize yet) must NOT be shown as a failure.
  const isFailedStatus = status === "cancelled" || status === "payment_failed";

  // Statuses where payment succeeded — used to gate the order details,
  // items, totals, payment info, and tracking sections below.
  const isPaidOrLater = status === "paid" || status === "shipped" || status === "delivered";

  const statusView = {
    created: { icon: "⏳", title: "Payment processing…", sub: "We're waiting for your payment to be confirmed. This page updates automatically — no need to refresh." },
    reserved: { icon: "⏳", title: "Payment pending", sub: "No payment has been captured yet. If your payment was cancelled or failed, no money was deducted." },
    cancelled: { icon: "⚠️", title: "Payment failed or cancelled", sub: "No money was deducted and no order was confirmed. You can try again from the cart." },
    payment_failed: { icon: "⚠️", title: "Payment failed or cancelled", sub: "No money was deducted and no order was confirmed. You can try again from the cart." },
    paid: { icon: "✅", title: "Payment confirmed!", sub: "Your order is confirmed and is being prepared for shipment." },
    shipped: { icon: "📦", title: "Order shipped!", sub: "Your order is on its way." },
    delivered: { icon: "🎉", title: "Order delivered!", sub: "Your order has been delivered. We hope you love it!" },
    storeCredit: { icon: "💰", title: "Store credit issued", sub: "Your order was taken back and has passed the return/exchange process, you can buy any thing in the store for your order amount within 1 year. To use this credit message us on whatsapp on= +919871335748 with your orderId or phone number || email used while creating the prev order Thankyou." },
  }[status] || {
    // Fallback for any status not explicitly handled above — this used to
    // incorrectly claim "payment failed", even for legitimate statuses
    // like "delivered" that just weren't in the map yet.
    icon: "ℹ️",
    title: "Order status: " + status,
    sub: "We're tracking this order. If anything looks wrong, message us on WhatsApp below.",
  };

  return (
    <div className="page">
      <div className="order-status-wrap">
        <div className="order-status-icon">{statusView.icon}</div>
        <h1 className="order-status-title">{statusView.title}</h1>
        <p className="order-status-sub">{statusView.sub}</p>
        <span className="order-status-id">Order ID: {orderId}</span>

        {isPaidOrLater && (
          <ol className="order-steps" aria-label="Order progress">
            {STEPS.map((step, i) => {
              const reached = i <= STEPS.findIndex((x) => x.key === status);
              return (
                <li key={step.key} className={reached ? "order-step-done" : ""}>
                  <span className="order-step-dot">{reached ? <CheckIcon size={14} /> : i + 1}</span>
                  {step.label}
                </li>
              );
            })}
          </ol>
        )}
        {order.createdAt && (
          <div style={{ color: "var(--slate)", marginTop: 6 }}>Placed: {new Date(order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt).toLocaleString()}</div>
        )}
        {order.contact?.name && (
          <p className="order-status-sub" style={{ marginTop: -8 }}>
            Name: <strong>{order.contact.name}</strong>
          </p>
        )}

        {order.contact?.email && (
          <p className="order-status-sub" style={{ marginTop: -6 }}>
            Email: <strong>{order.contact.email}</strong>
          </p>
        )}

        {order.contact?.phone && (
          <p className="order-status-sub" style={{ marginTop: -6 }}>
            Phone: <strong>{order.contact.phone}</strong>
          </p>
        )}

        {isPaidOrLater ? (
          <p className="order-status-sub" style={{ marginTop: -6 }}>
            {/* Firestore stores order amounts in RUPEES, not paise — no /100 conversion. */}
            Amount: <strong>{formatPrice(order.totalAmount ?? order.amount ?? order.totalAmountPaise)}</strong>
          </p>
        ) : null}

        {/* Items breakdown */}
        {isPaidOrLater &&
          Array.isArray(order.items) &&
          order.items.length > 0 && (
            <div style={{ marginTop: 16, width: "100%" }}>
              <h3 style={{ marginBottom: 8 }}>Items</h3>
              <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                {order.items.map((it, i) => {
                  // Use the item's own price, not order.itemsAmount (which is
                  // the order-level items subtotal, not a per-unit price).
                  const unit = Number(it.price ?? it.unitPrice ?? it.unit_amount ?? it.amount ?? 0);
                  const qty = it.qty || it.quantity || 1;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < order.items.length - 1 ? "1px solid var(--line)" : "none" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{it.name || it.title || it.productName}</div>
                        <div style={{ color: "var(--slate)", fontSize: 13 }}>{it.variant || ""} {it.size ? `· ${it.size}` : ""}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div>{qty} × {formatPrice(unit)}</div>
                        <div style={{ fontWeight: 700 }}>{formatPrice(qty * unit)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* Totals */}
        {isPaidOrLater && (
          <div style={{ marginTop: 14, width: "100%", display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: 320, border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ color: "var(--slate)" }}>Items</div>
                <div>{formatPrice(order.itemsAmount ?? order.amount ?? 0)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <div style={{ color: "var(--slate)" }}>Shipping</div>
                <div>{formatPrice(order.shippingAmount ?? order.shippingPaise ?? 0)}</div>
              </div>
              <hr style={{ margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <div>Total</div>
                <div>{formatPrice(order.totalAmount ?? order.amount ?? order.totalAmountPaise ?? 0)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Payment info */}
        {isPaidOrLater && (
          <div style={{ marginTop: 12, width: "100%" }}>
            <h4 style={{ marginBottom: 8 }}>Payment</h4>
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ color: "var(--slate)" }}>Method</div>
                <div>
                  {String(order.paymentMethod || "").toUpperCase() === "COD"
                    ? "Cash on delivery"
                    : "Paid online (Razorpay)"}
                </div>
              </div>
              {String(order.paymentMethod || "").toUpperCase() === "COD" && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <div style={{ color: "var(--slate)" }}>COD fee paid online</div>
                    <div>{formatPrice(order.codAdvanceAmount ?? order.paymentAmount ?? 0)}</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <div style={{ color: "var(--slate)" }}>Cash due on delivery</div>
                    <div>{formatPrice(order.codAmount ?? 0)}</div>
                  </div>
                </>
              )}
              {order.razorpay?.payment_id || order.paymentId || order.razorpayPaymentId ? (
                <div style={{ marginTop: 8 }}>
                  <div style={{ color: "var(--slate)" }}>Razorpay payment ID </div>
                  <div style={{ fontFamily: "monospace", marginTop: 4 }}>{order.razorpay?.payment_id || order.paymentId || order.razorpayPaymentId}</div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {isPaidOrLater && (
          <div className="order-status-track">
            <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Remember for delivery day:</p>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--slate)", lineHeight: 1.6 }}>
              Record an unedited unboxing video showing the package label. If the item arrives
              damaged or wrong, send the video on WhatsApp within 24 hours for a free replacement.
              Unused items can be returned or exchanged within 2 days of delivery (₹100 fee,
              refunded as store credit). <a href="/returnPolicy">Read the full return policy</a>
            </p>
            {trackingUrl ? (
              <p style={{ marginTop: 10 }}>
                <a href={trackingUrl} target="_blank" rel="noreferrer" style={{ color: "var(--grip)", fontWeight: 600 }}>
                  Track your shipment (AWB {waybill}) →
                </a>
              </p>
            ) : (
              <p style={{ marginTop: 10, fontSize: 13, color: "var(--slate)" }}>
                Tracking details will appear here once your shipment is booked with our shipping partner.
              </p>
            )}
          </div>
        )}

        <p style={{ marginTop: 24 }}>
          <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi, I have a question about order ${orderId}`)}`} target="_blank" rel="noreferrer" style={{ color: "var(--grip)", fontWeight: 600 }}>
            Message us on WhatsApp about this order →
          </a>
        </p>

        {status !== "created" && (
          <div className="btn-row" style={{ justifyContent: "center", marginTop: 20 }}>
            {user && (
              <Link to="/account" className="btn btn-secondary">
                View all my orders
              </Link>
            )}
            <Link to="/" className="btn btn-primary">
              Continue shopping
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}