export default function SiteMarquee() {
  return (
    <div className="site-marquee" role="status" aria-live="polite">
      <div className="site-marquee-inner">
        <div className="site-marquee-track">
          <span className="site-marquee-text">
            NOTICE: Free Delivery on all orders above ₹699.
          </span>
          <span className="site-marquee-text" aria-hidden>
             Free Delivery on all orders above ₹699.
          </span>
            <span className="site-marquee-text" aria-hidden>
             Free Delivery on all orders above ₹699.
          </span>
           <span className="site-marquee-text" aria-hidden>
             Free Delivery on all orders above ₹699.
          </span>
           <span className="site-marquee-text" aria-hidden>
            Free Delivery on all orders above ₹699.
          </span>
           <span className="site-marquee-text" aria-hidden>
            Free Delivery on all orders above ₹699.
          </span>
        </div>
      </div>
    </div>
  );
}
