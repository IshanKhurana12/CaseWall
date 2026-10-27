import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CART_OFFER, SHIPPING_FREE_THRESHOLD_RUPEES } from "../config";
import "../siteChrome.css";

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
    Number(value) || 0
  );
}

// Generic promo pop-up, shown once per browser session per offer. What it
// says is configured in CART_OFFER (src/config.js), so a new offer only
// needs a config change.
export default function OfferPopup({ orderValue, offer = CART_OFFER }) {
  const seenKey = `casewall_offer_seen_${offer?.id || "default"}`;
  const [open, setOpen] = useState(() => {
    if (!offer?.enabled) return false;
    try {
      return sessionStorage.getItem(seenKey) !== "1";
    } catch {
      return true;
    }
  });
  const closeRef = useRef(null);

  function close() {
    setOpen(false);
    try {
      sessionStorage.setItem(seenKey, "1");
    } catch {
      /* private mode — fine, it just shows again next visit */
    }
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const threshold = formatPrice(SHIPPING_FREE_THRESHOLD_RUPEES);
  const title = String(offer.title || "").replace("{threshold}", threshold);
  const remaining = Math.max(0, SHIPPING_FREE_THRESHOLD_RUPEES - (Number(orderValue) || 0));
  const showProgress = offer.showFreeShippingProgress !== false;

  return (
    <div className="offer-backdrop" onClick={close}>
      <div
        className="offer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="offer-x" onClick={close} aria-label="Close">
          ×
        </button>
        {offer.icon && (
          <div className="offer-icon" aria-hidden="true">
            {offer.icon}
          </div>
        )}
        {offer.label && <p className="offer-eyebrow">{offer.label}</p>}
        <h2 id="offer-title" className="offer-title">
          {title}
        </h2>
        {offer.message && <p className="offer-status">{offer.message}</p>}
        {showProgress &&
          (remaining <= 0 ? (
            <p className="offer-status offer-status-good">🎉 Your order qualifies for free shipping!</p>
          ) : (
            <p className="offer-status">
              Add <strong>{formatPrice(remaining)}</strong> more to get free shipping.
            </p>
          ))}
        <div className="offer-actions">
          <button ref={closeRef} type="button" className="btn btn-primary btn-block" onClick={close}>
            Got it
          </button>
          {showProgress && remaining > 0 && (
            <Link to="/" className="btn btn-ghost btn-block" onClick={close}>
              Add more items
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
