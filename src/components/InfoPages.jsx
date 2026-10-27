import { Link } from "react-router-dom";
import "../policy.css";
import Footer from "./Footer";
import useSeo from "../hooks/useSeo";
import { BRAND, INSTAGRAM_URL, WHATSAPP_URL } from "../lib/seo";
import {
  SHIPPING_FREE_THRESHOLD_RUPEES,
  SHIPPING_RATE_RUPEES,
} from "../config";

const CALL_NUMBER = "9871335748";

function PolicyShell({ eyebrow, title, intro, children }) {
  return (
    <div className="policy-page">
      <div className="policy-hero">
        <Link className="policy-back" to="/">
          ← Back to shop
        </Link>
        <p className="policy-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="policy-intro">{intro}</p>
      </div>
      <div className="policy-body">{children}</div>
      <Footer />
    </div>
  );
}

export function AboutPage() {
  useSeo({
    title: `About ${BRAND} – Contact & Customer Support`,
    description: `Who we are, how to reach ${BRAND} on WhatsApp, phone and Instagram, and how we ship phone cases across India.`,
    path: "/about",
  });

  return (
    <PolicyShell
      eyebrow="About us"
      title={`About ${BRAND}`}
      intro="An Indian online store for phone cases people actually love — picked, packed and shipped by a small team that answers its own WhatsApp."
    >
      <section className="policy-section">
        <h2>Who we are</h2>
        <p>
          {BRAND} sells designer back covers and cases for iPhone and Samsung Galaxy phones.
          Every order is checked and packed by us before it ships, and we post real photos and
          reels of our products on{" "}
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            Instagram @thecasewall
          </a>{" "}
          so you can see exactly what you're getting.
        </p>
      </section>

      <section className="policy-section">
        <h2>Contact us</h2>
        <ul>
          <li>
            <strong>WhatsApp (fastest):</strong>{" "}
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              +91 98713 35748
            </a>
          </li>
          <li>
            <strong>Phone:</strong> <a href={`tel:+91${CALL_NUMBER}`}>+91 98713 35748</a>
          </li>
          <li>
            <strong>Instagram:</strong>{" "}
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              @thecasewall
            </a>
          </li>
          <li>
            <strong>Track an order:</strong> <Link to="/orderstatus">Order status page</Link>
          </li>
        </ul>
      </section>

      <section className="policy-section">
        <h2>Why shop with us</h2>
        <ul>
          <li>
            <strong>Secure payments</strong> through Razorpay — UPI, cards and net banking. We
            never see or store your card details.
          </li>
          <li>
            <strong>Cash on delivery</strong> available across India.
          </li>
          <li>
            <strong>Fast dispatch</strong> within 24–48 hours, with a tracking link on email and
            WhatsApp.
          </li>
          <li>
            <strong>Damaged on arrival?</strong> Send an unboxing video within 24 hours and we
            replace it free. See our <Link to="/returnPolicy">return policy</Link>.
          </li>
        </ul>
      </section>
    </PolicyShell>
  );
}

export function ShippingPolicyPage() {
  useSeo({
    title: `Shipping Policy | ${BRAND}`,
    description: `Dispatch in 24–48 hrs, delivery in 3–7 business days across India, free shipping over ₹${SHIPPING_FREE_THRESHOLD_RUPEES}, cash on delivery available.`,
    path: "/shipping-policy",
  });

  return (
    <PolicyShell
      eyebrow="Policies"
      title="Shipping Policy"
      intro="Where we ship, how long it takes, and what it costs."
    >
      <section className="policy-section">
        <h2>Delivery time</h2>
        <ul>
          <li>Orders are dispatched within <strong>24–48 hours</strong> of payment.</li>
          <li>
            Delivery usually takes <strong>3–7 business days</strong> depending on your pincode.
          </li>
          <li>We ship to serviceable pincodes across India through trusted courier partners.</li>
        </ul>
      </section>

      <section className="policy-section">
        <h2>Shipping charges</h2>
        <ul>
          <li>
            <strong>Free shipping</strong> on orders of ₹{SHIPPING_FREE_THRESHOLD_RUPEES} and
            above.
          </li>
          <li>
            A flat <strong>₹{SHIPPING_RATE_RUPEES}</strong> delivery charge applies to orders
            below ₹{SHIPPING_FREE_THRESHOLD_RUPEES}.
          </li>
        </ul>
      </section>

      <section className="policy-section">
        <h2>Cash on delivery</h2>
        <p>
          COD is available. A ₹50 COD handling fee is paid online to confirm the order, and the
          full order amount is paid in cash to the delivery partner on delivery.
        </p>
      </section>

      <section className="policy-section">
        <h2>Tracking</h2>
        <p>
          Once your order ships we send a tracking link on email and WhatsApp. You can also check
          anytime in <Link to="/account">My Account</Link> (sign in with Google) or on the{" "}
          <Link to="/orderstatus">order status page</Link> using your order ID.
        </p>
      </section>
    </PolicyShell>
  );
}

export function PrivacyPolicyPage() {
  useSeo({
    title: `Privacy Policy | ${BRAND}`,
    description: `How ${BRAND} collects, uses and protects your personal information when you shop with us.`,
    path: "/privacy-policy",
  });

  return (
    <PolicyShell
      eyebrow="Policies"
      title="Privacy Policy"
      intro="What we collect when you order, why we need it, and who we share it with."
    >
      <section className="policy-section">
        <h2>What we collect</h2>
        <p>
          When you place an order we collect your name, phone number, email and delivery address.
          We use this only to process, ship and support your order.
        </p>
      </section>

      <section className="policy-section">
        <h2>Payments</h2>
        <p>
          Online payments are processed by Razorpay. Your card, UPI and bank details go directly
          to Razorpay — {BRAND} never sees or stores them.
        </p>
      </section>

      <section className="policy-section">
        <h2>Who we share it with</h2>
        <ul>
          <li>Our courier partners, to deliver your order (name, phone and address).</li>
          <li>Razorpay, to process your payment.</li>
          <li>
            Our hosting, database and email providers, which store and send order information on
            our behalf.
          </li>
        </ul>
        <p>We do not sell your personal information to anyone.</p>
      </section>

      <section className="policy-section">
        <h2>Analytics</h2>
        <p>
          We use privacy-friendly analytics to count page visits. It does not use cookies to
          track you across other websites.
        </p>
      </section>

      <section className="policy-section">
        <h2>Your choices</h2>
        <p>
          To see, correct or delete the information we hold about you, message us on{" "}
          <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>{" "}
          or call <a href={`tel:+91${CALL_NUMBER}`}>+91 98713 35748</a>.
        </p>
      </section>
    </PolicyShell>
  );
}
