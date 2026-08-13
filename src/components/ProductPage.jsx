import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useCart } from "../context/CartContext";
import { RETURN_POLICY_SHORT, STORE_NAME } from "../config";
import "../productPage.css";
import FAQSection from "../FAQSection";
import NotifyModal from "./NotifyModal";

function formatPrice(value, currency = "INR") {
  if (value === undefined || value === null || value === "") return null;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `${currency} ${value}`;
  }
}

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, count, items, updateQty } = useCart();

  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | notfound | error
  const [activeIndex, setActiveIndex] = useState(0);
  const [qty, setQty] = useState(0);
  const [modalMsg, setModalMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      console.debug("ProductPage: loading product", id);
      setStatus("loading");
      try {
        const snap = await getDoc(doc(db, "products", id));
        console.debug("ProductPage: got snap exists=", snap.exists());
        if (cancelled) return;
        if (!snap.exists()) {
          setStatus("notfound");
          return;
        }
        setProduct({ id: snap.id, ...snap.data() });
        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error("Failed to load product:", err);
        if (!cancelled) setStatus("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // keep local qty in sync with cart
  useEffect(() => {
    if (!product) return;
    const existing = items.find((i) => i.id === product.id);
    setQty(existing ? existing.qty : 0);
  }, [product, items]);

  if (status === "loading") {
    return (
      <div className="page">
        <div className="state-block">
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (status === "notfound" || status === "error") {
    return (
      <div className="page">
        <div className="state-block">
          <p className="state-title">{status === "notfound" ? "Couldn't find that cover." : "Something went wrong."}</p>
          <Link to="/" className="pp-back-link">← Back to {STORE_NAME}</Link>
        </div>
      </div>
    );
  }

  const price = formatPrice(product.price, product.currency);
  const mrp = formatPrice(product.mrp, product.currency);
  const outOfStock = product.inStock === false;
  const hasStockCount = typeof product.stock === "number";
  const maxStock = hasStockCount ? Math.max(0, Number(product.stock)) : Infinity;
  const outOfStockEffective = outOfStock || maxStock === 0;
  const images =
    Array.isArray(product.imageUrls) && product.imageUrls.length > 0
      ? product.imageUrls
      : product.imageUrl
      ? [product.imageUrl]
      : [];

  // add-to-cart removed; qty stepper will update cart directly

  function handleBuyNow() {
    if (outOfStockEffective) {
      setModalMsg("This product is out of stock.");
      return;
    }
    const desired = qty <= 0 ? 1 : qty;
    const existing = items.find((i) => i.id === product.id);
    if (!existing) {
      if (hasStockCount && desired > maxStock) {
        setModalMsg(`Only ${maxStock} unit(s) of "${product.name}" are available.`);
        return;
      }
      addItem(product, desired);
    }
    // if it already exists, don't change qty — just go to cart
    navigate("/cart");
  }

  return (
    <div className="page">
      <div className="pp-wrap">
        <Link to="/" className="pp-back-link">← Back to {STORE_NAME}</Link>

        <div className="pp-grid">
          <div className="pp-gallery">
            <div className="pp-main-image">
              {images.length > 0 ? (
                <img src={images[activeIndex]} alt={product.name} />
              ) : (
                <div className="card-media-fallback">No image</div>
              )}
              {outOfStock && <span className="badge-out">Sold out</span>}
            </div>
            {images.length > 1 && (
              <div className="pp-thumbs">
                {images.map((src, i) => (
                  <button
                    key={i}
                    className={"pp-thumb" + (i === activeIndex ? " pp-thumb-active" : "")}
                    onClick={() => setActiveIndex(i)}
                    aria-label={`Show photo ${i + 1}`}
                  >
                    <img src={src} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pp-details">
            {product.model && <p className="card-model">{product.model}</p>}
            <h1 className="pp-name">{product.name}</h1>

            <div className="pp-price-row">
              {price && <span className="pp-price">{price}</span>}
              {mrp && <span className="card-mrp">{mrp}</span>}
            </div>

            {product.description && <p className="pp-desc">{product.description}</p>}

            <div className="pp-qty-row">
         
              {qty === 0 ? (
                    
                <div>
                  
                  <button
                    className="pp-btn pp-btn-secondary"
                    onClick={() => {
                          if (outOfStockEffective) {
                            setModalMsg("This product is out of stock.");
                            return;
                          }
                          const desired = 1;
                          if (hasStockCount && desired > maxStock) {
                            setModalMsg(`Only ${maxStock} unit(s) of "${product.name}" are available.`);
                            return;
                          }
                          addItem(product, 1);
                          setQty(1);
                    }}
                  >
                    Add to Cart
                  </button>
                </div>
              ) : (
                <div className="pp-qty-stepper">
                  <button
                    onClick={() => {
                      const next = Math.max(0, qty - 1);
                      setQty(next);
                      const existing = items.find((i) => i.id === product?.id);
                      // updateQty will remove the item if qty <= 0
                      if (existing) updateQty(product.id, next);
                    }}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span>{qty}</span>
                  <button
                    onClick={() => {
                      const nextRaw = qty + 1;
                      const next = hasStockCount ? Math.min(nextRaw, maxStock) : nextRaw;
                      if (next === qty) {
                        if (hasStockCount) setModalMsg(`Only ${maxStock} unit(s) of "${product.name}" are available.`);
                        return; // already at max
                      }
                      setQty(next);
                      const existing = items.find((i) => i.id === product?.id);
                      if (existing) {
                        updateQty(product.id, next);
                      } else {
                        addItem(product, next);
                      }
                    }}
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            <div className="pp-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="pp-btn pp-btn-primary" onClick={handleBuyNow} disabled={outOfStockEffective}>
                {outOfStockEffective ? "Sold out" : "Buy Now"}
              </button>

              <NotifyModal message={modalMsg} onClose={() => setModalMsg("")} />

              {qty > 0 && (
                <Link to="/cart" className="pp-btn pp-btn-secondary" style={{ marginLeft: 8 }}>
                  Go to cart ({Number(count || 0)})
                </Link>
              )}
            </div>

            <div className="pp-policy-notice">
              <span className="pp-policy-badge">Non-refundable</span>
              <p>{RETURN_POLICY_SHORT} <Link to="/#faq">Read the full policy →</Link></p>
            </div>
        
          </div>
        </div>
            <FAQSection />
      </div>
    </div>
  );
}
