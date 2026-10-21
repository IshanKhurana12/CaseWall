import { useState } from "react";
import { FAQS } from "./faqs";

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
      <div className="faq-answer-wrap" style={{ maxHeight: isOpen ? "400px" : "0px" }}>
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
