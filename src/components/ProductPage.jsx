import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useCart } from "../context/CartContext";
import { RETURN_POLICY_SHORT, STORE_NAME, WHATSAPP_NUMBER } from "../config";
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

// Older docs may have reviews stored as plain strings; normalize everything
// to { text, images, verified } and drop anything malformed.
function normalizeReviews(reviews) {
  if (!Array.isArray(reviews)) return [];
  return reviews.map((r) => {
    if (typeof r === "string") {
      return { name: "", text: r, images: [], verified: false };
    }
    return {
      name: r?.name || "",
      text: r?.text || "",
      images: Array.isArray(r?.images) ? r.images : [],
      verified: !!r?.verified,
    };
  });
}

// Accepts digits with an optional leading "+" and optional spaces/dashes/
// parentheses (e.g. "+91 98765 43210", "9876543210"), 7-15 digits total.
// Rejects anything with letters or too few/many digits.
function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^\+?[0-9]{7,15}$/.test(cleaned);
}

function formatJewelleryType(type) {
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
  const [activeReviewImage, setActiveReviewImage] = useState(null);

  // --- write-a-review state ---
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewName, setReviewName] = useState("");
  const [reviewPhone, setReviewPhone] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

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

  const jewelleryTypes =
    product.isJewellery && Array.isArray(product.jewelleryTypes)
      ? product.jewelleryTypes
      : [];

  // Only verified reviews are ever shown to customers — unverified ones
  // stay hidden even though they exist on the product document.
  const allReviews = normalizeReviews(product.reviews);
  const visibleReviews = allReviews.filter((r) => r.verified);

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

  function handleReviewSubmit(e) {
    e.preventDefault();

    if (!reviewName.trim() || !reviewPhone.trim() || !reviewText.trim()) {
      setModalMsg("Please add your name, phone number, and review before submitting.");
      return;
    }

    if (!isValidPhone(reviewPhone)) {
      setModalMsg("Please enter a valid phone number (digits only, 7-15 digits).");
      return;
    }

    if (!WHATSAPP_NUMBER) {
      console.error("WHATSAPP_NUMBER is not configured in ../config");
      setModalMsg("Reviews can't be submitted right now. Please try again later.");
      return;
    }

    const message = [
      `New review for: ${product.name}`,
      `Name: ${reviewName.trim()}`,
      `Phone: ${reviewPhone.trim()}`,
      `Review: ${reviewText.trim()}`,
    ].join("\n");

    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    // Reset the form and show the "pending verification" state once they
    // come back from WhatsApp.
    setReviewSubmitted(true);
    setShowReviewForm(false);
    setReviewName("");
    setReviewPhone("");
    setReviewText("");
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

            {jewelleryTypes.length > 0 && (
              <div className="pp-jewellery-types">
                {jewelleryTypes.map((type) => (
                  <span className="pp-jewellery-badge" key={type}>
                    {formatJewelleryType(type)}
                  </span>
                ))}
              </div>
            )}

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
              <p>{RETURN_POLICY_SHORT} <a href="#faq">Read the full policy →</a></p>
            </div>
        
          </div>
        </div>

      

            <FAQSection  />

              <div className="pp-reviews" id="reviews">
          <div className="pp-reviews-header">
            <h2 className="pp-reviews-title">
              Customer Reviews
              {visibleReviews.length > 0 && (
                <span className="pp-reviews-count"> ({visibleReviews.length})</span>
              )}
            </h2>

            {!showReviewForm && (
              <button
                type="button"
                className="pp-btn pp-btn-secondary pp-write-review-btn"
                onClick={() => {
                  setReviewSubmitted(false);
                  setShowReviewForm(true);
                }}
              >
                Write a Review
              </button>
            )}
          </div>

          {reviewSubmitted && (
            <p className="pp-review-thankyou">
              Thanks for sending your review on WhatsApp! Once verified, your review will get added here.
            </p>
          )}

          {showReviewForm && (
            <form className="pp-review-form" onSubmit={handleReviewSubmit}>
              <p className="pp-review-form-note">
                We'll open WhatsApp with your review filled in — just hit send there to submit it.
              </p>

              <label className="pp-review-field">
                Name
                <input
                  type="text"
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </label>

              <label className="pp-review-field">
                Phone Number
                <input
                  type="tel"
                  inputMode="tel"
                  value={reviewPhone}
                  onChange={(e) => {
                    // allow only digits, "+", spaces, dashes, parentheses
                    const cleaned = e.target.value.replace(/[^0-9+\-\s()]/g, "");
                    setReviewPhone(cleaned);
                  }}
                  placeholder="Your phone number"
                  pattern="\+?[0-9\s\-()]{7,15}"
                  title="Enter a valid phone number (7-15 digits)"
                  required
                />
              </label>

              <label className="pp-review-field">
                Review
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="Tell us what you think about this product"
                  rows={4}
                  required
                />
              </label>

              <div className="pp-review-form-actions">
                <button type="submit" className="pp-btn pp-btn-primary">
                  Submit via WhatsApp
                </button>
                <button
                  type="button"
                  className="pp-btn pp-btn-secondary"
                  onClick={() => setShowReviewForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {visibleReviews.length === 0 ? (
            <p className="muted">No reviews yet.</p>
          ) : (
            <ul className="pp-review-list">
              {visibleReviews.map((review, i) => (
                <li className="pp-review" key={i}>
                  {review.name && <p className="pp-review-author">customer name: {review.name}</p>}
                  <p className="pp-review-text">{review.text}</p>
                  {review.images.length > 0 && (
                    <div className="pp-review-images">
                      {review.images.map((src, imgI) => (
                        <button
                          key={imgI}
                          type="button"
                          className="pp-review-thumb-btn"
                          onClick={() => setActiveReviewImage(src)}
                          aria-label="View review photo"
                        >
                          <img src={src} alt="" className="pp-review-thumb" />
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {activeReviewImage && (
          <div className="pp-review-lightbox" onClick={() => setActiveReviewImage(null)}>
            <img src={activeReviewImage} alt="Review" />
          </div>
        )}
      </div>
      
    </div>
  );
}