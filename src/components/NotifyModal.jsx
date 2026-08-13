import React, { useEffect } from "react";

// Non-blocking toast notification. Auto-dismisses after `duration` ms.
export default function NotifyModal({ message, onClose, duration = 4000 }) {
  useEffect(() => {
    if (!message) return;
    if (!onClose) return;
    const t = setTimeout(() => onClose(), duration);
    return () => clearTimeout(t);
  }, [message, onClose, duration]);

  if (!message) return null;

  return (
    <div className="notify-toast-container" aria-live="polite">
      <div className="notify-toast">
        <div className="notify-toast-icon">⚠️</div>
        <div className="notify-toast-message">{message}</div>
        <button className="notify-toast-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
    </div>
  );
}
