import { useEffect, useState } from "react";

export const HERO_OFFERS = [
  {
    eyebrow: "Anti-yellow cover offer",
    title: "Buy 2, pay ₹350",
    code: "BUY2",
    detail: "Use this code on eligible anti-yellow covers.",
  },
  {
    eyebrow: "Anti-yellow cover offer",
    title: "Buy 3, pay ₹500",
    code: "BUY3",
    detail: "Use this code on eligible anti-yellow covers.",
  },
  {
    eyebrow: "50 off on purchase of ₹1,200",
    title: "Spend ₹1,200 or more",
    code: "GET50OFF",
    detail: "Get ₹50 off when your order reaches ₹1,200.",
  },
  {
    eyebrow: "Limited order offer",
    title: "₹150 off at ₹1,600",
    code: "150OFF",
    detail: "Save ₹150 when your order reaches ₹1,600.",
  },
];

export default function OfferCarousel({ compact = false }) {
  const [activeOffer, setActiveOffer] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveOffer((current) => (current + 1) % HERO_OFFERS.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const offer = HERO_OFFERS[activeOffer];

  return (
    <div className={`hero-offer discount-carousel${compact ? " discount-carousel-compact" : ""}`} aria-live="polite">
      <span className="hero-offer-kicker">{offer.eyebrow}</span>
      <h2 className="hero-offer-title">{offer.title}</h2>
      <span className="hero-offer-code">Use code {offer.code}</span>
      <p className="hero-offer-detail">{offer.detail}</p>
      <div className="hero-offer-dots" aria-label="Choose an offer">
        {HERO_OFFERS.map((item, index) => (
          <button
            key={item.code}
            type="button"
            className={index === activeOffer ? "hero-offer-dot hero-offer-dot-active" : "hero-offer-dot"}
            onClick={() => setActiveOffer(index)}
            aria-label={`Show offer ${index + 1}`}
            aria-pressed={index === activeOffer}
          />
        ))}
      </div>
    </div>
  );
}