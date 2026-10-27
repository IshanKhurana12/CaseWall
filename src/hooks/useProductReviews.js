import { useCallback, useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore/lite";
import { db } from "../firebase";

// Reviews written on the site (reviews collection, verified purchases only)
// plus older reviews stored on the product doc that were marked verified.
// Returns { reviews, loading, reload } — newest first.
export default function useProductReviews(product) {
  const productId = product?.id;
  const [live, setLive] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!productId) return;
    try {
      const snap = await getDocs(
        query(collection(db, "reviews"), where("productId", "==", productId), where("status", "==", "published"))
      );
      setLive(
        snap.docs.map((d) => {
          const r = d.data();
          return {
            id: d.id,
            name: r.name || "Verified buyer",
            rating: Number(r.rating) || null,
            text: r.text || "",
            images: [],
            verifiedPurchase: true,
            date: r.updatedAt || r.createdAt || null,
          };
        })
      );
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    setLoading(true);
    setLive([]);
    reload();
  }, [reload]);

  const legacy = legacyReviews(product?.reviews);
  const reviews = [...live].sort((a, b) => String(b.date).localeCompare(String(a.date))).concat(legacy);
  return { reviews, loading, reload };
}

// Older reviews were added by hand to products/{id}.reviews (strings or
// objects). Only ones marked verified are shown, as before.
function legacyReviews(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object" && r.verified && (r.text || (r.images || []).length))
    .map((r, i) => ({
      id: `legacy-${i}`,
      name: r.name || "Verified buyer",
      rating: Number(r.rating) >= 1 ? Math.min(5, Math.round(Number(r.rating))) : null,
      text: r.text || "",
      images: Array.isArray(r.images) ? r.images : [],
      verifiedPurchase: true,
      date: null,
    }));
}
