import { use, useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import "../App.css";

import "../jwelleryStyles.css";
import { useNavigate } from "react-router-dom";
// ---- Config -----------------------------------------------------------
const WHATSAPP_NUMBER = "919871335748"; // replace with the real number

// Firestore collection this view reads from. Kept separate from "products"
// (the phone case collection) so the two catalogs never mix.
const COLLECTION_NAME = "jewelry";

const FAQS = [
  { q: "How do I pay for my order?", a: "Payment is made through UPI. Once you confirm your order on WhatsApp, I'll send you a QR code — scan it to complete the payment." },
  { q: "What happens after I pay?", a: "As soon as the payment is confirmed, I set up delivery within 24 hours." },
  { q: "Is delivery free?", a: "Delivery is free for Delhi addresses. For other locations, delivery is chargeable — I'll tell you the exact cost on WhatsApp before you pay, and it'll be added to your total." },
];

const ICONS = {
  ring: <svg viewBox="0 0 100 100" fill="none" stroke="var(--jw-gold)" strokeWidth="2.2"><circle cx="50" cy="62" r="24" /><path d="M50 38 L42 22 L50 14 L58 22 Z" strokeLinejoin="round" /><path d="M42 22 L58 22" /></svg>,
  "earring-drop": <svg viewBox="0 0 100 100" fill="none" stroke="var(--jw-gold)" strokeWidth="2.2"><circle cx="50" cy="26" r="8" /><path d="M50 34 L50 52" /><path d="M50 52 C38 58 38 76 50 84 C62 76 62 58 50 52 Z" strokeLinejoin="round" /></svg>,
  "earring-stud": <svg viewBox="0 0 100 100" fill="none" stroke="var(--jw-gold)" strokeWidth="2.2"><circle cx="50" cy="50" r="20" /><path d="M50 30 L50 70 M30 50 L70 50 M36 36 L64 64 M64 36 L36 64" /></svg>,
  necklace: <svg viewBox="0 0 100 100" fill="none" stroke="var(--jw-gold)" strokeWidth="2.2"><path d="M20 24 C20 60 80 60 80 24" strokeLinecap="round" /><path d="M50 60 L50 68" /><path d="M42 68 L58 68 L50 84 Z" strokeLinejoin="round" /></svg>,
  bracelet: <svg viewBox="0 0 100 100" fill="none" stroke="var(--jw-gold)" strokeWidth="2.2"><ellipse cx="50" cy="50" rx="34" ry="20" /><path d="M20 44 Q50 34 80 44 M18 56 Q50 66 82 56" strokeDasharray="2 5" /></svg>,
  pendant: <svg viewBox="0 0 100 100" fill="none" stroke="var(--jw-gold)" strokeWidth="2.2"><path d="M26 22 C26 44 74 44 74 22" strokeLinecap="round" /><path d="M50 44 L50 54" /><path d="M50 54 C36 62 36 82 50 88 C64 82 64 62 50 54 Z" strokeLinejoin="round" /></svg>,
};

// ---- Helpers --------------------------------------------------------------
function formatPrice(v) {
  if (v === null || v === undefined || v === "") return null;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v));
}
function formatReviewCount(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `${n}`;
}
function buildWhatsAppLink(p) {
  const price = formatPrice(p.price);
  const mrp = formatPrice(p.mrp);
  const lines = [
    `Hi! I'm interested in "${p.name ?? "this piece"}"`,
    price ? `(${price}${mrp ? `, MRP ${mrp}` : ""})` : null,
    "— is it available?",
  ].filter(Boolean);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join(" "))}`;
}

// Deterministic pseudo-random generator, seeded by a string (the product id
// or name). Same seed always produces the same numbers, so a document
// without a rating field gets a stable "random" rating instead of one that
// changes on every render.
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) { h = (h << 5) - h + seed.charCodeAt(i); h |= 0; }
  return function next() { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
}

// Firestore documents may or may not include rating/reviewCount. When
// they're missing, generate a plausible, stable rating (4.50–5.00, so it
// always shows more than 4 full stars) and review count (12–980).
function getDisplayRating(p) {
  const hasRating = p.rating !== undefined && p.rating !== null && p.rating !== "";
  const hasCount = p.reviewCount !== undefined && p.reviewCount !== null;
  if (hasRating && hasCount) return { rating: Number(p.rating), reviewCount: Number(p.reviewCount) };

  const rand = seededRandom(String(p.id ?? p.name ?? "piece"));
  const rating = hasRating ? Number(p.rating) : Math.round((4.5 + rand() * 0.5) * 100) / 100;
  const reviewCount = hasCount ? Number(p.reviewCount) : Math.floor(12 + rand() * 968);
  return { rating, reviewCount };
}

function StarRow({ rating }) {
  const clamped = Math.max(0, Math.min(5, rating));
  return (
    <span className="jw-rating-stars">
      {Array.from({ length: 5 }).map((_, i) => {
        const diff = clamped - i;
        const fill = diff >= 1 ? "currentColor" : diff >= 0.5 ? `url(#jw-half-${i})` : "none";
        const opacity = diff >= 0.5 ? 1 : 0.35;
        return (
          <svg key={i} viewBox="0 0 24 24" width="13" height="13" style={{ opacity }}>
            <defs>
              <linearGradient id={`jw-half-${i}`}>
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="50%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <path d="M12 2.5l2.94 6.02 6.56.96-4.75 4.7 1.12 6.6L12 17.77l-5.87 3.01 1.12-6.6-4.75-4.7 6.56-.96L12 2.5z" fill={fill} stroke="currentColor" strokeWidth="1.2" />
          </svg>
        );
      })}
    </span>
  );
}

function JewelryCard({ p }) {
  const price = formatPrice(p.price);
  const mrp = formatPrice(p.mrp);
  const discount = p.mrp && p.price && Number(p.mrp) > Number(p.price)
    ? Math.round(((Number(p.mrp) - Number(p.price)) / Number(p.mrp)) * 100)
    : null;
  const category = p.category ?? p.cat ?? "";
  const description = p.description ?? p.desc ?? "";
  const { rating, reviewCount } = getDisplayRating(p);
  const iconKey = ICONS[p.icon] ? p.icon : "ring";

  // Supports a multi-image "imageUrls" array, or falls back to the older
  // single "imageUrl" field — same pattern as the phone case ProductCard.
  const images =
    Array.isArray(p.imageUrls) && p.imageUrls.length > 0
      ? p.imageUrls
      : p.imageUrl
      ? [p.imageUrl]
      : [];

  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultiple = images.length > 1;

  function showPrev(e) {
    e.preventDefault();
    setActiveIndex((i) => (i - 1 + images.length) % images.length);
  }
  function showNext(e) {
    e.preventDefault();
    setActiveIndex((i) => (i + 1) % images.length);
  }

  return (
    <article className="jw-card">
      <div className="jw-card-tag">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="var(--jw-gold)" strokeWidth="1.6">
          <circle cx="13" cy="7" r="4.2" />
          <path d="M13 11 C13 15 13 18 13 22" strokeDasharray="1 3" />
        </svg>
      </div>
      <div className="jw-card-media">
        {discount && <span className="jw-badge-discount">{discount}% OFF</span>}
        {images.length > 0 ? (
          <img
            src={images[activeIndex]}
            alt={`${p.name ?? "Jewellery piece"}${hasMultiple ? ` — photo ${activeIndex + 1} of ${images.length}` : ""}`}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        ) : (
          ICONS[iconKey]
        )}

        {hasMultiple && (
          <>
            <button className="jw-media-nav jw-media-nav-prev" onClick={showPrev} aria-label="Previous photo">
              ‹
            </button>
            <button className="jw-media-nav jw-media-nav-next" onClick={showNext} aria-label="Next photo">
              ›
            </button>
            <div className="jw-media-dots" role="tablist" aria-label="Photo selector">
              {images.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === activeIndex}
                  aria-label={`Show photo ${i + 1}`}
                  className={"jw-media-dot" + (i === activeIndex ? " jw-media-dot-active" : "")}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveIndex(i);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="jw-card-body">
        {category && <p className="jw-card-cat">{category}</p>}
        <h3 className="jw-card-name">{p.name ?? "Untitled piece"}</h3>
        <div className="jw-card-rating">
          <StarRow rating={rating} />
          <span className="jw-card-rating-value">{rating.toFixed(2)}</span>
          <span className="jw-card-rating-count">({formatReviewCount(reviewCount)})</span>
        </div>
        {description && <p className="jw-card-desc">{description}</p>}
        <div className="jw-card-footer">
          <div className="jw-card-price-group">
            {price && <span className="jw-card-price">{price}</span>}
            {mrp && <span className="jw-card-mrp">{mrp}</span>}
          </div>
          <a className="jw-wa-button" href={buildWhatsAppLink(p)} target="_blank" rel="noopener noreferrer" aria-label={`Ask about ${p.name ?? "this piece"} on WhatsApp`}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12.004 2c-5.514 0-9.997 4.478-9.997 9.997 0 1.762.464 3.484 1.345 4.997L2 22l5.144-1.342a9.96 9.96 0 004.86 1.238h.004c5.514 0 9.997-4.478 9.997-9.997 0-2.671-1.04-5.182-2.927-7.07A9.935 9.935 0 0012.004 2zm0 18.153a8.13 8.13 0 01-4.144-1.134l-.297-.176-3.054.797.815-2.978-.193-.306a8.14 8.14 0 01-1.256-4.36c0-4.501 3.66-8.161 8.162-8.161 2.18 0 4.229.85 5.77 2.393a8.106 8.106 0 012.39 5.775c-.003 4.502-3.663 8.15-8.193 8.15z" />
            </svg>
            Ask on WhatsApp
          </a>
        </div>
      </div>
    </article>
  );
}

function JewelryFAQ() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <section className="jw-faq-section" aria-labelledby="jw-faq-heading">
      <p className="jw-faq-eyebrow">Before you order</p>
      <h2 className="jw-faq-title" id="jw-faq-heading">Questions, answered</h2>
      <div className="jw-faq-list">
        {FAQS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={item.q} className={"jw-faq-item" + (isOpen ? " jw-faq-item-open" : "")}>
              <button className="jw-faq-question" aria-expanded={isOpen} onClick={() => setOpenIndex(isOpen ? -1 : i)}>
                <span className="jw-faq-dot" aria-hidden="true" />
                <span className="jw-faq-question-text">{item.q}</span>
                <span className="jw-faq-icon" aria-hidden="true">{isOpen ? "–" : "+"}</span>
              </button>
              <div className="jw-faq-answer-wrap" style={{ maxHeight: isOpen ? "240px" : "0px" }}>
                <p className="jw-faq-answer">{item.a}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---- Main export ------------------------------------------------------
export default function JewelryCollection({ onBack }) {
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error | empty
  const [activeCat, setActiveCat] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, COLLECTION_NAME), orderBy("name"));
        const snap = await getDocs(q);
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProducts(items);
        setStatus(items.length ? "ready" : "empty");
      } catch (err) {
        console.error("Failed to load jewelry:", err);
        setStatus("error");
      }
    }
    load();
  }, []);
  const navigate=useNavigate();
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category ?? p.cat).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const visible = useMemo(() => {
    return products.filter((p) => {
      const cat = p.category ?? p.cat;
      const matchesCat = activeCat === "All" || cat === activeCat;
      const matchesSearch = !search.trim() || (p.name ?? "").toLowerCase().includes(search.trim().toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [products, activeCat, search]);

  return (
    <div className="jw-view">
      <header className="jw-hero">
        <div className="jw-hero-inner">
          <p className="jw-eyebrow">Fine jewellery · Orders on WhatsApp</p>
          <h1 className="jw-wordmark">DeViR</h1>
          <div className="jw-wordmark-rule" />
          <p className="jw-tagline">Hand-picked pieces, one message away. Every order confirmed and paid for over a single WhatsApp chat.</p>
        </div>
      </header>

      <main className="jw-content">
        <div className="jw-toolbar">
          <div className="jw-chip-rail" role="tablist" aria-label="Filter by category">
            {categories.map((cat) => (
              <button
                key={cat}
                role="tab"
                aria-selected={activeCat === cat}
                className={"jw-chip" + (activeCat === cat ? " jw-chip-active" : "")}
                onClick={() => setActiveCat(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <input
              className="jw-search"
              type="search"
              placeholder="Search pieces…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search jewelry"
            />
           
              <button className="jw-nav-link" onClick={()=>(navigate("/"))}>
                ← Back to Cases
              </button>
          
          </div>
        </div>

        {status === "loading" && (
          <div className="jw-empty-state">
            <p>Loading the collection…</p>
          </div>
        )}

        {status === "error" && (
          <div className="jw-empty-state">
            <p className="jw-empty-state-title">Couldn't load the collection.</p>
            <p>Check that a <code>{COLLECTION_NAME}</code> collection exists in Firestore.</p>
          </div>
        )}

        {status === "empty" && (
          <div className="jw-empty-state">
            <p className="jw-empty-state-title">No pieces yet.</p>
            <p>Add documents to the <code>{COLLECTION_NAME}</code> collection in the Firebase console.</p>
          </div>
        )}

        {status === "ready" && visible.length === 0 && (
          <div className="jw-empty-state">
            <p className="jw-empty-state-title">Nothing here yet</p>
            <p>Try a different category or search term.</p>
          </div>
        )}

        {status === "ready" && visible.length > 0 && (
          <div className="jw-grid">
            {visible.map((p) => <JewelryCard key={p.id} p={p} />)}
          </div>
        )}
      </main>

      <JewelryFAQ />

      <footer className="jw-site-footer">
        <p>© DeViR Jewellery — orders taken on WhatsApp only</p>
      </footer>
    </div>
  );
}