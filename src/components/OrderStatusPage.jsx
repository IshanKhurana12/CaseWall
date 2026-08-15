import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { STORE_NAME, WHATSAPP_NUMBER } from "../config";
import "../cartCheckout.css";

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
  const { orderId } = useParams();
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
            Amount: <strong>{formatPrice((order.totalAmountPaise ?? order.amount ?? order.totalAmount) / 100)}</strong>
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
                  const unit = order.itemsAmount;
                  const qty = it.qty || 1;
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < order.items.length - 1 ? "1px solid var(--line)" : "none" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{it.name || it.title || it.productName}</div>
                        <div style={{ color: "var(--slate)", fontSize: 13 }}>{it.variant || ""} {it.size ? `· ${it.size}` : ""}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div>{qty} × {formatPrice(unit / 100)}</div>
                        <div style={{ fontWeight: 700 }}>{formatPrice((qty * unit) / 100)}</div>
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
                <div>{formatPrice((order.itemsAmountPaise ?? order.amount ?? 0) / 100)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <div style={{ color: "var(--slate)" }}>Shipping</div>
                <div>{formatPrice((order.shippingPaise ?? order.shippingAmount ?? 0) / 100)}</div>
              </div>
              <hr style={{ margin: "10px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <div>Total</div>
                <div>{formatPrice((order.totalAmountPaise ?? order.amount ?? order.totalAmount ?? 0) / 100)}</div>
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
                <div>{order.paymentMethod || order.method || "Razorpay"}</div>
              </div>
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
              This order is non-refundable — only damaged items are eligible for a free
              replacement, and only if you record an unedited unboxing video showing the
              package label and the damage. See the FAQ for the full policy.
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
          <p style={{ marginTop: 20 }}>
            <a href="/" className="pp-btn" style={{ textDecoration: "none" }}>Back to Home</a>
          </p>
        )}
      </div>
    </div>
  );
}