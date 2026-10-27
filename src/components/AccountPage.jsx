import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import useSeo from "../hooks/useSeo";
import Footer from "./Footer";
import SignInButton from "./SignInButton";
import AddressForm, { AddressSummary, EMPTY_ADDRESS, validateAddress } from "./AddressForm";
import { ChevronRightIcon, LogOutIcon, PackageIcon, PinIcon, PlusIcon } from "./Icons";
import { responsiveImg } from "../lib/images";
import "../siteChrome.css";

const STATUS = {
  paid: { label: "Confirmed", tone: "info" },
  shipped: { label: "Shipped", tone: "info" },
  delivered: { label: "Delivered", tone: "good" },
  storeCredit: { label: "Store credit issued", tone: "muted" },
};

function formatINR(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    Number(value) || 0
  );
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function AccountPage() {
  useSeo({ title: "My Account | CASEWALL", path: "/account", noindex: true });
  const { user, ready, signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "addresses" ? "addresses" : "orders";

  if (!ready) {
    return (
      <div className="page acct-page">
        <div className="acct-wrap">
          <p className="muted">Loading your account…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page acct-page">
        <div className="acct-wrap">
          <div className="acct-signin card-panel">
            <h1>Sign in to your account</h1>
            <p className="muted">
              See all your orders in one place, track deliveries and save addresses for one-tap checkout.
            </p>
            <SignInButton />
            <p className="acct-signin-note">
              Ordered without signing in? Use the link in your confirmation email, or{" "}
              <Link to="/orderstatus">find an order by its ID</Link>. Sign in with the same email and your
              past orders appear here automatically.
            </p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="page acct-page">
      <div className="acct-wrap">
        <div className="acct-head">
          <div className="acct-id">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="acct-avatar" referrerPolicy="no-referrer" />
            ) : (
              <span className="acct-avatar acct-avatar-letter">{(user.displayName || user.email || "?")[0]}</span>
            )}
            <div>
              <h1>{user.displayName ? `Hi, ${user.displayName.split(" ")[0]}` : "My account"}</h1>
              <p className="muted">{user.email}</p>
            </div>
          </div>
          <button type="button" className="btn btn-ghost" onClick={signOut}>
            <LogOutIcon size={18} /> Sign out
          </button>
        </div>

        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "orders"}
            className={"tab" + (tab === "orders" ? " tab-active" : "")}
            onClick={() => setParams({}, { replace: true })}
          >
            <PackageIcon size={18} /> My orders
          </button>
          <button
            role="tab"
            aria-selected={tab === "addresses"}
            className={"tab" + (tab === "addresses" ? " tab-active" : "")}
            onClick={() => setParams({ tab: "addresses" }, { replace: true })}
          >
            <PinIcon size={18} /> Saved addresses
          </button>
        </div>

        {tab === "orders" ? <OrdersTab /> : <AddressesTab />}
      </div>
      <Footer />
    </div>
  );
}

function OrdersTab() {
  const { authFetch } = useAuth();
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    authFetch("/api/account?view=orders")
      .then((d) => !cancelled && setOrders(d.orders))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  if (error) return <p className="form-error">{error}</p>;
  if (!orders) return <p className="muted">Loading your orders…</p>;
  if (orders.length === 0) {
    return (
      <div className="empty-panel card-panel">
        <PackageIcon size={32} />
        <p className="empty-title">No orders yet</p>
        <p className="muted">When you place an order it will show up here.</p>
        <Link to="/" className="btn btn-primary">
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <ul className="order-list">
      {orders.map((o) => {
        const s = STATUS[o.status] || { label: o.status, tone: "muted" };
        const itemCount = o.items.reduce((n, it) => n + (it.qty || 1), 0);
        return (
          <li key={o.id}>
            <Link to={`/order/${o.id}`} className="order-row card-panel">
              <div className="order-row-thumbs" aria-hidden="true">
                {o.items.slice(0, 3).map((it, i) =>
                  it.image ? (
                    <img key={i} {...responsiveImg(it.image, "56px", 320)} alt="" loading="lazy" />
                  ) : (
                    <span key={i} className="order-row-thumb-empty" />
                  )
                )}
              </div>
              <div className="order-row-main">
                <p className="order-row-title">
                  {o.items[0]?.name}
                  {o.items.length > 1 ? ` + ${o.items.length - 1} more` : ""}
                </p>
                <p className="muted">
                  {formatDate(o.createdAt)} · {itemCount} item{itemCount === 1 ? "" : "s"} · Order #{o.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <div className="order-row-side">
                <span className={`pill pill-${s.tone}`}>{s.label}</span>
                <strong>{formatINR(o.amount)}</strong>
              </div>
              <ChevronRightIcon size={18} className="order-row-chevron" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AddressesTab() {
  const { authFetch } = useAuth();
  const [addresses, setAddresses] = useState(null);
  const [editing, setEditing] = useState(null); // null | "new" | address id
  const [draft, setDraft] = useState(EMPTY_ADDRESS);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    authFetch("/api/account?view=addresses")
      .then((d) => setAddresses(d.addresses))
      .catch((e) => setError(e.message));
  }, [authFetch]);
  useEffect(load, [load]);

  async function run(body) {
    setBusy(true);
    setError("");
    try {
      const d = await authFetch("/api/account", { method: "POST", body });
      setAddresses(d.addresses);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    const problem = validateAddress(draft);
    if (problem) return setError(problem);
    const ok = await run({ action: "saveAddress", id: editing === "new" ? undefined : editing, address: draft });
    if (ok) setEditing(null);
  }

  if (!addresses) return error ? <p className="form-error">{error}</p> : <p className="muted">Loading addresses…</p>;

  return (
    <div className="addr-grid">
      {addresses.map((a) =>
        editing === a.id ? (
          <form key={a.id} className="card-panel addr-edit" onSubmit={save}>
            <AddressForm value={draft} onChange={setDraft} idPrefix={`edit-${a.id}`} />
            {error && <p className="form-error">{error}</p>}
            <div className="btn-row">
              <button className="btn btn-primary" disabled={busy}>
                Save address
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div key={a.id} className="card-panel addr-card">
            <AddressSummary address={a} />
            <div className="addr-card-actions">
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setDraft({ ...EMPTY_ADDRESS, ...a });
                  setEditing(a.id);
                  setError("");
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="link-btn"
                disabled={busy}
                onClick={() => window.confirm("Delete this address?") && run({ action: "deleteAddress", id: a.id })}
              >
                Delete
              </button>
              {!a.isDefault && (
                <button type="button" className="link-btn" disabled={busy} onClick={() => run({ action: "setDefault", id: a.id })}>
                  Set as default
                </button>
              )}
            </div>
          </div>
        )
      )}

      {editing === "new" ? (
        <form className="card-panel addr-edit" onSubmit={save}>
          <p className="panel-title">New address</p>
          <AddressForm value={draft} onChange={setDraft} idPrefix="new" />
          {error && <p className="form-error">{error}</p>}
          <div className="btn-row">
            <button className="btn btn-primary" disabled={busy}>
              Save address
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="addr-add card-panel"
          onClick={() => {
            setDraft(EMPTY_ADDRESS);
            setEditing("new");
            setError("");
          }}
        >
          <PlusIcon size={22} />
          Add a new address
        </button>
      )}
      {error && !editing && <p className="form-error">{error}</p>}
    </div>
  );
}
