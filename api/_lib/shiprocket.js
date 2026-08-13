const DEFAULT_SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in";
const TOKEN_CACHE_TTL_MS = 50 * 60 * 1000;

let shiprocketToken = null;
let shiprocketTokenFetchedAt = 0;

function getShiprocketConfig() {
  const baseUrl = (process.env.SHIPROCKET_BASE_URL || DEFAULT_SHIPROCKET_BASE_URL).replace(/\/+$/, "");
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  const apiKey = process.env.SHIPROCKET_API_KEY;
  const apiSecret = process.env.SHIPROCKET_API_SECRET;

  if ((!email || !password) && (!apiKey || !apiSecret)) {
    throw new Error(
      "Missing Shiprocket credentials. Set SHIPROCKET_EMAIL + SHIPROCKET_PASSWORD or SHIPROCKET_API_KEY + SHIPROCKET_API_SECRET in the server environment."
    );
  }

  return { baseUrl, email, password, apiKey, apiSecret };
}

async function shiprocketFetch(path, { method = "GET", body, token } = {}) {
  const { baseUrl } = getShiprocketConfig();
  const url = `${baseUrl}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`Shiprocket request failed (${response.status}): ${message}`);
  }

  return data;
}

export async function getShiprocketToken() {
  const now = Date.now();
  if (shiprocketToken && now - shiprocketTokenFetchedAt < TOKEN_CACHE_TTL_MS) {
    return shiprocketToken;
  }

  const { baseUrl, email, password, apiKey, apiSecret } = getShiprocketConfig();

  if (email && password) {
    const payload = await shiprocketFetch("/v1/external/auth/login", {
      method: "POST",
      body: { email, password },
    });

    const token = payload?.token || payload?.data?.token || payload?.result?.token;
    if (!token) {
      throw new Error(`Shiprocket login response did not include a token. Response: ${JSON.stringify(payload)}`);
    }

    shiprocketToken = token;
    shiprocketTokenFetchedAt = now;
    return token;
  }

  const basic = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const response = await fetch(`${baseUrl}/v1/external/auth/login`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({}),
  });

  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(`Shiprocket auth failed (${response.status}): ${typeof payload === "string" ? payload : JSON.stringify(payload)}`);
  }

  const token = payload?.token || payload?.data?.token || payload?.result?.token;
  if (!token) {
    throw new Error(`Shiprocket login response did not include a token. Response: ${JSON.stringify(payload)}`);
  }

  shiprocketToken = token;
  shiprocketTokenFetchedAt = now;
  return token;
}

function findFirstNestedValue(obj, keys) {
  if (!obj || typeof obj !== "object") return null;

  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const match = findFirstNestedValue(item, keys);
        if (match !== null) return match;
      }
    } else if (value && typeof value === "object") {
      const match = findFirstNestedValue(value, keys);
      if (match !== null) return match;
    }
  }

  return null;
}

function normalizeTrackingResult(payload) {
  const data = payload?.data ?? payload?.result ?? payload ?? {};
  const trackingId = findFirstNestedValue(data, ["tracking_id", "awb_code", "awb", "trackingId", "waybill", "trackingID"]) || null;
  const shipmentId = findFirstNestedValue(data, ["shipment_id", "shipmentId"]) || null;
  const trackingUrl = findFirstNestedValue(data, ["tracking_url", "trackingUrl"]) || (trackingId ? `https://shiprocket.co/tracking/${trackingId}` : null);
  const status = findFirstNestedValue(data, ["status", "shipment_status", "current_status"]) || null;
  return {
    trackingId: trackingId || shipmentId || null,
    waybill: trackingId || shipmentId || null,
    trackingUrl,
    status,
    raw: payload,
  };
}

export async function getShiprocketServiceability({ pickupPincode, deliveryPincode, weight = 0.5, cod = 0 }) {
  const token = await getShiprocketToken();
  const pickup = String(pickupPincode || process.env.SHIPROCKET_PICKUP_PINCODE || "110001").trim();
  const delivery = String(deliveryPincode || "").trim();
  if (!delivery) {
    throw new Error("Missing delivery pincode for Shiprocket serviceability lookup.");
  }

  const path = `/v1/external/courier/serviceability/?pickup_postcode=${encodeURIComponent(pickup)}&delivery_postcode=${encodeURIComponent(delivery)}&weight=${Number(weight || 0.5)}&cod=${Number(cod || 0)}`;
  const response = await shiprocketFetch(path, { method: "GET", token });
  // NOTE: Shiprocket's actual response shape is:
  // { data: { available_courier_companies: [...], recommended_courier_company_id, ... } }
  // Returning response.data here means callers receive the INNER object
  // ({ available_courier_companies, recommended_courier_company_id, ... }),
  // not a plain array and not something with a nested `.data`/`.result`.
  return response?.data ?? response?.result ?? response ?? {};
}

export async function assignShiprocketAwb({ shipmentId, courierId, orderId }) {
  const token = await getShiprocketToken();
  const shipment = String(shipmentId || "").trim();
  const courier = String(courierId || process.env.SHIPROCKET_COURIER_ID || "").trim();

  if (!shipment) {
    throw new Error("Missing Shiprocket shipment id before assigning AWB.");
  }

  if (!courier) {
    throw new Error("Missing Shiprocket courierId. Set SHIPROCKET_COURIER_ID or pass courierId to assignShiprocketAwb().");
  }

  const payload = {
    shipment_id: shipment,
    courier_id: Number(courier),
    order_id: String(orderId || shipment),
  };

  const response = await shiprocketFetch("/v1/external/courier/assign/awb", {
    method: "POST",
    body: payload,
    token,
  });

  const data = response?.data ?? response?.result ?? response ?? {};
  return {
    awb: data?.awb_code || data?.awb || data?.tracking_id || null,
    courierName: data?.courier_name || data?.courierName || null,
    raw: data,
  };
}

export async function resolveShiprocketCourier({ pickupPincode, deliveryPincode, weight = 0.5, cod = 0, preferredCourierId } = {}) {
  const pickup = String(pickupPincode || process.env.SHIPROCKET_PICKUP_PINCODE || "110001").trim();
  const delivery = String(deliveryPincode || "").trim();
  if (!delivery) {
    throw new Error("Missing delivery pincode for Shiprocket courier resolution.");
  }

  const serviceability = await getShiprocketServiceability({ pickupPincode: pickup, deliveryPincode: delivery, weight, cod });

  // Shiprocket's real payload nests the courier list under `available_courier_companies`.
  // Handle every shape we might realistically receive, in order of likelihood.
  const list = Array.isArray(serviceability)
    ? serviceability
    : Array.isArray(serviceability?.available_courier_companies)
    ? serviceability.available_courier_companies
    : Array.isArray(serviceability?.data?.available_courier_companies)
    ? serviceability.data.available_courier_companies
    : Array.isArray(serviceability?.data)
    ? serviceability.data
    : Array.isArray(serviceability?.result)
    ? serviceability.result
    : [];

  if (!list.length) {
    throw new Error(
      `No Shiprocket courier available for pickup ${pickup} to delivery ${delivery}. Raw serviceability response: ${JSON.stringify(
        serviceability
      )}`
    );
  }

  const recommendedId = Number(
    serviceability?.recommended_courier_company_id ?? serviceability?.data?.recommended_courier_company_id
  );

  const option =
    // 1. Explicit caller preference wins if it's actually in the list.
    (preferredCourierId != null &&
      list.find((item) => {
        const candidateId = Number(item?.courier_company_id ?? item?.courier_companyId ?? item?.courier_id ?? item?.courierId);
        return Number.isFinite(candidateId) && Number(preferredCourierId) === candidateId;
      })) ||
    // 2. Otherwise Shiprocket's own recommended courier for this route.
    list.find((item) => Number(item?.courier_company_id ?? item?.courier_companyId ?? item?.courier_id ?? item?.courierId) === recommendedId) ||
    // 3. Fallback to the first serviceable option.
    list[0];

  if (!option) {
    throw new Error(`No Shiprocket courier available for pickup ${pickup} to delivery ${delivery}.`);
  }

  const courierId = Number(option?.courier_company_id ?? option?.courier_companyId ?? option?.courier_id ?? option?.courierId);
  if (!Number.isFinite(courierId)) {
    throw new Error(`Serviceability result for route ${pickup} → ${delivery} did not include a valid courier_company_id.`);
  }

  return {
    courierId,
    courierName: option?.courier_name || option?.courierName || null,
    rate: option?.rate ?? option?.freight_charge ?? null,
    raw: option,
  };
}

export async function scheduleShiprocketPickup({ shipmentId, orderId, order, pickupLocation }) {
  const token = await getShiprocketToken();
  const shipment = String(shipmentId || "").trim();
  if (!shipment) {
    throw new Error("Missing Shiprocket shipment id before scheduling pickup.");
  }

  const address = order?.address || {};
  const contact = order?.contact || {};
  const pickupDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const defaultPickup = String(process.env.SHIPROCKET_PICKUP_LOCATION || "default").trim();

  const payload = {
    shipment_id: shipment,
    pickup_location: String(pickupLocation || defaultPickup || "default").slice(0, 80),
    city: String(address.city || "Delhi").slice(0, 80),
    state: String(address.state || "Delhi").slice(0, 80),
    pin_code: String(address.pincode || process.env.SHIPROCKET_PICKUP_PINCODE || "110001").slice(0, 20),
    phone: String(contact.phone || "9999999999").slice(0, 20),
    email: String(contact.email || "support@example.com").slice(0, 120),
    address: [address.line1, address.line2].filter(Boolean).join(", ") || "Pickup address",
    comment: `Pickup for order ${orderId}`,
    pickup_date: pickupDate,
    pickup_time: "13:00",
  };

  const response = await shiprocketFetch("/v1/external/courier/generate/pickup", {
    method: "POST",
    body: payload,
    token,
  });

  const data = response?.data ?? response?.result ?? response ?? {};
  return {
    pickupStatus: findFirstNestedValue(data, ["status", "pickup_status", "shipment_status"]) || "scheduled",
    pickupId: findFirstNestedValue(data, ["pickup_id", "id", "pickupId"]) || null,
    raw: data,
  };
}

export async function createShiprocketOrder(order, orderId) {
  const token = await getShiprocketToken();

  const items = Array.isArray(order.items) ? order.items : [];
  const shippingAmount = Number(order.shippingAmount ?? order.shippingPaise ?? 0) / 100;
  const subtotal = Number(order.itemsAmount ?? order.amount ?? 0) / 100;
  const billingAddress = [order.address?.line1, order.address?.line2].filter(Boolean).join(", ");
  const shippingAddress = [order.address?.line1, order.address?.line2].filter(Boolean).join(", ");

  const payload = {
    order_id: String(orderId),
    order_date: new Date().toISOString(),
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || "default",
    channel_id: Number(process.env.SHIPROCKET_CHANNEL_ID || 1),
    comment: `Order ${orderId}`,
    billing_customer_name: String(order.contact?.name || "Customer").slice(0, 120),
    billing_last_name: "",
    billing_address: billingAddress || "N/A",
    billing_city: String(order.address?.city || ""),
    billing_pincode: String(order.address?.pincode || ""),
    billing_state: String(order.address?.state || ""),
    billing_country: process.env.SHIPROCKET_COUNTRY || "India",
    billing_email: String(order.contact?.email || ""),
    billing_phone: String(order.contact?.phone || ""),
    shipping_is_billing: true,
    shipping_customer_name: String(order.contact?.name || "Customer").slice(0, 120),
    shipping_last_name: "",
    shipping_address: shippingAddress || "N/A",
    shipping_city: String(order.address?.city || ""),
    shipping_pincode: String(order.address?.pincode || ""),
    shipping_state: String(order.address?.state || ""),
    shipping_country: process.env.SHIPROCKET_COUNTRY || "India",
    shipping_email: String(order.contact?.email || ""),
    shipping_phone: String(order.contact?.phone || ""),
    payment_method: "Prepaid",
    sub_total: Number(subtotal || 0).toFixed(2),
    shipping_charges: Number(shippingAmount || 0).toFixed(2),
    total_discount: "0",
    order_items: items.map((item) => {
      const unitPrice = Number(item.price ?? item.unitPrice ?? item.unit_amount ?? item.amount ?? 0) / 100;
      const quantity = Number(item.qty || item.quantity || 1);
      return {
        name: String(item.name || item.title || item.productName || "Product").slice(0, 120),
        sku: String(item.productId || item.id || `item-${orderId}-${Math.random().toString(36).slice(2, 8)}`),
        units: quantity,
        selling_price: Number(unitPrice || 0).toFixed(2),
      };
    }),
    length: Number(process.env.SHIPROCKET_PACKET_LENGTH || 10),
    breadth: Number(process.env.SHIPROCKET_PACKET_BREADTH || 10),
    height: Number(process.env.SHIPROCKET_PACKET_HEIGHT || 5),
    weight: Number(process.env.SHIPROCKET_PACKET_WEIGHT || 0.5),
  };

  const response = await shiprocketFetch("/v1/external/orders/create/adhoc", {
    method: "POST",
    body: payload,
    token,
  });

  const data = response?.data ?? response?.result ?? response ?? {};
  const shipmentId = findFirstNestedValue(data, ["shipment_id", "shipmentId", "id"]) || null;
  const result = normalizeTrackingResult(data);

  if (!shipmentId) {
    throw new Error(`Shiprocket order creation did not return a shipment id. Response: ${JSON.stringify(data)}`);
  }

  const pickupPincode = String(process.env.SHIPROCKET_PICKUP_PINCODE || "110001").trim();
  const deliveryPincode = String(order?.address?.pincode || "").trim();
  if (!deliveryPincode) {
    throw new Error(`Order ${orderId} is missing a valid delivery pincode for Shiprocket courier selection.`);
  }

  const route = await resolveShiprocketCourier({
    pickupPincode,
    deliveryPincode,
    weight: Number(process.env.SHIPROCKET_PACKET_WEIGHT || 0.5),
    cod: 0,
  });

  try {
    const assigned = await assignShiprocketAwb({
      shipmentId,
      courierId: route.courierId,
      orderId,
    });
    if (assigned.awb) {
      result.trackingId = assigned.awb;
      result.waybill = assigned.awb;
      result.trackingUrl = result.trackingUrl || `https://shiprocket.co/tracking/${assigned.awb}`;
    }
  } catch (awberr) {
    throw new Error(`Shiprocket AWB assignment failed for order ${orderId}: ${awberr.message || awberr}`);
  }

  if (!result.waybill) {
    throw new Error(`Shiprocket did not return a valid AWB/tracking value for order ${orderId}. Response: ${JSON.stringify(data)}`);
  }

  const pickupLocation = String(process.env.SHIPROCKET_PICKUP_LOCATION || "default").trim();
  const pickup = await scheduleShiprocketPickup({
    shipmentId,
    orderId,
    order,
    pickupLocation,
  });

  return {
    ...result,
    shipmentId,
    courierId: route.courierId,
    pickup,
    raw: data,
  };
}

export async function trackShiprocketShipment(identifier) {
  const { baseUrl } = getShiprocketConfig();
  const token = await getShiprocketToken();
  const target = String(identifier || "").trim();
  if (!target) {
    throw new Error("Missing Shiprocket tracking identifier.");
  }

  const candidates = [
    `/v1/external/courier/track/awb/${encodeURIComponent(target)}`,
    `/v1/external/courier/track/shipment/${encodeURIComponent(target)}`,
  ];

  let lastError = null;
  for (const path of candidates) {
    try {
      const response = await shiprocketFetch(path, { method: "GET", token });
      const data = response?.data ?? response?.result ?? response ?? {};
      return normalizeTrackingResult(data);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`Unable to track Shiprocket shipment ${target}.`);
}