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
import Footer from "./Footer";

export default function CasesPage() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error | empty
  const [activeModel, setActiveModel] = useState("Filter Models");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("cases"); // "cases" | "jewelry"

  // "cases" (default) -> only isJewellery !== true
  // "jewellery"        -> only isJewellery === true
  // "all"              -> everything
  const [categoryFilter, setCategoryFilter] = useState("cases");

  const showModelFilter = categoryFilter === "cases" || categoryFilter === "all";

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
    return ["Filter Models", ...Array.from(set).sort()];
  }, [products]);

  const visible = useMemo(() => {
    return products.filter((p) => {
      const matchesModel =
        !showModelFilter || activeModel === "Filter Models" || p.model === activeModel;
      const matchesSearch =
        !search.trim() ||
        `${p.name ?? ""} ${p.model ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());

      let matchesCategory = true;
      if (categoryFilter === "cases") {
        matchesCategory = p.isJewellery !== true;
      } else if (categoryFilter === "jewellery") {
        matchesCategory = p.isJewellery === true;
      } // "all" -> no filtering

      return matchesModel && matchesSearch && matchesCategory;
    });
  }, [products, activeModel, search, categoryFilter, showModelFilter]);

  const navigate = useNavigate();
  const { count } = useCart();
  const helpLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi! I have a question about a product or my order.")}`;

  if (view === "jewelry") {
    return <JewelryCollection onBack={() => setView("cases")} />;
  }

  const handleCategoryChange = (next) => {
    setCategoryFilter(next);
    // Reset model filter when it's no longer relevant (e.g. switching to Jewellery)
    if (next === "jewellery") {
      setActiveModel("Filter Models");
    }
  };

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
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Category filter: Cases (default) / Jewellery / All */}
            <div className="model-rail" role="tablist" aria-label="Filter by category">
              <button
                role="tab"
                aria-selected={categoryFilter === "cases"}
                className={"chip" + (categoryFilter === "cases" ? " chip-active" : "")}
                onClick={() => handleCategoryChange("cases")}
              >
                Cases
              </button>
              <button
                role="tab"
                aria-selected={categoryFilter === "jewellery"}
                className={"chip" + (categoryFilter === "jewellery" ? " chip-active" : "")}
                onClick={() => handleCategoryChange("jewellery")}
              >
                Jewellery
              </button>
              <button
                role="tab"
                aria-selected={categoryFilter === "all"}
                className={"chip" + (categoryFilter === "all" ? " chip-active" : "")}
                onClick={() => handleCategoryChange("all")}
              >
                All
              </button>
            </div>

            {/* Model filter as a dropdown — only relevant for Cases / All */}
            {showModelFilter && (
              <select
                className="model-select"
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
                aria-label="Filter by phone model"
              >
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
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
            <Link to="/cart" className="cart-nav-link" aria-label="View cart">
              Cart{count > 0 && <span className="cart-nav-count">{count}</span>}
            </Link>
            <Link to="/orderstatus" className="cart-nav-link" aria-label="Orders">
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

      <Footer />
    </div>
  );
}