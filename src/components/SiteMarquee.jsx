export default function SiteMarquee() {
  return (
    <div className="site-marquee" role="status" aria-live="polite">
      <div className="site-marquee-inner">
        <div className="site-marquee-track">
          <span className="site-marquee-text">
            NOTICE: Free Delivery on all orders above ₹500.
          </span>
          <span className="site-marquee-text" aria-hidden>
            NOTICE: Free Delivery on all orders above ₹500.
          </span>
            <span className="site-marquee-text" aria-hidden>
            NOTICE: Free Delivery on all orders above ₹500.
          </span>
        </div>
      </div>
    </div>
  );
}
