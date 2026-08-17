import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useCart } from "../context/CartContext";
import { RETURN_POLICY_SHORT, STORE_NAME, WHATSAPP_NUMBER } from "../config";
import "../productPage.css";
import FAQSection from "../FAQSection";
import NotifyModal from "./NotifyModal";
import Footer from "./Footer";

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

            {/* <div className="pp-policy-notice">
              <span className="pp-policy-badge">Read the policy for return and refunds before placing the order</span>
              <p>{RETURN_POLICY_SHORT} <a href="/returnPolicy">Read the full policy →</a></p>
            </div> */}
                   {/* <a className="wa-button wa-button-secondary"
            href={buildWhatsAppLink(product)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ask about ${product.name ?? "this cover"} on WhatsApp`}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12.004 2c-5.514 0-9.997 4.478-9.997 9.997 0 1.762.464 3.484 1.345 4.997L2 22l5.144-1.342a9.96 9.96 0 004.86 1.238h.004c5.514 0 9.997-4.478 9.997-9.997 0-2.671-1.04-5.182-2.927-7.07A9.935 9.935 0 0012.004 2zm0 18.153a8.13 8.13 0 01-4.144-1.134l-.297-.176-3.054.797.815-2.978-.193-.306a8.14 8.14 0 01-1.256-4.36c0-4.501 3.66-8.161 8.162-8.161 2.18 0 4.229.85 5.77 2.393a8.106 8.106 0 012.39 5.775c-.003 4.502-3.663 8.15-8.193 8.15z" />
            </svg>
            Ask on WhatsApp instead
          </a> */}
          
<div className="live-preview-block">
  <div className="live-preview-icon">
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  </div>
  <div className="live-preview-text">
    <p className="live-preview-title">Want to see it in real life?</p>
    <p className="live-preview-sub">
      Follow us on Instagram — we regularly post reels and photos of our products in real life.
    </p>
  </div>
  
   <a href={"https://www.instagram.com/thecasewall?utm_source=qr&igsh=MWl3OHo5ajRuOGt1Mg%3D%3D"}
    target="_blank"
    rel="noopener noreferrer"
    className="live-preview-btn"
    aria-label="Follow us on Instagram"
  >
    Visit Instagram →
  </a>
</div>
          
          <div className="trust-strip">
  <span>✅ Razorpay Verified Seller</span>
  <span>↩️ 2-Day Return & Exchange*</span>
  <span>🚚 Ships All Over India</span>
</div>
<p className="trust-strip-note">*Conditions apply — see return policy</p>
          </div>
        </div>

      

            <FAQSection  />

              <div className="pp-reviews" id="reviews" style={{marginTop:150}}>
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
      <Footer />
    </div>
  );
}