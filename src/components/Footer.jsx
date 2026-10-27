import { Link } from "react-router-dom";
import { STORE_NAME } from "../config";
import { LockIcon } from "./Icons";
import "../siteChrome.css";

const WHATSAPP_NUMBER = "919871335748"; // 9871335748 with country code
const AMAZON_URL = "https://www.amazon.in/dp/B0HHYF2RYZ";
const INSTAGRAM_URL = "https://www.instagram.com/thecasewall";

const POPULAR_MODELS = [
  ["iPhone 17 Pro Max", "/cases/iphone-17-pro-max"],
  ["iPhone 17 Pro", "/cases/iphone-17-pro"],
  ["iPhone 16", "/cases/iphone-16"],
  ["iPhone 15 Pro", "/cases/iphone-15-pro"],
  ["Samsung Galaxy S25 Ultra", "/cases/samsung-galaxy-s25-ultra"],
];

export default function Footer() {
  const helpLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi! I have a question about my order.")}`;

  return (
    <footer className="ft">
      <div className="ft-inner">
        <div className="ft-brand">
          <Link to="/" className="ft-logo">
            {STORE_NAME}
          </Link>
          <p>Phone cases and covers for iPhone and Samsung Galaxy, shipped across India.</p>
          <a className="ft-wa" href={helpLink} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon />
            Chat on WhatsApp
          </a>
          <p className="ft-contact">
            Call / WhatsApp: <a href="tel:+919871335748">+91 98713 35748</a>
            <br />
            Instagram:{" "}
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
              @thecasewall
            </a>
            <br />
            Also on{" "}
            <a href={AMAZON_URL} target="_blank" rel="noopener noreferrer">
              Amazon.in
            </a>
          </p>
        </div>

        <nav className="ft-col" aria-label="Shop">
          <p className="ft-title">Shop</p>
          <ul>
            <li>
              <Link to="/">All phone cases</Link>
            </li>
            {POPULAR_MODELS.map(([name, href]) => (
              <li key={href}>
                <Link to={href}>{name} cases</Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className="ft-col" aria-label="Help">
          <p className="ft-title">Help</p>
          <ul>
            <li>
              <Link to="/account">My account &amp; orders</Link>
            </li>
            <li>
              <Link to="/orderstatus">Track your order</Link>
            </li>
            <li>
              <Link to="/shipping-policy">Shipping policy</Link>
            </li>
            <li>
              <Link to="/returnPolicy">Returns &amp; refunds</Link>
            </li>
            <li>
              <Link to="/about">About &amp; contact</Link>
            </li>
          </ul>
        </nav>

        <div className="ft-col">
          <p className="ft-title">We accept</p>
          <ul className="ft-pay" aria-label="Payment methods">
            {["UPI", "Visa", "Mastercard", "RuPay", "Net banking", "Cash on delivery"].map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p className="ft-secure">
            <LockIcon size={16} /> Secure checkout by Razorpay
          </p>
        </div>
      </div>

      <div className="ft-bottom">
        <p>© {new Date().getFullYear()} Casewall, India. All rights reserved.</p>
        <ul>
          <li>
            <Link to="/privacy-policy">Privacy</Link>
          </li>
          <li>
            <Link to="/returnPolicy">Returns</Link>
          </li>
          <li>
            <Link to="/shipping-policy">Shipping</Link>
          </li>
        </ul>
      </div>
    </footer>
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
