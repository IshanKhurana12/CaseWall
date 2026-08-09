import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import { STORE_NAME, STORE_TAGLINE } from "./config";
import ProductGrid from "./components/ProductGrid";
import "./App.css";
import FAQSection from "./FAQSection";

export default function App() {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error | empty
  const [activeModel, setActiveModel] = useState("All");
  const [search, setSearch] = useState("");

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
          <input
            className="search"
            type="search"
            placeholder="Search covers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search products"
          />
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

        <div style={{marginBottom:"150px"}}>

        
      <FAQSection />
      </div>
      <footer className="site-footer">
        <p>Questions about a cover? Tap "Ask on WhatsApp" on any product.</p>
      </footer>
    </div>
  );
}
