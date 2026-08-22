import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { STORE_NAME } from "../config";
import "../cartCheckout.css";
import { Link } from "react-router-dom";

function SummaryCard({ order, onView }) {
  // Firestore stores order amounts in RUPEES (not paise), so this is
  // displayed as-is with no /100 conversion.
  const amount = order.totalAmount ?? order.amount ?? order.totalAmountPaise;
  const created = order.createdAt ? new Date(order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt).toLocaleString() : null;
  return (
    <div className="order-card" style={{ border: "1px solid var(--line)", padding: 12, borderRadius: 8, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700 }}>Order ID: {order.id || order.orderId || "-"}</div>
          {created && <div style={{ color: "var(--slate)", fontSize: 13 }}>{created}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700 }}>{amount ? `₹${Math.round(amount || 0)}` : "—"}</div>
          <div style={{ color: "var(--slate)", fontSize: 13 }}>{order.status || "—"}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button className="pp-btn pp-btn-primary" onClick={() => onView(order.id || order.orderId)}>View</button>
        <a className="pp-btn pp-btn-secondary" href={`https://wa.me/${order.contact?.phone || ""}`} target="_blank" rel="noreferrer">Contact</a>
      </div>
    </div>
  );
}

export default function OrderStatusLookup() {
  const [term, setTerm] = useState("");
  const [type, setType] = useState("orderId");
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setResults(null);
    const value = String(term || "").trim();
    if (!value) return setError("Please enter a search value.");

    if (type === "orderId") {
      if (value.length < 6) return setError("Please enter a valid Order ID.");
      navigate(`/order/${encodeURIComponent(value)}`);
      return;
    }

    setLoading(true);
    try {
      const col = collection(db, "orders");
      let q;
      if (type === "email") q = query(col, where("contact.email", "==", value), orderBy("createdAt", "desc"));
      else q = query(col, where("contact.phone", "==", value), orderBy("createdAt", "desc"));

      const snap = await getDocs(q);
      if (snap.empty) {
        setResults([]);
        setError("No orders found for that value.");
        return;
      }
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (items.length === 1) {
        navigate(`/order/${encodeURIComponent(items[0].id)}`);
        return;
      }
      setResults(items);
    } catch (err) {
      console.error(err);
      setError("Failed to search orders. Try again later.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
       <Link to="/" className="back-link">← Back to {STORE_NAME}</Link>
      <div className="order-status-wrap">
        <h1 className="order-status-title">Find your orders</h1>
        <p className="order-status-sub">Search by Order ID, email, or phone number used for the order.</p>

        <form onSubmit={submit} style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select value={type} onChange={(e) => setType(e.target.value)} style={{ padding: 10 }}>
              <option value="orderId">Order ID</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </select>
            <input
              type="text"
              placeholder={type === "orderId" ? "Order ID" : type === "email" ? "Email used for order" : "Phone number"}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              style={{ flex: 1, padding: 10 }}
            />
            <button className="pp-btn pp-btn-primary" type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
          </div>
          {error && <p style={{ color: "#b00020" }}>{error}</p>}
        </form>

        {results && (
          <div style={{ marginTop: 18 }}>
            <h3 style={{ marginBottom: 8 }}>Results ({results.length})</h3>
            {results.map((o) => (
              <SummaryCard key={o.id} order={o} onView={(id) => navigate(`/order/${encodeURIComponent(id)}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}