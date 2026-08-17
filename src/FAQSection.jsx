import { useState } from "react";

const FAQS = [
  {
    q: "How do I pay for my order?",
    a: "Payment is made through razorpay, you can pay using upi netbanking or by card. Once you pay you will recive a mail with a order id ,you can use that order id,phone or email in order status to know your order status",
  },
  {
    q: "What happens after I pay?",
    a: "As soon as the payment is confirmed, We set up delivery within 24-48 hours.",
  },
  {
    q: "Is delivery free?",
    a: "Delivery is free for Orders above 500. For other Orders, delivery is chargeable",
  },
  {
    q: "What's your refund and return policy?",
    a: "Refer to the return & refund policy link below",
  },
  {
    q:"How I can track the orders?",
    a:"You can track your order by using the order id,phone or email in the order status page and once the shipment is made from our end you will recive mail and whatsapp update or you can check the status of the order with a tracking link.",
  }
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
    <section className="faq-section" id="faq" aria-labelledby="faq-heading">
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
