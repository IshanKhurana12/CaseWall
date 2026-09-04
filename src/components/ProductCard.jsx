import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { WHATSAPP_NUMBER } from "../config";
import { useCart } from "../context/CartContext";
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

// Simple string hash -> deterministic pseudo-random number generator.
// Same seed always produces the same sequence, so a product's "random"
// rating/review count stays stable across re-renders instead of jumping
// around every time the component draws.
// Generates a plausible rating (4.0–5.0) and review count (12–980) when a
// product doesn't already specify its own. Seeded by the product's id/name
// so the same product always gets the same "random" numbers.
function buildWhatsAppLink(product) {
  const price = formatPrice(product.price, product.currency);
  const mrp = formatPrice(product.mrp, product.currency);
  const lines = [
    `Hi! I'm interested in "${product.name ?? "this cover"}"`,
    product.model ? `for ${product.model}` : null,
    price ? `(${price}${mrp ? `, MRP ${mrp}` : ""})` : null,
    "— is it available?",
  ].filter(Boolean);
  const message = encodeURIComponent(lines.join(" "));
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
}

// Renders a 5-star row where each star can be empty, full, or half-filled
// based on the numeric rating (e.g. 4.47 -> 4 full stars, 1 half star).
export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { addItem, items, updateQty } = useCart();
  const [added, setAdded] = useState(false);
  const [modalMsg, setModalMsg] = useState("");

  // Products with variants don't carry a reliable top-level price/stock —
  // that lives per-variant. Card shows "From ₹X" and sends the shopper to
  // the product page to pick model/color instead of guessing a variant here.
  const hasVariants = product.hasVariants === true;

  const displayPriceValue = hasVariants ? product.priceFrom : product.price;
  const price = formatPrice(displayPriceValue, product.currency);
  const mrp = !hasVariants ? formatPrice(product.mrp, product.currency) : null;

  const outOfStock = !hasVariants && product.inStock === false;
  const hasStockCount = !hasVariants && typeof product.stock === "number";
  const maxStock = hasStockCount ? Math.max(0, Number(product.stock)) : Infinity;

  // Legacy cart item for this product (variantId "_legacy"). Only meaningful
  // for non-variant products — variant products always route through the
  // product page, so there's no single cart line to show a stepper for here.
  const existing = !hasVariants
    ? items.find((i) => i.productId === product.id && i.variantId === "_legacy")
    : null;
  const existingQty = existing ? existing.qty : 0;

  function goToProduct() {
    navigate(`/product/${product.id}`);
  }

  function handleAddToCart(e) {
    e.preventDefault && e.preventDefault();
    if (hasVariants) return goToProduct();
    if (outOfStock || (hasStockCount && maxStock <= 0)) {
      setModalMsg("This product is out of stock.");
      return;
    }
    if (hasStockCount && existingQty + 1 > maxStock) {
      setModalMsg(`Only ${maxStock} unit(s) of "${product.name}" are available.`);
      return;
    }
    addItem(
      product,
      { id: "_legacy", model: product.model || null, color: null, price: product.price, imageUrls: product.imageUrls },
      1
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  function handleBuyNow(e) {
    e.preventDefault && e.preventDefault();
    if (hasVariants) return goToProduct();
    if (!existing) {
      if (outOfStock || (hasStockCount && maxStock <= 0)) {
        setModalMsg("This product is out of stock.");
        return;
      }
      if (hasStockCount && 1 > maxStock) {
        setModalMsg(`Only ${maxStock} unit(s) of "${product.name}" are available.`);
        return;
      }
      addItem(
        product,
        { id: "_legacy", model: product.model || null, color: null, price: product.price, imageUrls: product.imageUrls },
        1
      );
    }
    navigate("/cart");
  }

  const discountPercent =
    !hasVariants && product.mrp && product.price && Number(product.mrp) > Number(product.price)
      ? Math.round(((Number(product.mrp) - Number(product.price)) / Number(product.mrp)) * 100)
      : null;

  // Supports a multi-image "imageUrls" array, or falls back to the older
  // single "imageUrl" field so existing products keep working unchanged.
  const images =
    Array.isArray(product.imageUrls) && product.imageUrls.length > 0
      ? product.imageUrls
      : product.imageUrl
      ? [product.imageUrl]
      : [];

  const [activeIndex, setActiveIndex] = useState(0);
  const hasMultiple = images.length > 1;
  function showPrev(e) {
    e.preventDefault();
    e.stopPropagation();
    setActiveIndex((i) => (i - 1 + images.length) % images.length);
  }
  function showNext(e) {
    e.preventDefault();
    e.stopPropagation();
    setActiveIndex((i) => (i + 1) % images.length);
  }

  // --- Swipe support (mobile) -------------------------------------------
  // Tracks the horizontal touch position across touchstart -> touchmove ->
  // touchend so a left/right swipe on the product image can move to the
  // next/previous photo, same as tapping the prev/next buttons.
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const SWIPE_THRESHOLD = 40; // min horizontal px to count as a swipe
  const DIRECTION_LOCK = 8; // px of movement before we decide h vs v scroll

  function handleTouchStart(e) {
    const t = e.targetTouches[0];
    setTouchStartX(t.clientX);
    setTouchStartY(t.clientY);
    setTouchDeltaX(0);
    setIsSwiping(false);
  }

  function handleTouchMove(e) {
    if (touchStartX === null || touchStartY === null) return;
    const t = e.targetTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    // Decide once whether this gesture is a horizontal swipe or a vertical
    // page scroll, based on whichever axis moved further first.
    if (!isSwiping && Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) {
      return;
    }
    if (!isSwiping) {
      if (Math.abs(dx) > Math.abs(dy)) {
        setIsSwiping(true);
      } else {
        // Vertical scroll wins; stop tracking this gesture as a swipe.
        setTouchStartX(null);
        setTouchStartY(null);
        return;
      }
    }

    // Prevent the page from scrolling while the user drags the image.
    e.preventDefault();
    setTouchDeltaX(dx);
  }

  function handleTouchEnd() {
    if (isSwiping && Math.abs(touchDeltaX) > SWIPE_THRESHOLD) {
      if (touchDeltaX < 0) {
        setActiveIndex((i) => (i + 1) % images.length);
      } else {
        setActiveIndex((i) => (i - 1 + images.length) % images.length);
      }
    }
    setTouchStartX(null);
    setTouchStartY(null);
    setTouchDeltaX(0);
    setIsSwiping(false);
  }

  return (
    <article className={"card" + (outOfStock ? " card-out" : "")}>
      <div className="card-peg" aria-hidden="true">
        <span className="peg-hole" />
      </div>

      <div
        className="card-media"
        role="link"
        tabIndex={0}
        aria-label={`View ${product.name ?? "this cover"}`}
        onClick={(e) => {
          // Skip navigation if the tap was actually a swipe drag.
          if (isSwiping) {
            e.preventDefault();
            return;
          }
          navigate(`/product/${product.id}`);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") navigate(`/product/${product.id}`);
        }}
        onTouchStart={hasMultiple ? handleTouchStart : undefined}
        onTouchMove={hasMultiple ? handleTouchMove : undefined}
        onTouchEnd={hasMultiple ? handleTouchEnd : undefined}
        style={{ touchAction: hasMultiple ? "pan-y" : undefined }}
      >
        {images.length > 0 ? (
          <img
            src={images[activeIndex]}
            alt={`${product.name ?? "Phone cover"}${hasMultiple ? ` — photo ${activeIndex + 1} of ${images.length}` : ""}`}
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="card-media-fallback">No image</div>
        )}
        {outOfStock && <span className="badge-out">Sold out</span>}
        {!outOfStock && discountPercent && <span className="badge-discount">{discountPercent}% OFF</span>}

        {hasMultiple && (
          <>
            <button className="media-nav media-nav-prev" onClick={showPrev} aria-label="Previous photo">
              ‹
            </button>
            <button className="media-nav media-nav-next" onClick={showNext} aria-label="Next photo">
              ›
            </button>
            <div className="media-dots" role="tablist" aria-label="Photo selector">
              {images.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === activeIndex}
                  aria-label={`Show photo ${i + 1}`}
                  className={"media-dot" + (i === activeIndex ? " media-dot-active" : "")}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveIndex(i);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card-body">
        {!hasVariants ?  product.model && <p className="card-model">{product.model}</p> :   product.model && <p className="card-model">Choose from Models</p> }
      
        <Link to={`/product/${product.id}`} className="card-name-link">
          <h3 className="card-name">{product.name ?? "Untitled cover"}</h3>
        </Link>
        <div className="card-footer">
          <div className="card-price-group">
            {price && <span className="card-price">{hasVariants ? `From ${price}` : price}</span>}
            {mrp && <span className="card-mrp">{mrp}</span>}
          </div>

          {!outOfStock && (
            <div className="card-cta-row">
              {hasVariants ? (
                <button className="buy-button" onClick={goToProduct} aria-label={`Choose options for ${product.name ?? "this cover"}`}>
                  Choose Options
                </button>
              ) : (
                <>
                  {existingQty > 0 ? (
                    <div className="card-stepper">
                      <button
                        className="stepper-decrease"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = Math.max(0, existingQty - 1);
                          updateQty(product.id, "_legacy", next);
                        }}
                        aria-label={`Decrease ${product.name ?? "this cover"} quantity`}
                      >
                        −
                      </button>
                      <span className="stepper-qty">{existingQty}</span>
                      <button
                        className="stepper-increase"
                        onClick={(e) => {
                          e.stopPropagation();
                          const desired = existingQty + 1;
                          const next = hasStockCount ? Math.min(desired, maxStock) : desired;
                          if (next === existingQty) {
                            if (hasStockCount) setModalMsg(`Only ${maxStock} unit(s) of "${product.name}" are available.`);
                            return;
                          }
                          updateQty(product.id, "_legacy", next);
                        }}
                        aria-label={`Increase ${product.name ?? "this cover"} quantity`}
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button className="cart-button" onClick={handleAddToCart} aria-label={`Add ${product.name ?? "this cover"} to cart`}>
                      {added ? "Added ✓" : "Add to Cart"}
                    </button>
                  )}

                  <button className="buy-button" onClick={handleBuyNow} aria-label={`Buy ${product.name ?? "this cover"} now`}>
                    Buy Now
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <NotifyModal message={modalMsg} onClose={() => setModalMsg("")} />
    </article>
  );
}