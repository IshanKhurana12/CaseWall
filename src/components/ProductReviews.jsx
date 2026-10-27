import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import SignInButton from "./SignInButton";
import { CheckIcon } from "./Icons";
import { responsiveImg } from "../lib/images";
import "../siteChrome.css";

const MIN_TEXT = 10;
const MAX_TEXT = 1000;

function Stars({ value, size = 16 }) {
  const v = Math.round(Number(value) || 0);
  return (
    <span className="stars" style={{ fontSize: size }} role="img" aria-label={`${v} out of 5 stars`}>
      {"★★★★★".slice(0, v)}
      <span className="stars-empty">{"★★★★★".slice(v)}</span>
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// Reviews list + summary + the write-a-review flow. Writing requires Google
// sign-in AND a paid/shipped/delivered order containing this product — both
// enforced by /api/reviews; the UI just explains where the customer stands.
export default function ProductReviews({ product, reviews, loading, onSubmitted }) {
  const { user, ready, authFetch } = useAuth();
  const [eligibility, setEligibility] = useState(null); // null | { canReview, review }
  const [eligError, setEligError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState(false);
  const [activeImage, setActiveImage] = useState(null);

  // When signed in, ask the server whether this customer bought the product.
  useEffect(() => {
    setEligibility(null);
    setEligError("");
    setFormOpen(false);
    if (!user) return;
    let cancelled = false;
    authFetch(`/api/reviews?productId=${encodeURIComponent(product.id)}`)
      .then((d) => !cancelled && setEligibility(d))
      .catch((e) => !cancelled && setEligError(e.message));
    return () => {
      cancelled = true;
    };
  }, [user, product.id, authFetch]);

  function openForm() {
    const mine = eligibility?.review;
    setRating(mine?.rating || 0);
    setText(mine?.text || "");
    setError("");
    setThanks(false);
    setFormOpen(true);
  }

  async function submit(e) {
    e.preventDefault();
    if (!rating) return setError("Please choose a star rating.");
    if (text.trim().length < MIN_TEXT) return setError(`Please write at least ${MIN_TEXT} characters.`);
    setBusy(true);
    setError("");
    try {
      const { review } = await authFetch("/api/reviews", {
        method: "POST",
        body: { productId: product.id, rating, text: text.trim() },
      });
      setEligibility((el) => ({ ...el, review }));
      setFormOpen(false);
      setThanks(true);
      onSubmitted?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const rated = reviews.filter((r) => r.rating);
  const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: rated.filter((r) => r.rating === n).length }));

  return (
    <section className="rv" id="reviews" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="rv-title">
        Customer reviews
      </h2>

      <div className="rv-top">
        <div className="rv-summary card-panel">
          {rated.length ? (
            <>
              <div className="rv-avg">
                <strong>{avg.toFixed(1)}</strong>
                <div>
                  <Stars value={avg} size={20} />
                  <p className="muted">
                    Based on {rated.length} review{rated.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <ul className="rv-dist">
                {dist.map(({ n, count }) => (
                  <li key={n}>
                    <span>{n}★</span>
                    <span className="rv-bar">
                      <span style={{ width: `${rated.length ? (count / rated.length) * 100 : 0}%` }} />
                    </span>
                    <span className="muted">{count}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="muted rv-none">
              {loading
                ? "Loading reviews…"
                : reviews.length
                ? `${reviews.length} review${reviews.length === 1 ? "" : "s"} from verified buyers. Bought this? Add your rating.`
                : "No reviews yet. Bought this? Be the first to review it."}
            </p>
          )}
        </div>

        <div className="rv-cta card-panel">
          <p className="rv-cta-title">Share your thoughts</p>
          {!ready ? null : !user ? (
            <>
              <p className="muted">Reviews are only from verified buyers. Sign in with the Google account you ordered with.</p>
              <SignInButton label="Sign in to write a review" />
            </>
          ) : eligError ? (
            <p className="form-error">{eligError}</p>
          ) : !eligibility ? (
            <p className="muted">Checking your orders…</p>
          ) : !eligibility.canReview ? (
            <p className="muted">
              You can review this product once you've bought it. Reviews are open to customers with a confirmed order for
              this item.
            </p>
          ) : formOpen ? null : (
            <>
              <p className="muted">
                <CheckIcon size={14} /> You bought this item.{" "}
                {eligibility.review ? "You can update your review anytime." : "Tell other shoppers what you think."}
              </p>
              <button type="button" className="btn btn-primary" onClick={openForm}>
                {eligibility.review ? "Edit your review" : "Write a review"}
              </button>
            </>
          )}
          {thanks && <p className="rv-thanks">Thanks! Your review is now live.</p>}
        </div>
      </div>

      {formOpen && (
        <form className="rv-form card-panel" onSubmit={submit}>
          <p className="panel-title">{eligibility?.review ? "Edit your review" : "Write a review"}</p>
          <div className="field">
            <span className="field-label" id="rv-rating-label">
              Your rating
            </span>
            <div className="rv-star-input" role="radiogroup" aria-labelledby="rv-rating-label" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  className={(hover || rating) >= n ? "on" : ""}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="rv-text">Your review</label>
            <textarea
              id="rv-text"
              rows={5}
              maxLength={MAX_TEXT}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="How's the fit, quality and finish? Would you recommend it?"
            />
            <span className="rv-count muted">
              {text.trim().length}/{MAX_TEXT}
            </span>
          </div>
          <p className="muted rv-public-note">
            Your review will appear as <strong>{publicNamePreview(user?.displayName)}</strong> with a “Verified purchase” badge.
          </p>
          {error && <p className="form-error">{error}</p>}
          <div className="btn-row">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Posting…" : "Post review"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {reviews.length > 0 && (
        <ul className="rv-list">
          {reviews.map((r) => (
            <li key={r.id} className="rv-card card-panel">
              <div className="rv-card-head">
                <span className="rv-avatar" aria-hidden="true">
                  {(r.name || "?")[0].toUpperCase()}
                </span>
                <div>
                  <p className="rv-name">{r.name}</p>
                  <p className="rv-meta">
                    {r.verifiedPurchase && (
                      <span className="rv-verified">
                        <CheckIcon size={12} /> Verified purchase
                      </span>
                    )}
                    {r.date && <span className="muted">{formatDate(r.date)}</span>}
                  </p>
                </div>
              </div>
              {r.rating && <Stars value={r.rating} />}
              {r.text && <p className="rv-text">{r.text}</p>}
              {r.images.length > 0 && (
                <div className="rv-images">
                  {r.images.map((src, i) => (
                    <button key={i} type="button" onClick={() => setActiveImage(src)} aria-label="View review photo">
                      <img {...responsiveImg(src, "96px", 320)} alt="" loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {activeImage && (
        <div className="pp-review-lightbox" onClick={() => setActiveImage(null)}>
          <img {...responsiveImg(activeImage, "100vw")} alt="Review" decoding="async" />
        </div>
      )}
    </section>
  );
}

// Mirrors publicName() in api/reviews.js.
function publicNamePreview(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Verified buyer";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}
