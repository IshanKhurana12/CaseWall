import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useSeo from "../hooks/useSeo";
import Footer from "./Footer";
import SignInButton from "./SignInButton";
import { PackageIcon } from "./Icons";
import "../siteChrome.css";

// Orders can't be searched by email/phone from the browser any more (that
// exposed other customers' details). Signed-in customers see every order in
// /account; guests open an order with the ID from their confirmation email.
export default function OrderStatusLookup() {
  useSeo({
    title: "Track Your Order | CASEWALL",
    description: "Track your CASEWALL order with your order ID, or sign in with Google to see all your orders.",
    path: "/orderstatus",
  });
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    const id = orderId.trim().replace(/^#/, "");
    if (!/^[A-Za-z0-9]{15,40}$/.test(id)) {
      setError("That doesn't look like an order ID. Copy it from your confirmation email.");
      return;
    }
    navigate(`/order/${encodeURIComponent(id)}`);
  }

  return (
    <div className="page">
      <div className="track-wrap">
        <h1 className="page-title">Track your order</h1>
        <p className="muted">Check payment, dispatch and delivery status.</p>

        <div className="track-grid">
          <section className="card-panel">
            <h2 className="panel-title">
              <PackageIcon size={20} /> Your orders
            </h2>
            {user ? (
              <>
                <p className="muted">See every order you've placed, with live status and tracking.</p>
                <Link to="/account" className="btn btn-primary">
                  View my orders
                </Link>
              </>
            ) : (
              <>
                <p className="muted">
                  Sign in with the Google account you used at checkout (or the same email) to see all your orders.
                </p>
                {ready && <SignInButton onSignedIn={() => navigate("/account")} />}
              </>
            )}
          </section>

          <section className="card-panel">
            <h2 className="panel-title">Find an order by ID</h2>
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="track-id">Order ID (from your confirmation email)</label>
                <input
                  id="track-id"
                  value={orderId}
                  onChange={(e) => {
                    setOrderId(e.target.value);
                    setError("");
                  }}
                  placeholder="e.g. 7Hk2pQ9xLm3vRt8sYw1A"
                  autoComplete="off"
                />
              </div>
              {error && <p className="form-error">{error}</p>}
              <button className="btn btn-secondary" type="submit">
                Track order
              </button>
            </form>
            <p className="muted track-help">
              Can't find it? Message us on{" "}
              <a href="https://wa.me/919871335748" target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>{" "}
              with your name and phone number.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
