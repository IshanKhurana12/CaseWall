import { CashIcon, ReturnIcon, ShieldIcon, TruckIcon } from "./Icons";
import "../siteChrome.css";

const ITEMS = [
  { Icon: ShieldIcon, title: "Secure payments", sub: "UPI, cards & net banking via Razorpay" },
  { Icon: CashIcon, title: "Cash on delivery", sub: "Available across India" },
  { Icon: TruckIcon, title: "Ships in 24–48 hrs", sub: "Delivered in 3–7 business days" },
  { Icon: ReturnIcon, title: "Easy returns", sub: "2-day return or exchange" },
];

export default function TrustBar({ compact = false }) {
  return (
    <ul className={"trust-bar" + (compact ? " trust-bar-compact" : "")} aria-label="Why shop with us">
      {ITEMS.map(({ Icon, title, sub }) => (
        <li key={title}>
          <span className="trust-bar-icon">
            <Icon size={compact ? 18 : 22} />
          </span>
          <span>
            <strong>{title}</strong>
            <small>{sub}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
