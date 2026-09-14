// LiveViewerCount.jsx
import { useEffect, useState, useRef } from "react";

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function LiveViewerCount({ min = 1, max = 5 }) {
  const [count, setCount] = useState(() => randomBetween(min, max));
  const timeoutRef = useRef(null);

  useEffect(() => {
    function scheduleNext() {
      const delay = randomBetween(10, 20) * 1000; // 10-20 sec
      timeoutRef.current = setTimeout(() => {
        setCount((prev) => {
          // step up or down by 1, staying within [min, max]
          const direction = Math.random() < 0.5 ? -1 : 1;
          let next = prev + direction;
          if (next < min) next = min + 1 <= max ? min + 1 : min;
          if (next > max) next = max - 1 >= min ? max - 1 : max;
          // avoid getting stuck if next === prev
          if (next === prev) {
            next = prev === max ? prev - 1 : prev + 1;
          }
          return next;
        });
        scheduleNext();
      }, delay);
    }

    scheduleNext();
    return () => clearTimeout(timeoutRef.current);
  }, [min, max]);

  return (
    <div
      className="live-viewer-count"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        color: "#555",
      }}
      aria-live="polite"
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#22c55e",
          display: "inline-block",
          animation: "live-pulse 1.5s infinite",
        }}
      />
      <span>
        {count} {count === 1 ? "person is" : "people are"} viewing this right now
      </span>
      <style>{`
        @keyframes live-pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}