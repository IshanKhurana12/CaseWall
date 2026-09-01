export function normalizeCategoryValue(raw) {
  if (raw === null || raw === undefined) return "";
  const value = String(raw).trim();
  if (!value) return "";
  return value.toLowerCase();
}

export function getProductCategoryValues(product = {}) {
  const values = [];

  if (Array.isArray(product.categories)) {
    for (const item of product.categories) {
      const normalized = normalizeCategoryValue(item);
      if (normalized) values.push(normalized);
    }
  }

  const fallback = normalizeCategoryValue(product.category ?? product.cat);
  if (fallback) values.push(fallback);

  return [...new Set(values)];
}

export function getCategoryLabel(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "Featured";

  const normalized = value.toLowerCase();
  const labelOverrides = {
    under120: "Under ₹120",
    under_120: "Under ₹120",
    "under 120": "Under ₹120",
    featured: "Featured",
    trending: "Trending",
    premium: "Premium",
  };

  if (labelOverrides[normalized]) {
    return labelOverrides[normalized];
  }

  const numeric = normalized.match(/^(\d+(?:\.\d+)?)$/);
  if (numeric) {
    return `Under ₹${Number(numeric[1]).toLocaleString("en-IN")}`;
  }

  const buyMatch = normalized.match(/buy\s*(\d+)\s*(?:for|x)?\s*₹?\s*(\d+)/i);
  if (buyMatch) {
    return `Buy ${buyMatch[1]} for ₹${Number(buyMatch[2]).toLocaleString("en-IN")}`;
  }

  const forMatch = normalized.match(/for\s*₹?\s*(\d+)/i);
  if (forMatch) {
    return `For ₹${Number(forMatch[1]).toLocaleString("en-IN")}`;
  }

  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function matchesCategoryValue(product, desired) {
  const target = normalizeCategoryValue(desired);
  if (!target) return true;
  const values = getProductCategoryValues(product);
  return values.includes(target);
}

export function getDiscountForCart({ items = [], products = [], discount = null }) {
  if (!discount) {
    return { valid: false, reason: "Coupon was not found." };
  }

  if (discount.active === false) {
    return { valid: false, reason: "This coupon is no longer active." };
  }

  const code = String(discount.code || "").trim().toUpperCase();
  const category = normalizeCategoryValue(
    discount.category || discount.productCategory || discount.matchCategory || discount.ruleCategory || ""
  );
  const rawBuyQty = Number(discount.buyQty ?? discount.qty ?? discount.minQty ?? discount.requiredQty ?? 1);
  const rawBundlePrice = Number(
    discount.bundlePrice ?? discount.price ?? discount.discountPrice ?? discount.specialPrice ?? discount.offerPrice ?? 0
  );

  const textRule = String(discount.title || discount.label || discount.name || discount.description || "");
  const textBuyMatch = textRule.match(/buy\s*(\d+)/i);
  const textPriceMatch = textRule.match(/for\s*₹?\s*(\d+)/i);

  const buyQty = Number.isFinite(rawBuyQty) && rawBuyQty > 0 ? rawBuyQty : Number(textBuyMatch?.[1] || 1);
  const bundlePrice = Number.isFinite(rawBundlePrice) && rawBundlePrice > 0 ? rawBundlePrice : Number(textPriceMatch?.[1] || 0);

  const productMap = new Map(products.map((product) => [String(product.id), product]));
  let totalMatchedQty = 0;
  let eligibleSubtotal = 0;

  for (const item of items) {
    const qty = Number(item.qty || 1);
    const product = productMap.get(String(item.productId));
    const productCategories = Array.isArray(item.categories) && item.categories.length
      ? item.categories.map(normalizeCategoryValue).filter(Boolean)
      : getProductCategoryValues(product || {});
    const matchesCategory = !category || productCategories.some((value) => value === category);

    if (!matchesCategory) continue;

    const price = Number(item.price) || Number(product?.price) || 0;
    totalMatchedQty += qty;
    eligibleSubtotal += price * qty;
  }

  if (!buyQty || buyQty <= 0) {
    return { valid: false, reason: "This coupon is misconfigured." };
  }

  if (totalMatchedQty < buyQty) {
    return {
      valid: false,
      reason: discount.message || `Add ${buyQty} matching item(s) to use ${code}.`,
      requiredQty: buyQty,
      totalMatchedQty,
    };
  }

  const bundleCount = Math.floor(totalMatchedQty / buyQty);
  if (bundleCount < 1) {
    return {
      valid: false,
      reason: discount.message || `Add ${buyQty} matching item(s) to use ${code}.`,
      requiredQty: buyQty,
      totalMatchedQty,
    };
  }

  const discountAmount = Math.max(0, eligibleSubtotal - bundlePrice * bundleCount);

  return {
    valid: true,
    code,
    label: discount.label || discount.title || code,
    reason: `Applied ${code}.`,
    totalMatchedQty,
    discountAmount,
    bundleCount,
    requiredQty: buyQty,
  };
}
