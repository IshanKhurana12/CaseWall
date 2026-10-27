import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { SHIPPING_FREE_THRESHOLD_RUPEES, STORE_NAME } from "../config";
import { CartIcon, PackageIcon, SearchIcon, UserIcon } from "./Icons";
import "../siteChrome.css";

// One header for every page: announcement bar, logo, search, track order,
// account (Google sign-in) and cart.
export default function SiteHeader() {
  const { count } = useCart();
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [term, setTerm] = useState(params.get("q") || "");

  // Keep the box in sync when the catalog clears its own search.
  useEffect(() => {
    setTerm(location.pathname === "/" ? params.get("q") || "" : "");
  }, [location.pathname, params]);

  function submit(e) {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  const firstName = user?.displayName?.split(" ")[0];

  return (
    <>
      <div className="sh-announce">
        <span>Free delivery over ₹{SHIPPING_FREE_THRESHOLD_RUPEES}</span>
        <span className="sh-announce-dot" aria-hidden="true" />
        <span>Cash on delivery</span>
        <span className="sh-announce-dot sh-hide-sm" aria-hidden="true" />
        <span className="sh-hide-sm">Easy 2-day returns</span>
      </div>
      <header className="sh-header">
        <div className="sh-inner">
          <Link to="/" className="sh-logo">
            <span className="sh-logo-mark" aria-hidden="true">CW</span>
            <span className="sh-logo-text">{STORE_NAME}</span>
          </Link>

          <form className="sh-search" role="search" onSubmit={submit}>
            <SearchIcon size={18} />
            <input
              type="search"
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
                // On the homepage, filter the catalog live as you type.
                if (location.pathname === "/") {
                  const q = e.target.value;
                  navigate(q.trim() ? `/?q=${encodeURIComponent(q)}` : "/", { replace: true });
                }
              }}
              placeholder="Search cases, e.g. iPhone 15 Pro"
              aria-label="Search products"
            />
          </form>

          <nav className="sh-actions" aria-label="Account and cart">
            <Link to="/orderstatus" className="sh-action sh-hide-sm">
              <PackageIcon size={20} />
              <span>Track order</span>
            </Link>
            <Link to="/account" className="sh-action" aria-label={user ? firstName || "Account" : ready ? "Sign in" : "Account"}>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="sh-avatar" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={20} />
              )}
              <span className="sh-hide-sm">{user ? firstName || "Account" : ready ? "Sign in" : "Account"}</span>
            </Link>
            <Link to="/cart" className="sh-action sh-cart" aria-label={count > 0 ? `Cart ${count} items` : "Cart"}>
              <CartIcon size={20} />
              <span className="sh-hide-sm">Cart</span>
              {count > 0 && (
                <span className="sh-badge" aria-hidden="true">
                  {count}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
