import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { STORE_NAME, STORE_TAGLINE } from "../config";
import ProductGrid from "./ProductGrid";
import "../App.css";
import "../jwelleryStyles.css";
import JewelryCollection from "./JewelryCollection";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import Footer from "./Footer";
import { getCategoryLabel, getProductCategoryValues } from "../lib/discounts";
import OfferCarousel from "./OfferCarousel";

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
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("featured");

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

  const categoryOptions = useMemo(() => {
    const pool = products.filter((p) => {
      if (categoryFilter === "cases") return p.isJewellery !== true;
      if (categoryFilter === "jewellery") return p.isJewellery === true;
      return true;
    });

    const raw = new Set();
    for (const product of pool) {
      for (const value of getProductCategoryValues(product)) {
        raw.add(value);
      }
    }

    const preferredOrder = ["under120", "featured", "trending", "premium"];
    const availableCategories = new Set(Array.from(raw).filter(Boolean));

    return preferredOrder
      .filter((value) => availableCategories.has(value))
      .map((value) => ({ value, label: getCategoryLabel(value) }));
  }, [products, categoryFilter]);

  const hasAntiYellowProducts = useMemo(
    () => products.some((product) => getProductCategoryValues(product).includes("anti yellow")),
    [products]
  );

  const visible = useMemo(() => {
    const filtered = products.filter((p) => {
      const matchesModel =
        !showModelFilter || activeModel === "Filter Models" || modelsForProduct(p).includes(activeModel);
      const searchableModels = modelsForProduct(p).join(" ");
      const matchesSearch =
        !search.trim() ||
        `${p.name ?? ""} ${searchableModels} ${getProductCategoryValues(p).join(" ")}`
          .toLowerCase()
          .includes(search.trim().toLowerCase());

      let matchesCategory = true;
      if (categoryFilter === "cases") {
        matchesCategory = p.isJewellery !== true;
      } else if (categoryFilter === "jewellery") {
        matchesCategory = p.isJewellery === true;
      } // "all" -> no filtering

      const matchesProductCategory =
        selectedCategory === "all" || !selectedCategory || getProductCategoryValues(p).includes(selectedCategory);

      return matchesModel && matchesSearch && matchesCategory && matchesProductCategory;
    });

    const sorted = [...filtered];
    if (sortBy === "price-low-high") {
      sorted.sort((a, b) => {
        const av = Number(a.priceFrom ?? a.price ?? 0) || 0;
        const bv = Number(b.priceFrom ?? b.price ?? 0) || 0;
        return av - bv;
      });
    } else if (sortBy === "price-high-low") {
      sorted.sort((a, b) => {
        const av = Number(a.priceFrom ?? a.price ?? 0) || 0;
        const bv = Number(b.priceFrom ?? b.price ?? 0) || 0;
        return bv - av;
      });
    }

    return sorted;
  }, [products, activeModel, search, categoryFilter, showModelFilter, selectedCategory, sortBy]);

  // Reset to page 1 whenever the active filters/search change the result set
  useEffect(() => {
    setPage(1);
  }, [activeModel, search, categoryFilter, selectedCategory, sortBy]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

  // Clamp page if it's now out of range (e.g. products array shrank)
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: isMobile ? "auto" : "smooth",
    });
  }, [page, activeModel, search, categoryFilter, selectedCategory, sortBy]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visible.slice(start, start + PAGE_SIZE);
  }, [visible, page]);

  const { count } = useCart();

  if (view === "jewelry") {
    return <JewelryCollection onBack={() => setView("cases")} />;
  }

  const handleCategoryChange = (next) => {
    setCategoryFilter(next);
    setSelectedCategory("all");
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
      <div className="store-announcement" role="status">
        <span>Free shipping on eligible orders</span>
        <span>Cash on delivery available</span>
        <span>New designs added weekly</span>
      </div>
      <header className="store-header">
        <div className="store-header-inner">
          <Link to="/" className="store-brand" aria-label={`${STORE_NAME} home`}>
            <span className="store-brand-mark">CW</span>
            <span>
              <strong>{STORE_NAME}</strong>
              <small>{STORE_TAGLINE}</small>
            </span>
          </Link>
          <nav className="store-nav" aria-label="Store navigation">
            <button type="button" className={view === "cases" ? "store-nav-active" : ""} onClick={() => setView("cases")}>Cases</button>
            {/* <button type="button" onClick={() => setView("jewelry")}>Jewellery</button> */}
            <Link to="/orderstatus">Track order</Link>
            <Link to="/cart" className="store-cart-link" aria-label={`View cart${count > 0 ? `, ${count} items` : ""}`}>
              Cart {count > 0 && <span>{count}</span>}
            </Link>
          </nav>
        </div>
      </header>

      <main className="content">
        {hasAntiYellowProducts && (
          <section className="top-offer-section" aria-label="Current offers">
            <OfferCarousel />
          </section>
        )}

        <section className="catalog-intro">
          <div>
            <p className="catalog-kicker">Casewall collection</p>
            <h1>Latest drops</h1>
            <p>Discover new phone cases designed for your everyday carry.</p>
          </div>
          <div className="catalog-meta">
            <span>Free shipping on eligible orders</span>
            <span>Secure checkout</span>
          </div>
        </section>

        <div className="toolbar catalog-toolbar">
          <div className="toolbar-left">
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

          <div className="toolbar-right">
            <input
              className="search"
              type="search"
              placeholder="Search covers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
            <select
              className="model-select sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort products"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price-low-high">Price: Low to High</option>
              <option value="price-high-low">Price: High to Low</option>
            </select>
          </div>
        </div>

        {categoryOptions.length > 0 && (
          <div className="catalog-filter-bar" aria-label="Shop collections">
            <span className="catalog-filter-label">Shop by:</span>
            <button
              type="button"
              className={"catalog-filter-button" + (selectedCategory === "all" ? " catalog-filter-button-active" : "")}
              onClick={() => setSelectedCategory("all")}
            >
              All styles
            </button>
            {categoryOptions.slice(0, 4).map((option) => (
              <button
                key={option.value}
                type="button"
                className={"catalog-filter-button" + (selectedCategory === option.value ? " catalog-filter-button-active" : "")}
                onClick={() => setSelectedCategory(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

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
            <div className="catalog-results-head">
              <p><strong>{visible.length}</strong> products</p>
              {search.trim() && <p>Showing results for “{search.trim()}”</p>}
            </div>
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