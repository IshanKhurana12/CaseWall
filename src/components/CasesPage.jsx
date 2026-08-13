import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { STORE_NAME, STORE_TAGLINE, WHATSAPP_NUMBER } from "../config";
import ProductGrid from "./ProductGrid";
import "../App.css";
import "../jwelleryStyles.css";
import JewelryCollection from "./JewelryCollection";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
export default function CasesPage() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error | empty
  const [activeModel, setActiveModel] = useState("All");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("cases"); // "cases" | "jewelry"

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, "products"), orderBy("name"));
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(items);
        setStatus(items.length ? "ready" : "empty");
      } catch (err) {
        console.error("Failed to load products:", err);
        setStatus("error");
      }
    }
    load();
  }, []);

  const models = useMemo(() => {
    const set = new Set(products.map((p) => p.model).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const visible = useMemo(() => {
    return products.filter((p) => {
      const matchesModel = activeModel === "All" || p.model === activeModel;
      const matchesSearch =
        !search.trim() ||
        `${p.name ?? ""} ${p.model ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());
      return matchesModel && matchesSearch;
    });
  }, [products, activeModel, search]);

  const navigate = useNavigate();
  const { count } = useCart();
  const helpLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi! I have a question about a product or my order.")}`;

  if (view === "jewelry") {
    return <JewelryCollection onBack={() => setView("cases")} />;
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-inner">
          <p className="eyebrow">Case wall — new drops weekly</p>
          <h1 className="wordmark">{STORE_NAME}</h1>
          <p className="tagline">{STORE_TAGLINE}</p>
        </div>
      </header>

      <main className="content">
        <div className="toolbar">
          <div className="model-rail" role="tablist" aria-label="Filter by phone model">
            {models.map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={activeModel === m}
                className={"chip" + (activeModel === m ? " chip-active" : "")}
                onClick={() => setActiveModel(m)}
              >
                {m}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <input
              className="search"
              type="search"
              placeholder="Search covers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
         <button
  className="jw-nav-link"
  onClick={() => navigate("/devir")}
>
  DeViR Jewellery →
</button>
  <Link to="/cart" className="cart-nav-link" aria-label="View cart">
    Cart{count > 0 && <span className="cart-nav-count">{count}</span>}
  </Link>
  <Link to="/orderstatus" className="cart-nav-link" aria-label="Orders" style={{ marginLeft: 8 }}>
    Orders
  </Link>
          </div>
        </div>

        {status === "loading" && (
          <div className="state-block">
            <p>Loading the wall…</p>
          </div>
        )}

        {status === "error" && (
          <div className="state-block">
            <p className="state-title">Couldn't load products.</p>
            <p className="state-sub">
              Check that your Firebase config in <code>src/firebase.js</code> is filled in and
              that a <code>products</code> collection exists in Firestore.
            </p>
          </div>
        )}

        {status === "empty" && (
          <div className="state-block">
            <p className="state-title">No covers on the wall yet.</p>
            <p className="state-sub">
              Add documents to the <code>products</code> collection in the Firebase console —
              see README.md for the exact fields.
            </p>
          </div>
        )}

        {status === "ready" && visible.length === 0 && (
          <div className="state-block">
            <p className="state-title">Nothing matches that filter.</p>
            <p className="state-sub">Try a different model or clear the search.</p>
          </div>
        )}

        {status === "ready" && visible.length > 0 && <ProductGrid products={visible} />}
      </main>
      <footer className="site-footer">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <p>Questions about a cover? Tap "Ask on WhatsApp" on any product.</p>
          <a
            className="wa-button wa-button-secondary"
            href={helpLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ask a question on WhatsApp"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12.004 2c-5.514 0-9.997 4.478-9.997 9.997 0 1.762.464 3.484 1.345 4.997L2 22l5.144-1.342a9.96 9.96 0 004.86 1.238h.004c5.514 0 9.997-4.478 9.997-9.997 0-2.671-1.04-5.182-2.927-7.07A9.935 9.935 0 0012.004 2zm0 18.153a8.13 8.13 0 01-4.144-1.134l-.297-.176-3.054.797.815-2.978-.193-.306a8.14 8.14 0 01-1.256-4.36c0-4.501 3.66-8.161 8.162-8.161 2.18 0 4.229.85 5.77 2.393a8.106 8.106 0 012.39 5.775c-.003 4.502-3.663 8.15-8.193 8.15z" />
            </svg>
            Need help? Ask on WhatsApp
          </a>
        </div>
      </footer>
    </div>
  );
}