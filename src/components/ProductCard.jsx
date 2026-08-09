import { useState } from "react";
import { WHATSAPP_NUMBER } from "../config";

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

export default function ProductCard({ product }) {
  const price = formatPrice(product.price, product.currency);
  const mrp = formatPrice(product.mrp, product.currency);
  const outOfStock = product.inStock === false;

  const discountPercent =
    product.mrp && product.price && Number(product.mrp) > Number(product.price)
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
    setActiveIndex((i) => (i - 1 + images.length) % images.length);
  }
  function showNext(e) {
    e.preventDefault();
    setActiveIndex((i) => (i + 1) % images.length);
  }

  return (
    <article className={"card" + (outOfStock ? " card-out" : "")}>
      <div className="card-peg" aria-hidden="true">
        <span className="peg-hole" />
      </div>

      <div className="card-media">
        {images.length > 0 ? (
          <img
            src={images[activeIndex]}
            alt={`${product.name ?? "Phone cover"}${hasMultiple ? ` — photo ${activeIndex + 1} of ${images.length}` : ""}`}
            loading="lazy"
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
                    setActiveIndex(i);
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card-body">
        {product.model && <p className="card-model">{product.model}</p>}
        <h3 className="card-name">{product.name ?? "Untitled cover"}</h3>
        {product.description && <p className="card-desc">{product.description}</p>}

        <div className="card-footer">
          <div className="card-price-group">
            {price && <span className="card-price">{price}</span>}
            {mrp && <span className="card-mrp">{mrp}</span>}
          </div>
          
            <a className="wa-button"
            href={buildWhatsAppLink(product)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ask about ${product.name ?? "this cover"} on WhatsApp`}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
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