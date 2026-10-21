import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore/lite";
import { db } from "../firebase";
import { STORE_NAME, STORE_TAGLINE } from "../config";
import ProductGrid from "./ProductGrid";
import "../App.css";
import "../jwelleryStyles.css";
import JewelryCollection from "./JewelryCollection";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import Footer from "./Footer";
import { getCategoryLabel, getProductCategoryValues } from "../lib/discounts";
import OfferCarousel from "./OfferCarousel";
import useSeo from "../hooks/useSeo";
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  breadcrumbJsonLd,
  canonicalModelName,
  modelDescription,
  modelPath,
  modelSlug,
  modelTitle,
  modelsForProduct,
} from "../lib/seo";

const PAGE_SIZE = 20;

export default function CasesPage() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error | empty
  // The model filter lives in the URL (/cases/iphone-15-pro) so every phone
  // model gets its own indexable landing page.
  const { modelSlug: routeModelSlug } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [view, setView] = useState("cases"); // "cases" | "jewelry"
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("featured");

  // Page number lives in the URL (?page=3) instead of local state, so it
  // survives navigating to a product page and back (no remount reset).
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;

  const setPage = (updater) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const current = Number(prev.get("page")) || 1;
        const newPage = typeof updater === "function" ? updater(current) : updater;
        next.set("page", String(newPage));
        return next;
      },
      { replace: true } // don't spam browser history on every page click
    );
  };

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
    return ["Filter Models", ...Array.from(set).sort((a, b) => a.localeCompare(b, "en", { numeric: true }))];
  }, [products]);

  const activeModel = useMemo(() => {
    if (!routeModelSlug) return "Filter Models";
    const match = models.find((m) => modelSlug(m) === routeModelSlug);
    if (match) return match;
    // Until products arrive, show a name rebuilt from the URL so the heading
    // doesn't jump (layout shift) when the real list loads.
    if (status === "loading") return canonicalModelName(routeModelSlug.replace(/-/g, " "));
    return "Filter Models";
  }, [models, routeModelSlug, status]);
  const isModelPage = activeModel !== "Filter Models";

  function selectModel(m) {
    navigate(m === "Filter Models" ? "/" : modelPath(m));
  }

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

  // NOTE: page resets to 1 are triggered inline, right where each filter is
  // changed (see handleCategoryChange and the input/select onChange props
  // below) — NOT via a useEffect watching these values. A mount-reacting
  // effect can't reliably tell "the page just mounted with ?page=3 in the
  // URL" apart from "a filter actually changed", especially under
  // React.StrictMode's double-invoke in dev, which would silently reset
  // the restored page back to 1 every time.

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

  // Clamp page if it's now out of range (e.g. products array shrank).
  // Gated on status === "ready" so this doesn't fire while products are
  // still loading (visible.length is 0 -> totalPages is 1 -> would wrongly
  // clamp a page restored from the URL back down to 1 before data arrives).
  useEffect(() => {
    if (status !== "ready") return;
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, status]);

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

  const modelProductCount = isModelPage ? visible.length : 0;
  const modelMinPrice = useMemo(() => {
    if (!isModelPage) return null;
    const prices = visible.map((p) => Number(p.priceFrom ?? p.price)).filter((n) => n > 0);
    return prices.length ? Math.min(...prices) : null;
  }, [isModelPage, visible]);

  useSeo(
    isModelPage
      ? {
          title: modelTitle(activeModel),
          description: modelDescription(activeModel, modelProductCount, modelMinPrice),
          path: modelPath(activeModel),
          jsonLd: breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: `${activeModel} Cases`, path: modelPath(activeModel) },
          ]),
        }
      : {
          title: DEFAULT_TITLE,
          description: DEFAULT_DESCRIPTION,
          path: routeModelSlug ? `/cases/${routeModelSlug}` : "/",
          noindex: Boolean(routeModelSlug) && status === "ready",
        }
  );

  if (view === "jewelry") {
    return <JewelryCollection onBack={() => setView("cases")} />;
  }

  const handleCategoryChange = (next) => {
    setCategoryFilter(next);
    setSelectedCategory("all");
    setPage(1);
    // Reset model filter when it's no longer relevant (e.g. switching to Jewellery)
    if (next === "jewellery" && routeModelSlug) {
      navigate("/");
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
          <Link to="/" className="store-brand">
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
            <Link to="/cart" className="store-cart-link" aria-label={`Cart${count > 0 ? ` ${count} items` : ""}`}>
              Cart {count > 0 && <span>{count}</span>}
            </Link>
          </nav>
        </div>
      </header>

      <main className="content">
        {/* Shown while loading too, so it doesn't push the page down when products arrive */}
        {(hasAntiYellowProducts || status === "loading") && (
          <section className="top-offer-section" aria-label="Current offers">
            <OfferCarousel />
          </section>
        )}

        <section className="catalog-intro">
          <div>
            {isModelPage ? (
              <nav className="catalog-kicker" aria-label="Breadcrumb">
                <Link to="/">Home</Link> / {activeModel} cases
              </nav>
            ) : (
              <p className="catalog-kicker">Casewall collection</p>
            )}
            <h1>{isModelPage ? `${activeModel} Cases & Covers` : "Phone Cases & Covers"}</h1>
            <p>
              {isModelPage
                ? `Back covers cut for the ${activeModel}'s camera and buttons. Cash on delivery, dispatched in 24–48 hrs.`
                : "Stylish back covers for iPhone and Samsung Galaxy. Cash on delivery, dispatched in 24–48 hrs across India."}
            </p>
          </div>
          <div className="catalog-meta">
            <span>Free shipping over ₹500</span>
            <span>Secure checkout by Razorpay</span>
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
                onChange={(e) => selectModel(e.target.value)}
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
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search products"
            />
            <select
              className="model-select sort-select"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
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
              onClick={() => {
                setSelectedCategory("all");
                setPage(1);
              }}
            >
              All styles
            </button>
            {categoryOptions.slice(0, 4).map((option) => (
              <button
                key={option.value}
                type="button"
                className={"catalog-filter-button" + (selectedCategory === option.value ? " catalog-filter-button-active" : "")}
                onClick={() => {
                  setSelectedCategory(option.value);
                  setPage(1);
                }}
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
            <h2 className="sr-only">Products</h2>
            <ProductGrid products={paginated} />

            {totalPages > 1 && (
              <nav className="pagination" aria-label="Pagination">
                <button
                  className="page-btn page-btn-nav"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
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
                >
                  Next ›
                </button>
              </nav>
            )}
          </>
        )}
        {models.length > 1 && (
          <section className="model-links" aria-labelledby="model-links-heading">
            <h2 id="model-links-heading">Shop cases by phone model</h2>
            <ul>
              {models.slice(1).map((m) => (
                <li key={m}>
                  <Link to={modelPath(m)} aria-current={m === activeModel ? "page" : undefined}>
                    {m} cases
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}