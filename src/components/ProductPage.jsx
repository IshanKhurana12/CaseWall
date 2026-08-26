import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
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

// A single "legacy" pseudo-variant so non-variant products flow through
// the exact same selectedVariant-driven code path below.
function legacyVariantFrom(product) {
  return {
    id: "_legacy",
    model: product.model || null,
    color: null,
    price: product.price,
    mrp: product.mrp,
    stock: product.stock,
    reservedStock: product.reservedStock || 0,
    inStock: product.inStock,
    imageUrls: product.imageUrls,
    active: product.inStock === false ? false : true,
  };
}

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, count, items, updateQty } = useCart();

  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]); // real variants, empty for legacy products
  const [status, setStatus] = useState("loading"); // loading | ready | notfound | error
  const [activeIndex, setActiveIndex] = useState(0);
  const [modalMsg, setModalMsg] = useState("");
  const [activeReviewImage, setActiveReviewImage] = useState(null);

  // --- variant selection state ---
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);

  // --- write-a-review state ---
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewName, setReviewName] = useState("");
  const [reviewPhone, setReviewPhone] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        const snap = await getDoc(doc(db, "products", id));
        if (cancelled) return;
        if (!snap.exists()) {
          setStatus("notfound");
          return;
        }
        const productData = { id: snap.id, ...snap.data() };
        setProduct(productData);

        if (productData.hasVariants) {
          const variantsSnap = await getDocs(collection(db, "products", id, "variants"));
          if (cancelled) return;
          const variantList = variantsSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((v) => v.active !== false);
          setVariants(variantList);

          // default selection: first available model, first available color for it
          if (variantList.length > 0) {
            const firstModel = variantList[0].model;
            setSelectedModel(firstModel);
            const firstColorForModel = variantList.find((v) => v.model === firstModel);
            setSelectedColor(firstColorForModel?.color ?? null);
          }
        } else {
          setVariants([]);
        }

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

  // models available, in the order they first appear among variants
  const models = useMemo(() => {
    const seen = [];
    for (const v of variants) {
      if (v.model && !seen.includes(v.model)) seen.push(v.model);
    }
    return seen;
  }, [variants]);

  // colors available for the currently selected model
  const colorsForSelectedModel = useMemo(() => {
    if (!selectedModel) return [];
    const seen = [];
    for (const v of variants) {
      if (v.model === selectedModel && v.color && !seen.includes(v.color)) seen.push(v.color);
    }
    return seen;
  }, [variants, selectedModel]);

  // when the model changes, make sure selectedColor is still valid for it
  useEffect(() => {
    if (!selectedModel) return;
    const stillValid = variants.some((v) => v.model === selectedModel && v.color === selectedColor);
    if (!stillValid) {
      const fallback = variants.find((v) => v.model === selectedModel);
      setSelectedColor(fallback?.color ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel, variants]);

  const selectedVariant = useMemo(() => {
    if (!product) return null;
    if (!product.hasVariants) return legacyVariantFrom(product);
    return variants.find((v) => v.model === selectedModel && v.color === selectedColor) || null;
  }, [product, variants, selectedModel, selectedColor]);

  // qty of the *currently selected variant* that's already in the cart
  const cartQtyForSelectedVariant = useMemo(() => {
    if (!product || !selectedVariant) return 0;
    const existing = items.find((i) => i.productId === product.id && i.variantId === selectedVariant.id);
    return existing ? existing.qty : 0;
  }, [items, product, selectedVariant]);

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

  const price = formatPrice(selectedVariant?.price, product.currency);
  const mrp = formatPrice(product.hasVariants ? selectedVariant?.mrp : product.mrp, product.currency);

  const outOfStock = selectedVariant ? selectedVariant.inStock === false : true;
  const hasStockCount = selectedVariant && typeof selectedVariant.stock === "number";
  const rawAvailable = hasStockCount
    ? Math.max(0, Number(selectedVariant.stock) - Number(selectedVariant.reservedStock || 0))
    : Infinity;
  const maxStock = hasStockCount ? rawAvailable : Infinity;
  const outOfStockEffective = !selectedVariant || outOfStock || maxStock === 0;

  const variantImages = Array.isArray(selectedVariant?.imageUrls) ? selectedVariant.imageUrls : null;
  const images =
    variantImages && variantImages.length > 0
      ? variantImages
      : Array.isArray(product.imageUrls) && product.imageUrls.length > 0
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

  function handleBuyNow() {
    if (outOfStockEffective || !selectedVariant) {
      setModalMsg("This product is out of stock.");
      return;
    }
    const desired = cartQtyForSelectedVariant <= 0 ? 1 : cartQtyForSelectedVariant;
    if (cartQtyForSelectedVariant <= 0) {
      if (hasStockCount && desired > maxStock) {
        setModalMsg(`Only ${maxStock} unit(s) of "${product.name}" are available.`);
        return;
      }
      addItem(product, selectedVariant, desired);
    }
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
            {selectedVariant?.model && <p className="card-model">{selectedVariant.model}</p>}
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

            {/* {product.description && <p className="pp-desc">{product.description}</p>} */}

            {product.description && (
  <div className="pp-desc">
    {product.description
      .split(".")
      .map((sentence) => sentence.trim())
      .filter(Boolean)
      .map((sentence, i) => (
        <p key={i} className="pp-desc-line">
          {sentence}.
        </p>
      ))}
  </div>
)}

            {/* --- variant picker: only rendered for products that actually have variants --- */}
            {product.hasVariants && (
              <div className="pp-variant-picker">
                {models.length > 0 && (
                  <div className="pp-variant-group">
                    <p className="pp-variant-label">Model</p>
                    <div className="pp-variant-options">
                      {models.map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={"pp-variant-chip" + (m === selectedModel ? " pp-variant-chip-active" : "")}
                          onClick={() => setSelectedModel(m)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {colorsForSelectedModel.length > 0 && (
                  <div className="pp-variant-group">
                    <p className="pp-variant-label">Colour</p>
                    <div className="pp-variant-options">
                      {colorsForSelectedModel.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={"pp-variant-chip" + (c === selectedColor ? " pp-variant-chip-active" : "")}
                          onClick={() => setSelectedColor(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!selectedVariant && (
                  <p className="pp-variant-unavailable">That combination isn't available.</p>
                )}
              </div>
            )}

            <div className="pp-qty-row">
              {cartQtyForSelectedVariant === 0 ? (
                <div>
                  <button
                    className="pp-btn pp-btn-secondary"
                    disabled={!selectedVariant}
                    onClick={() => {
                      if (outOfStockEffective || !selectedVariant) {
                        setModalMsg("This product is out of stock.");
                        return;
                      }
                      const desired = 1;
                      if (hasStockCount && desired > maxStock) {
                        setModalMsg(`Only ${maxStock} unit(s) of "${product.name}" are available.`);
                        return;
                      }
                      addItem(product, selectedVariant, 1);
                    }}
                  >
                    Add to Cart
                  </button>
                </div>
              ) : (
                <div className="pp-qty-stepper">
                  <button
                    onClick={() => {
                      const next = Math.max(0, cartQtyForSelectedVariant - 1);
                      updateQty(product.id, selectedVariant.id, next);
                    }}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span>{cartQtyForSelectedVariant}</span>
                  <button
                    onClick={() => {
                      const nextRaw = cartQtyForSelectedVariant + 1;
                      const next = hasStockCount ? Math.min(nextRaw, maxStock) : nextRaw;
                      if (next === cartQtyForSelectedVariant) {
                        if (hasStockCount) setModalMsg(`Only ${maxStock} unit(s) of "${product.name}" are available.`);
                        return;
                      }
                      updateQty(product.id, selectedVariant.id, next);
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

              {cartQtyForSelectedVariant > 0 && (
                <Link to="/cart" className="pp-btn pp-btn-secondary" style={{ marginLeft: 8 }}>
                  Go to cart ({Number(count || 0)})
                </Link>
              )}
            </div>

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

        <FAQSection />

        <div className="pp-reviews" id="reviews" style={{ marginTop: 150 }}>
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