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

const PAGE_SIZE = 8;

// Normalizes casing/whitespace so "Iphone 15 Pro" and "iPhone 15 Pro"
// are treated as the same model everywhere (dropdown + filtering).
// If your DB has other inconsistent naming (extra spaces, "Iphone" vs
// "iPhone" vs "IPHONE"), this is the single place to patch it.
function canonicalModelName(raw) {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  // Force a consistent "iPhone" casing regardless of how it was typed/saved
  return trimmed.replace(/^iphone/i, "iPhone");
}

// A product's list of filterable models: the denormalized `models` array
// for variant products, or a single-item list from the legacy `model`
// field for old flat products. Keeps CasesPage's filter working for both.
// Every model name is run through canonicalModelName so inconsistent
// casing in Firestore (e.g. "Iphone 15" vs "iPhone 15") doesn't create
// duplicate dropdown entries or cause products to be filtered out.
function modelsForProduct(p) {
  const raw =
    Array.isArray(p.models) && p.models.length > 0
      ? p.models
      : p.model
      ? [p.model]
      : [];
  return raw.map(canonicalModelName).filter(Boolean);
}

export default function CasesPage() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error | empty
  const [activeModel, setActiveModel] = useState("Filter Models");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("cases"); // "cases" | "jewelry"
  const [page, setPage] = useState(1);

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
    const set = new Set();
    for (const p of products) {
      for (const m of modelsForProduct(p)) set.add(m);
    }
    return ["Filter Models", ...Array.from(set).sort()];
  }, [products]);

  const visible = useMemo(() => {
    return products.filter((p) => {
      const matchesModel =
        !showModelFilter || activeModel === "Filter Models" || modelsForProduct(p).includes(activeModel);
      const searchableModels = modelsForProduct(p).join(" ");
      const matchesSearch =
        !search.trim() ||
        `${p.name ?? ""} ${searchableModels}`.toLowerCase().includes(search.trim().toLowerCase());

      let matchesCategory = true;
      if (categoryFilter === "cases") {
        matchesCategory = p.isJewellery !== true;
      } else if (categoryFilter === "jewellery") {
        matchesCategory = p.isJewellery === true;
      } // "all" -> no filtering

      return matchesModel && matchesSearch && matchesCategory;
    });
  }, [products, activeModel, search, categoryFilter, showModelFilter]);

  // Reset to page 1 whenever the active filters/search change the result set
  useEffect(() => {
    setPage(1);
  }, [activeModel, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

  // Clamp page if it's now out of range (e.g. products array shrank)
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visible.slice(start, start + PAGE_SIZE);
  }, [visible, page]);

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

  // Builds a compact page list like [1, 2, 3, '…', 9, 10] instead of
  // rendering every page number when there are many pages.
  function getPageNumbers(current, total) {
    const delta = 1;
    const range = [];
    const rangeWithDots = [];
    let last;

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    for (const i of range) {
      if (last) {
        if (i - last === 2) {
          rangeWithDots.push(last + 1);
        } else if (i - last > 2) {
          rangeWithDots.push("…");
        }
      }
      rangeWithDots.push(i);
      last = i;
    }

    return rangeWithDots;
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

        {status === "ready" && visible.length > 0 && (
          <>
            <ProductGrid products={paginated} />

            {totalPages > 1 && (
              <nav className="pagination" aria-label="Pagination">
           <button
  className="page-btn page-btn-nav"
  onClick={() => setPage((p) => Math.max(1, p - 1))}
  disabled={page === 1}
  aria-label="Previous page"
>
  ‹ Prev
</button>

                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === "…" ? (
                    <span key={`dots-${i}`} className="page-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      className={"page-btn" + (p === page ? " page-btn-active" : "")}
                      onClick={() => setPage(p)}
                      aria-current={p === page ? "page" : undefined}
                    >
                      {p}
                    </button>
                  )
                )}
<button
  className="page-btn page-btn-nav"
  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
  disabled={page === totalPages}
  aria-label="Next page"
>
  Next ›
</button>
              </nav>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}