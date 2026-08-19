import "../policy.css";
import Footer from "./Footer";

const WHATSAPP_NUMBER = "919990111311"; // 9990111311 with country code
const CALL_NUMBER = "9871335748";

export default function ReturnPolicy() {
  const returnStartLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "Hi! I'd like to start a return/exchange for my order. Order #: "
  )}`;

  return (
    <div className="policy-page">
      <div className="policy-hero">

<a
  className="policy-back"
  href="#"
  onClick={(e) => {
    e.preventDefault()
    window.history.back()
  }}
>
  ← Back
</a>

        <p className="policy-eyebrow">Policies</p>
        <h1>Return &amp; Refund Policy</h1>
        <p className="policy-intro">
          We want you to love your cover. If something's not right, here's
          exactly how returns and exchanges work.
        </p>
        <div className="policy-highlight">
          <span className="dot" />
          2-day return / exchange window
        </div>
      </div>

      <div className="policy-body">
        <div className="policy-cta">
          <div>
            <h3>Start your return</h3>
            <p>Message us on WhatsApp and we'll take it from there.</p>
          </div>
          <a
            className="wa-button wa-button-primary"
            href={returnStartLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon />
            Click here to start
          </a>
        </div>

        <section className="policy-section">
          <h2>How it works</h2>
          <ul>
            <li>
              We offer a <strong>2-day return/exchange policy</strong> from
              the date of delivery.
            </li>
            <li>
              A flat <strong>₹100 processing fee</strong> applies to all
              returns and exchanges — this covers reverse pickup and
              handling.
            </li>
            <li>
              Products must be <strong>unused, undamaged</strong>, and in
              their <strong>original packaging</strong>.
            </li>
            <li>
              No returns, exchanges, or refunds are accepted{" "}
              <strong>after 2 days</strong> of delivery.
            </li>
             <li>
             Taxes and Shipping is non Refundable.
            </li>
            <li>
              We don't offer cash or bank refunds. Refunds are issued only as{" "}
              <strong>store credit</strong>, valid for{" "}
              <strong>1 year</strong> and usable on any future order.
            </li>
            <li>
              Once we receive and quality-check the returned product, your
              store credit or exchange is processed as usual.
            </li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Received a damaged or wrong product?</h2>
          <p>
            Share an unboxing video (unedited raw video) within{" "}
            <strong>24 hours of delivery</strong> we will check it if the mistake is ours or its damaged in transit then we'll send a free
            replacement — no processing fee applies in this case.
          </p>
        </section>

        <section className="policy-section">
          <h2>Will my return/exchange be rejected?</h2>
          <p>
            Your return will be rejected if the item is missing its original
            packaging (box, tags, inserts) or shows clear signs of use or
            wear.
          </p>
        </section>

        <section className="policy-section">
          <h2>Can I cancel my order after it's placed?</h2>
          <p>Orders cannot be canceled once placed.</p>
        </section>

        <section className="policy-section">
          <h2>Non-serviceable pincodes</h2>
          <p>
            If your pincode isn't serviceable for reverse pickup, you'll need
            to courier the product(s) to our address at your own cost. We'll
            share this address with you personally if this applies to your
            order.
          </p>
          <p className="policy-contact-line">
            Questions? Call us at{" "}
            <a href={`tel:+91${CALL_NUMBER}`}>{CALL_NUMBER}</a>
          </p>
        </section>

        <div className="policy-note">
          <strong>Please note:</strong> this policy does not cover misuse,
          accidental damage, or any abuse of the purchased product.
        </div>
      </div>

      <Footer />
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12.004 2c-5.514 0-9.997 4.478-9.997 9.997 0 1.762.464 3.484 1.345 4.997L2 22l5.144-1.342a9.96 9.96 0 004.86 1.238h.004c5.514 0 9.997-4.478 9.997-9.997 0-2.671-1.04-5.182-2.927-7.07A9.935 9.935 0 0012.004 2zm0 18.153a8.13 8.13 0 01-4.144-1.134l-.297-.176-3.054.797.815-2.978-.193-.306a8.14 8.14 0 01-1.256-4.36c0-4.501 3.66-8.161 8.162-8.161 2.18 0 4.229.85 5.77 2.393a8.106 8.106 0 012.39 5.775c-.003 4.502-3.663 8.15-8.193 8.15z" />
    </svg>
  );
}