import { useState } from "react";

const FAQS = [
  {
    q: "How do I pay for my order?",
    a: "Payment is made through UPI. Once you confirm your order on WhatsApp, I'll send you a QR code — scan it to complete the payment.",
  },
  {
    q: "What happens after I pay?",
    a: "As soon as the payment is confirmed, I set up delivery within 24 hours.",
  },
  {
    q: "Is delivery free?",
    a: "Delivery is free for Delhi addresses. For other locations, delivery is chargeable — I'll tell you the exact cost on WhatsApp before you pay, and it'll be added to your total.",
  },
];

function FAQItem({ item, isOpen, onToggle }) {
  return (
    <div className={"faq-item" + (isOpen ? " faq-item-open" : "")}>
      <button
        className="faq-question"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="faq-question-peg" aria-hidden="true" />
        <span className="faq-question-text">{item.q}</span>
        <span className="faq-question-icon" aria-hidden="true">
          {isOpen ? "–" : "+"}
        </span>
      </button>
      <div className="faq-answer-wrap" style={{ maxHeight: isOpen ? "240px" : "0px" }}>
        <p className="faq-answer">{item.a}</p>
      </div>
    </div>
  );
}

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="faq-section" aria-labelledby="faq-heading">
      <p className="faq-eyebrow">Before you order</p>
      <h2 className="faq-title" id="faq-heading">
        Questions, answered
      </h2>

      <div className="faq-list">
        {FAQS.map((item, i) => (
          <FAQItem
            key={item.q}
            item={item}
            isOpen={openIndex === i}
            onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
          />
        ))}
      </div>
    </section>
  );
}
