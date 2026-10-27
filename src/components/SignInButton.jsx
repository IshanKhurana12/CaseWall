import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { GoogleIcon } from "./Icons";
import "../siteChrome.css";

export default function SignInButton({ label = "Continue with Google", onSignedIn }) {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    setBusy(true);
    try {
      const u = await signIn();
      if (u && onSignedIn) onSignedIn(u);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="google-signin">
      <button type="button" className="google-btn" onClick={handleClick} disabled={busy}>
        <GoogleIcon />
        {busy ? "Signing in…" : label}
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
