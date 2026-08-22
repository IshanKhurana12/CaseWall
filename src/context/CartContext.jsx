import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "casewall_cart_v2"; // bumped: v1 items lack variantId and would be stale

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cartKey(productId, variantId) {
  return `${productId}::${variantId || "_legacy"}`;
}

// NOTE: prices shown here are for display only. The real price used for
// payment is always re-fetched from Firestore on the server when the order
// is created — the cart/localStorage is never trusted for the amount charged.
export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // storage may be unavailable (private browsing etc.) — fail silently
    }
  }, [items]);

  // `product` = the parent product doc ({ id, name, currency, ... })
  // `variant` = the specific variant ({ id, model, color, price, stock, imageUrls, ... })
  //             — for old flat products with no variants subcollection, pass
  //             { id: "_legacy", model: product.model, color: null, price: product.price, imageUrls: product.imageUrls }
  function addItem(product, variant, qty = 1) {
    const key = cartKey(product.id, variant.id);
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) => (i.key === key ? { ...i, qty: i.qty + qty } : i));
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          variantId: variant.id,
          name: product.name,
          model: variant.model,
          color: variant.color || null,
          price: variant.price,
          currency: product.currency || "INR",
          image:
            (Array.isArray(variant.imageUrls) && variant.imageUrls[0]) ||
            (Array.isArray(product.imageUrls) && product.imageUrls[0]) ||
            product.imageUrl,
          qty,
        },
      ];
    });
  }

  function removeItem(productId, variantId) {
    const key = cartKey(productId, variantId);
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateQty(productId, variantId, qty) {
    const key = cartKey(productId, variantId);
    if (qty <= 0) return removeItem(productId, variantId);
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, qty } : i)));
  }

  function clearCart() {
    setItems([]);
  }

  const count = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + (Number(i.price) || 0) * i.qty, 0),
    [items]
  );

  const value = { items, addItem, removeItem, updateQty, clearCart, count, subtotal };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside a CartProvider");
  return ctx;
}