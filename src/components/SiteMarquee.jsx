export default function SiteMarquee() {
  return (
    <div className="site-marquee" role="status" aria-live="polite">
      <div className="site-marquee-inner">
        <div className="site-marquee-track">
          <span className="site-marquee-text">
            NOTICE: Razorpay payments are currently in test mode — online
            payments are not accepted. Only WhatsApp orders will be
            considered. Please place orders via WhatsApp.
          </span>
          <span className="site-marquee-text" aria-hidden>
            NOTICE: Razorpay payments are currently in test mode — online
            payments are not accepted. Only WhatsApp orders will be
            considered. Please place orders via WhatsApp.
          </span>
        </div>
      </div>
    </div>
  );
}
