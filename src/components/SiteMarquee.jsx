export default function SiteMarquee() {
  const items = [
    {
      key: "instagram",
      content: (
        <>
          📸 Follow us on Instagram <span aria-hidden>@thecasewall</span>
        </>
      ),
      href: "https://www.instagram.com/thecasewall/",
    },
    {
      key: "amazon",
      content: <>Now available on Amazon — shop now</>,
      href: "https://www.amazon.in/dp/B0HHYF2RYZ",
    },
    {
      key: "delivery",
      content: <>NOTICE: Free Delivery on all orders above ₹350.</>,
      href: null,
    },
  ];

  return (
    <div className="site-marquee" role="status" aria-live="polite">
      <div className="site-marquee-inner">
        <div className="site-marquee-track">
          {items.map((item, index) => {
            const isFirst = index === 0;
            const body = item.href ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="site-marquee-link"
              >
                {item.content}
              </a>
            ) : (
              item.content
            );

            return (
              <span
                key={item.key}
                className="site-marquee-text"
                aria-hidden={isFirst ? undefined : true}
              >
                {body}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}