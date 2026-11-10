import { Link } from "react-router-dom";
import OfferCarousel from "./OfferCarousel";
import { CashIcon, ReturnIcon, ShieldIcon, TruckIcon } from "./Icons";
import { responsiveImg } from "../lib/images";
import "../heroBento.css";

const WHATSAPP_COMMUNITY_URL = "https://chat.whatsapp.com/Gqk3LnfSjT9KKViKH1GgUQ";

const TRUST = [
  { Icon: ShieldIcon, title: "Secure payments", sub: "UPI, cards & net banking via Cashfree" },
  { Icon: CashIcon, title: "Cash on delivery", sub: "Available across India" },
  { Icon: TruckIcon, title: "Ships in 24–48 hrs", sub: "Delivered in 3–7 business days" },
  { Icon: ReturnIcon, title: "Easy returns", sub: "2-day return or exchange" },
];

function firstImage(p) {
  if (Array.isArray(p.imageUrls) && p.imageUrls.length) return p.imageUrls[0];
  if (p.imageUrl) return p.imageUrl;
  const v = Array.isArray(p.variants) ? p.variants.find((x) => x?.imageUrls?.length) : null;
  return v ? v.imageUrls[0] : null;
}

export default function HeroBento({
  products,
  isModelPage,
  activeModel,
  showOffers,
  shopTargetId,
}) {
  // Three product shots fanned out in the main tile.
  const shots = products
    .filter((p) => p.isJewellery !== true)
    .map((p) => ({ id: p.id, name: p.name, src: firstImage(p) }))
    .filter((s) => s.src)
    .slice(0, 3);

  function scrollToShop() {
    document.getElementById(shopTargetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="bento" aria-label="Casewall highlights">
      {/* Main tile */}
      <div className="bento-tile bento-main">
        <div className="bento-main-copy">
          {isModelPage ? (
            <nav className="bento-kicker" aria-label="Breadcrumb">
              <Link to="/">Home</Link> / {activeModel} cases
            </nav>
          ) : (
            <p className="bento-kicker">Casewall collection</p>
          )}
          <h1 className="bento-title">
            {isModelPage ? (
              <>
                {activeModel} <span>Cases &amp; Covers</span>
              </>
            ) : (
              <>
                Phone cases <span>that actually look good.</span>
              </>
            )}
          </h1>
          <p className="bento-sub">
            {isModelPage
              ? `Back covers cut for the ${activeModel}'s camera and buttons. Cash on delivery, dispatched in 24–48 hrs.`
              : "Anti-yellow clears, bold prints and premium finishes — cut precisely for your phone."}
          </p>
          <button type="button" className="bento-cta" onClick={scrollToShop}>
            Shop the collection <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="bento-shots" aria-hidden="true">
          {shots.length > 0
            ? shots.map((s, i) => (
                <div key={s.id} className={`bento-shot bento-shot-${i}`}>
                  <img
                    {...responsiveImg(s.src, "(max-width: 640px) 40vw, 220px", 480)}
                    alt=""
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </div>
              ))
            : [0, 1, 2].map((i) => <div key={i} className={`bento-shot bento-shot-${i} bento-shot-empty`} />)}
        </div>
      </div>

      {/* Offers tile */}
      <div className="bento-tile bento-offer">
        {showOffers ? (
          <OfferCarousel />
        ) : (
          <div className="bento-offer-fallback">
            <span className="bento-kicker">Free shipping</span>
            <p className="bento-offer-big">On every order over ₹500</p>
          </div>
        )}
      </div>

      {/* WhatsApp community tile */}
      <a
        className="bento-tile bento-wa"
        href={WHATSAPP_COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Join the Casewall WhatsApp community"
      >
        <span className="bento-wa-bubbles" aria-hidden="true">
          <span className="bento-wa-bubble bento-wa-bubble-1">New drop 🔥</span>
          <span className="bento-wa-bubble bento-wa-bubble-2">Code inside 🎁</span>
        </span>
        <span className="bento-wa-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12.004 2c-5.514 0-9.997 4.478-9.997 9.997 0 1.762.464 3.484 1.345 4.997L2 22l5.144-1.342a9.96 9.96 0 004.86 1.238h.004c5.514 0 9.997-4.478 9.997-9.997 0-2.671-1.04-5.182-2.927-7.07A9.935 9.935 0 0012.004 2zm0 18.153a8.13 8.13 0 01-4.144-1.134l-.297-.176-3.054.797.815-2.978-.193-.306a8.14 8.14 0 01-1.256-4.36c0-4.501 3.66-8.161 8.162-8.161 2.18 0 4.229.85 5.77 2.393a8.106 8.106 0 012.39 5.775c-.003 4.502-3.663 8.15-8.193 8.15z" />
          </svg>
        </span>
        <span className="bento-wa-title">Join the Casewall community</span>
        <span className="bento-wa-sub">First dibs on drops &amp; member-only codes</span>
        <span className="bento-wa-link">
          Join on WhatsApp <span aria-hidden="true">→</span>
        </span>
      </a>

      {/* Free shipping tile */}
      <div className="bento-tile bento-ship">
        <svg className="bento-ship-route" viewBox="0 0 200 120" preserveAspectRatio="none" aria-hidden="true">
          <path d="M-10 95 C 40 95, 60 30, 110 40 S 170 20, 215 10" />
        </svg>
        <span className="bento-ship-pin" aria-hidden="true" />
        <span className="bento-ship-truck" aria-hidden="true">
          <TruckIcon size={20} />
        </span>
        <span className="bento-ship-kicker">Free shipping</span>
        <span className="bento-ship-num">
          <small>above</small> ₹500
        </span>
        <span className="bento-ship-label">Delivered free across India</span>
      </div>

      {/* Trust tiles */}
      {TRUST.map(({ Icon, title, sub }) => (
        <div key={title} className="bento-tile bento-trust">
          <span className="bento-trust-icon">
            <Icon size={20} />
          </span>
          <span>
            <strong>{title}</strong>
            <small>{sub}</small>
          </span>
        </div>
      ))}
    </section>
  );
}
