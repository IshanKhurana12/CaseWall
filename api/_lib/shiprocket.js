const DEFAULT_SHIPROCKET_BASE_URL = "https://apiv2.shiprocket.in";

const TOKEN_CACHE_TTL_MS = 50 * 60 * 1000;

let shiprocketToken = null;
let shiprocketTokenFetchedAt = 0;

/*
 * ============================================================
 * GST CONFIGURATION
 * ============================================================
 *
 * Your GST registration state.
 *
 * Set this in Vercel:
 *
 * GST_BUSINESS_STATE=Delhi
 *
 * Do NOT hardcode the GST rate here.
 * GST rate comes from each product's gstRate field.
 */
const BUSINESS_STATE = String(
  process.env.GST_BUSINESS_STATE || "Delhi"
).trim();


function normalizeState(state) {
  return String(state || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}


/*
 * Calculate GST from a GST-inclusive amount.
 *
 * Example:
 *
 * ₹299 including 18% GST
 *
 * Taxable value = 299 / 1.18
 * GST           = 299 - taxable value
 */
function calculateGstInclusive(amount, gstRate) {
  const gross = Number(amount || 0);
  const rate = Number(gstRate || 0);

  if (
    !Number.isFinite(gross) ||
    gross <= 0 ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    return {
      gross: Number(gross.toFixed(2)),
      taxable: Number(gross.toFixed(2)),
      gst: 0,
    };
  }

  const taxable = gross / (1 + rate / 100);
  const gst = gross - taxable;

  return {
    gross: Number(gross.toFixed(2)),
    taxable: Number(taxable.toFixed(2)),
    gst: Number(gst.toFixed(2)),
  };
}


/*
 * ============================================================
 * ORDER GST CALCULATION
 * ============================================================
 *
 * Supports products having different GST rates.
 *
 * Example:
 *
 * Product A:
 * ₹299 including 18%
 *
 * Product B:
 * ₹199 including 12%
 *
 * Shipping:
 * ₹80
 *
 * The shipping amount is included in the taxable supply.
 *
 * For a single-rate order, shipping follows that product's
 * GST rate.
 *
 * For multiple GST rates, shipping is allocated proportionally
 * across the products based on their gross value.
 */
function calculateOrderGst({
  items,
  shippingAmount,
  customerState,
}) {
  const shipping = Number(shippingAmount || 0);

  const customerStateNormalized =
    normalizeState(customerState);

  const businessStateNormalized =
    normalizeState(BUSINESS_STATE);

  const sameState =
    customerStateNormalized ===
    businessStateNormalized;

  /*
   * ----------------------------------------------------------
   * Calculate product GST individually
   * ----------------------------------------------------------
   */
  const productBreakdown = [];

  let productsGrossTotal = 0;

  for (const item of items) {
    const unitPrice = Number(
      item.price ??
        item.unitPrice ??
        item.unit_amount ??
        item.amount ??
        0
    );

    const quantity = Number(
      item.qty ??
        item.quantity ??
        1
    );

    const gross = unitPrice * quantity;

    const gstRate = Number(
      item.gstRate ?? 0
    );

    const hsnCode = String(
      item.hsnCode ?? ""
    ).trim();

    const calculated =
      calculateGstInclusive(
        gross,
        gstRate
      );

    productsGrossTotal += gross;

    productBreakdown.push({
      name:
        item.name ||
        item.title ||
        item.productName ||
        "Product",

      sku:
        item.productId ||
        item.id ||
        null,

      hsnCode,

      quantity,

      gstRate,

      gross: calculated.gross,

      taxable: calculated.taxable,

      gst: calculated.gst,
    });
  }

  /*
   * ----------------------------------------------------------
   * Allocate shipping
   * ----------------------------------------------------------
   *
   * Shipping is distributed proportionally across products.
   *
   * Example:
   *
   * Product A = ₹300
   * Product B = ₹100
   * Shipping = ₹80
   *
   * A gets ₹60 shipping
   * B gets ₹20 shipping
   */
  const totalGrossBeforeShipping =
    productsGrossTotal;

  let totalTaxable = 0;
  let totalGst = 0;

  const finalProductBreakdown =
    productBreakdown.map(
      (product) => {
        let allocatedShipping = 0;

        if (
          shipping > 0 &&
          totalGrossBeforeShipping > 0
        ) {
          allocatedShipping =
            shipping *
            (product.gross /
              totalGrossBeforeShipping);
        }

        allocatedShipping = Number(
          allocatedShipping.toFixed(2)
        );

        const combinedGross =
          product.gross +
          allocatedShipping;

        const calculated =
          calculateGstInclusive(
            combinedGross,
            product.gstRate
          );

        totalTaxable +=
          calculated.taxable;

        totalGst +=
          calculated.gst;

        return {
          ...product,

          shippingAllocated:
            allocatedShipping,

          grossIncludingShipping:
            calculated.gross,

          taxable:
            calculated.taxable,

          gst:
            calculated.gst,
        };
      }
    );

  /*
   * Fix rounding difference.
   */
  totalTaxable =
    Number(totalTaxable.toFixed(2));

  totalGst =
    Number(totalGst.toFixed(2));

  const grossTotal =
    Number(
      (
        productsGrossTotal +
        shipping
      ).toFixed(2)
    );

  /*
   * ----------------------------------------------------------
   * CGST / SGST / IGST
   * ----------------------------------------------------------
   */
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  let cgstRate = 0;
  let sgstRate = 0;
  let igstRate = 0;

  /*
   * For a same-state order:
   *
   * CGST + SGST
   *
   * For an inter-state order:
   *
   * IGST
   *
   * If products have different GST rates, we calculate the
   * actual total GST first and split it accordingly.
   */
  if (sameState) {
    cgstRate = null;
    sgstRate = null;

    cgst =
      Number(
        (totalGst / 2).toFixed(2)
      );

    sgst =
      Number(
        (totalGst - cgst).toFixed(2)
      );
  } else {
    igstRate = null;

    igst =
      Number(totalGst.toFixed(2));
  }

  /*
   * If there is only one GST rate in the order,
   * expose the actual rate.
   *
   * For mixed-rate orders, rate is null because one
   * percentage cannot represent the entire order.
   */
  const uniqueRates = [
    ...new Set(
      finalProductBreakdown
        .map(
          (item) =>
            Number(item.gstRate || 0)
        )
        .filter(
          (rate) => rate > 0
        )
    ),
  ];

  if (uniqueRates.length === 1) {
    const orderRate =
      uniqueRates[0];

    if (sameState) {
      cgstRate =
        orderRate / 2;

      sgstRate =
        orderRate / 2;
    } else {
      igstRate =
        orderRate;
    }
  }

  return {
    businessState:
      BUSINESS_STATE,

    customerState,

    sameState,

    grossTotal,

    productsGrossTotal:
      Number(
        productsGrossTotal.toFixed(2)
      ),

    shippingAmount:
      Number(shipping.toFixed(2)),

    taxableValue:
      totalTaxable,

    totalGst,

    cgstRate,

    cgst,

    sgstRate,

    sgst,

    igstRate,

    igst,

    productBreakdown:
      finalProductBreakdown,
  };
}


function getShiprocketConfig() {
  const baseUrl = (
    process.env.SHIPROCKET_BASE_URL ||
    DEFAULT_SHIPROCKET_BASE_URL
  ).replace(/\/+$/, "");

  const email =
    process.env.SHIPROCKET_EMAIL;

  const password =
    process.env.SHIPROCKET_PASSWORD;

  const apiKey =
    process.env.SHIPROCKET_API_KEY;

  const apiSecret =
    process.env.SHIPROCKET_API_SECRET;

  if (
    (!email || !password) &&
    (!apiKey || !apiSecret)
  ) {
    throw new Error(
      "Missing Shiprocket credentials. Set SHIPROCKET_EMAIL + SHIPROCKET_PASSWORD or SHIPROCKET_API_KEY + SHIPROCKET_API_SECRET in the server environment."
    );
  }

  return {
    baseUrl,
    email,
    password,
    apiKey,
    apiSecret,
  };
}


async function shiprocketFetch(
  path,
  {
    method = "GET",
    body,
    token,
  } = {}
) {
  const { baseUrl } =
    getShiprocketConfig();

  const url =
    `${baseUrl}${path}`;

  const headers = {
    "Content-Type":
      "application/json",

    Accept:
      "application/json",
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  const response =
    await fetch(url, {
      method,
      headers,
      body: body
        ? JSON.stringify(body)
        : undefined,
    });

  const text =
    await response.text();

  let data = {};

  try {
    data =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      typeof data === "string"
        ? data
        : JSON.stringify(data);

    throw new Error(
      `Shiprocket request failed (${response.status}): ${message}`
    );
  }

  return data;
}


export async function getShiprocketToken() {
  const now = Date.now();

  if (
    shiprocketToken &&
    now - shiprocketTokenFetchedAt <
      TOKEN_CACHE_TTL_MS
  ) {
    return shiprocketToken;
  }

  const {
    baseUrl,
    email,
    password,
    apiKey,
    apiSecret,
  } = getShiprocketConfig();

  /*
   * Email/password authentication
   */
  if (email && password) {
    const payload =
      await shiprocketFetch(
        "/v1/external/auth/login",
        {
          method: "POST",

          body: {
            email,
            password,
          },
        }
      );

    const token =
      payload?.token ||
      payload?.data?.token ||
      payload?.result?.token;

    if (!token) {
      throw new Error(
        `Shiprocket login response did not include a token. Response: ${JSON.stringify(
          payload
        )}`
      );
    }

    shiprocketToken =
      token;

    shiprocketTokenFetchedAt =
      now;

    return token;
  }

  /*
   * API key/secret authentication
   */
  const basic =
    Buffer.from(
      `${apiKey}:${apiSecret}`
    ).toString("base64");

  const response =
    await fetch(
      `${baseUrl}/v1/external/auth/login`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Basic ${basic}`,

          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify({}),
      }
    );

  const text =
    await response.text();

  let payload = {};

  try {
    payload =
      text
        ? JSON.parse(text)
        : {};
  } catch {
    payload = text;
  }

  if (!response.ok) {
    throw new Error(
      `Shiprocket auth failed (${response.status}): ${
        typeof payload === "string"
          ? payload
          : JSON.stringify(payload)
      }`
    );
  }

  const token =
    payload?.token ||
    payload?.data?.token ||
    payload?.result?.token;

  if (!token) {
    throw new Error(
      `Shiprocket login response did not include a token. Response: ${JSON.stringify(
        payload
      )}`
    );
  }

  shiprocketToken =
    token;

  shiprocketTokenFetchedAt =
    now;

  return token;
}


function findFirstNestedValue(
  obj,
  keys
) {
  if (
    !obj ||
    typeof obj !== "object"
  ) {
    return null;
  }

  for (const key of keys) {
    if (
      obj[key] !== undefined &&
      obj[key] !== null &&
      obj[key] !== ""
    ) {
      return obj[key];
    }
  }

  for (const value of Object.values(
    obj
  )) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const match =
          findFirstNestedValue(
            item,
            keys
          );

        if (match !== null) {
          return match;
        }
      }
    } else if (
      value &&
      typeof value === "object"
    ) {
      const match =
        findFirstNestedValue(
          value,
          keys
        );

      if (match !== null) {
        return match;
      }
    }
  }

  return null;
}


function normalizeTrackingResult(
  payload
) {
  const data =
    payload?.data ??
    payload?.result ??
    payload ??
    {};

  const trackingId =
    findFirstNestedValue(
      data,
      [
        "tracking_id",
        "awb_code",
        "awb",
        "trackingId",
        "waybill",
        "trackingID",
      ]
    ) || null;

  const shipmentId =
    findFirstNestedValue(
      data,
      [
        "shipment_id",
        "shipmentId",
      ]
    ) || null;

  const trackingUrl =
    findFirstNestedValue(
      data,
      [
        "tracking_url",
        "trackingUrl",
      ]
    ) ||
    (
      trackingId
        ? `https://shiprocket.co/tracking/${trackingId}`
        : null
    );

  const status =
    findFirstNestedValue(
      data,
      [
        "status",
        "shipment_status",
        "current_status",
      ]
    ) || null;

  return {
    trackingId:
      trackingId ||
      shipmentId ||
      null,

    waybill:
      trackingId ||
      shipmentId ||
      null,

    trackingUrl,

    status,

    raw: payload,
  };
}


export async function getShiprocketServiceability({
  pickupPincode,
  deliveryPincode,
  weight = 0.5,
  cod = 0,
}) {
  const token =
    await getShiprocketToken();

  const pickup =
    String(
      pickupPincode ||
        process.env.SHIPROCKET_PICKUP_PINCODE ||
        "110001"
    ).trim();

  const delivery =
    String(
      deliveryPincode || ""
    ).trim();

  if (!delivery) {
    throw new Error(
      "Missing delivery pincode for Shiprocket serviceability lookup."
    );
  }

  const path =
    `/v1/external/courier/serviceability/` +
    `?pickup_postcode=${encodeURIComponent(
      pickup
    )}` +
    `&delivery_postcode=${encodeURIComponent(
      delivery
    )}` +
    `&weight=${Number(
      weight || 0.5
    )}` +
    `&cod=${Number(
      cod || 0
    )}`;

  const response =
    await shiprocketFetch(
      path,
      {
        method: "GET",
        token,
      }
    );

  return (
    response?.data ??
    response?.result ??
    response ??
    {}
  );
}


export async function assignShiprocketAwb({
  shipmentId,
  courierId,
  orderId,
}) {
  const token =
    await getShiprocketToken();

  const shipment =
    String(
      shipmentId || ""
    ).trim();

  const courier =
    String(
      courierId ||
        process.env.SHIPROCKET_COURIER_ID ||
        ""
    ).trim();

  if (!shipment) {
    throw new Error(
      "Missing Shiprocket shipment id before assigning AWB."
    );
  }

  if (!courier) {
    throw new Error(
      "Missing Shiprocket courierId. Set SHIPROCKET_COURIER_ID or pass courierId to assignShiprocketAwb()."
    );
  }

  const payload = {
    shipment_id:
      shipment,

    courier_id:
      Number(courier),

    order_id:
      String(
        orderId ||
          shipment
      ),
  };

  const response =
    await shiprocketFetch(
      "/v1/external/courier/assign/awb",
      {
        method: "POST",
        body: payload,
        token,
      }
    );

  const data =
    response?.data ??
    response?.result ??
    response ??
    {};

  return {
    awb:
      data?.awb_code ||
      data?.awb ||
      data?.tracking_id ||
      null,

    courierName:
      data?.courier_name ||
      data?.courierName ||
      null,

    raw: data,
  };
}


export async function resolveShiprocketCourier({
  pickupPincode,
  deliveryPincode,
  weight = 0.5,
  cod = 0,
  preferredCourierId,
} = {}) {
  const pickup =
    String(
      pickupPincode ||
        process.env.SHIPROCKET_PICKUP_PINCODE ||
        "110001"
    ).trim();

  const delivery =
    String(
      deliveryPincode || ""
    ).trim();

  if (!delivery) {
    throw new Error(
      "Missing delivery pincode for Shiprocket courier resolution."
    );
  }

  const serviceability =
    await getShiprocketServiceability({
      pickupPincode:
        pickup,

      deliveryPincode:
        delivery,

      weight,

      cod,
    });

  const list =
    Array.isArray(
      serviceability
    )
      ? serviceability

      : Array.isArray(
          serviceability?.available_courier_companies
        )
      ? serviceability.available_courier_companies

      : Array.isArray(
          serviceability?.data
            ?.available_courier_companies
        )
      ? serviceability.data
          .available_courier_companies

      : Array.isArray(
          serviceability?.data
        )
      ? serviceability.data

      : Array.isArray(
          serviceability?.result
        )
      ? serviceability.result

      : [];

  if (!list.length) {
    throw new Error(
      `No Shiprocket courier available for pickup ${pickup} to delivery ${delivery}. Raw serviceability response: ${JSON.stringify(
        serviceability
      )}`
    );
  }

  const recommendedId =
    Number(
      serviceability
        ?.recommended_courier_company_id ??
        serviceability?.data
          ?.recommended_courier_company_id
    );

  const preferred =
    preferredCourierId != null
      ? list.find(
          (item) => {
            const candidateId =
              Number(
                item?.courier_company_id ??
                  item?.courier_companyId ??
                  item?.courier_id ??
                  item?.courierId
              );

            return (
              Number.isFinite(
                candidateId
              ) &&
              Number(
                preferredCourierId
              ) === candidateId
            );
          }
        )
      : null;

  const option =
    preferred ||

    list.find(
      (item) =>
        Number(
          item?.courier_company_id ??
            item?.courier_companyId ??
            item?.courier_id ??
            item?.courierId
        ) ===
        recommendedId
    ) ||

    list[0];

  if (!option) {
    throw new Error(
      `No Shiprocket courier available for pickup ${pickup} to delivery ${delivery}.`
    );
  }

  const courierId =
    Number(
      option?.courier_company_id ??
        option?.courier_companyId ??
        option?.courier_id ??
        option?.courierId
    );

  if (!Number.isFinite(courierId)) {
    throw new Error(
      `Serviceability result for route ${pickup} → ${delivery} did not include a valid courier_company_id.`
    );
  }

  return {
    courierId,

    courierName:
      option?.courier_name ||
      option?.courierName ||
      null,

    rate:
      option?.rate ??
      option?.freight_charge ??
      null,

    raw: option,
  };
}


export async function scheduleShiprocketPickup({
  shipmentId,
  orderId,
  order,
  pickupLocation,
}) {
  const token =
    await getShiprocketToken();

  const shipment =
    String(
      shipmentId || ""
    ).trim();

  if (!shipment) {
    throw new Error(
      "Missing Shiprocket shipment id before scheduling pickup."
    );
  }

  const address =
    order?.address || {};

  const contact =
    order?.contact || {};

  const pickupDate =
    new Date(
      Date.now() +
        24 * 60 * 60 * 1000
    )
      .toISOString()
      .slice(0, 10);

  const defaultPickup =
    String(
      process.env.SHIPROCKET_PICKUP_LOCATION ||
        "default"
    ).trim();

  const payload = {
    shipment_id:
      shipment,

    pickup_location:
      String(
        pickupLocation ||
          defaultPickup ||
          "default"
      ).slice(0, 80),

    city:
      String(
        address.city ||
          "Delhi"
      ).slice(0, 80),

    state:
      String(
        address.state ||
          "Delhi"
      ).slice(0, 80),

    pin_code:
      String(
        address.pincode ||
          process.env.SHIPROCKET_PICKUP_PINCODE ||
          "110001"
      ).slice(0, 20),

    phone:
      String(
        contact.phone ||
          "9999999999"
      ).slice(0, 20),

    email:
      String(
        contact.email ||
          "support@example.com"
      ).slice(0, 120),

    address:
      [
        address.line1,
        address.line2,
      ]
        .filter(Boolean)
        .join(", ") ||
      "Pickup address",

    comment:
      `Pickup for order ${orderId}`,

    pickup_date:
      pickupDate,

    pickup_time:
      "13:00",
  };

  const response =
    await shiprocketFetch(
      "/v1/external/courier/generate/pickup",
      {
        method: "POST",
        body: payload,
        token,
      }
    );

  const data =
    response?.data ??
    response?.result ??
    response ??
    {};

  return {
    pickupStatus:
      findFirstNestedValue(
        data,
        [
          "status",
          "pickup_status",
          "shipment_status",
        ]
      ) || "scheduled",

    pickupId:
      findFirstNestedValue(
        data,
        [
          "pickup_id",
          "id",
          "pickupId",
        ]
      ) || null,

    raw: data,
  };
}


/*
 * ============================================================
 * CREATE SHIPROCKET ORDER
 * ============================================================
 */
export async function createShiprocketOrder(
  order,
  orderId
) {
  const token =
    await getShiprocketToken();

  const items =
    Array.isArray(order.items)
      ? order.items
      : [];

  /*
   * Amounts in Firestore are RUPEES.
   *
   * Shiprocket also expects RUPEES.
   */
  const shippingAmount =
    Number(
      order.shippingAmount ??
        order.shippingPaise ??
        0
    );

  const itemsSubtotal =
    Number(
      order.itemsAmount ??
        order.amount ??
        0
    );

  const discountAmount = Number(order.discountAmount || 0);
  const isCod = String(order.paymentMethod || "PREPAID").toUpperCase() === "COD";
  const codAmount = isCod ? Math.max(0, Number(order.codAmount || 0)) : 0;
  const netItemsSubtotal = Math.max(0, itemsSubtotal - discountAmount);

  /*
   * ----------------------------------------------------------
   * GST
   * ----------------------------------------------------------
   *
   * gstRate comes from each product/order item.
   *
   * hsnCode comes from each product/order item.
   */
  const customerState =
    String(
      order.address?.state ||
        ""
    ).trim();

  const gst =
    calculateOrderGst({
      items,

      shippingAmount,

      customerState,
    });

  const billingAddress =
    [
      order.address?.line1,
      order.address?.line2,
    ]
      .filter(Boolean)
      .join(", ");

  const shippingAddress =
    [
      order.address?.line1,
      order.address?.line2,
    ]
      .filter(Boolean)
      .join(", ");

  /*
   * ----------------------------------------------------------
   * ORDER ITEMS
   * ----------------------------------------------------------
   */
  const orderItems =
    items.map(
      (item) => {
        const unitPrice =
          Number(
            item.price ??
              item.unitPrice ??
              item.unit_amount ??
              item.amount ??
              0
          );

        const quantity =
          Number(
            item.qty ??
              item.quantity ??
              1
          );

        /*
         * GST RATE COMES FROM PRODUCT
         */
        const gstRate =
          Number(
            item.gstRate ?? 0
          );

        /*
         * HSN COMES FROM PRODUCT
         */
        const hsnCode =
          String(
            item.hsnCode ?? ""
          ).trim();

        const orderItem = {
          name:
            String(
              item.name ||
                item.title ||
                item.productName ||
                "Product"
            ).slice(0, 120),

          sku:
            String(
              item.variantId &&
                item.variantId !== "_legacy"

                ? `${item.productId}-${item.variantId}`

                : item.productId ||
                    item.id ||
                    `item-${orderId}-${Math.random()
                      .toString(36)
                      .slice(2, 8)}`
            ),

          units:
            quantity,

          /*
           * Product price is already GST-inclusive.
           */
          selling_price:
            Number(
              unitPrice || 0
            ).toFixed(2),

          /*
           * GST rate from Firestore product.
           */
          tax:
            gstRate,
        };

        /*
         * HSN from Firestore product.
         */
        if (hsnCode) {
          orderItem.hsn =
            hsnCode;
        }

        return orderItem;
      }
    );

  /*
   * ----------------------------------------------------------
   * SHIPROCKET PAYLOAD
   * ----------------------------------------------------------
   */
  const payload = {
    order_id:
      String(orderId),

    order_date:
      new Date().toISOString(),

    pickup_location:
      process.env.SHIPROCKET_PICKUP_LOCATION ||
      "default",

    channel_id:
      Number(
        process.env.SHIPROCKET_CHANNEL_ID ||
          1
      ),

    comment:
      `Order ${orderId}`,

    /*
     * Billing
     */
    billing_customer_name:
      String(
        order.contact?.name ||
          "Customer"
      ).slice(0, 120),

    billing_last_name:
      "",

    billing_address:
      billingAddress ||
      "N/A",

    billing_city:
      String(
        order.address?.city ||
          ""
      ),

    billing_pincode:
      String(
        order.address?.pincode ||
          ""
      ),

    billing_state:
      String(
        order.address?.state ||
          ""
      ),

    billing_country:
      process.env.SHIPROCKET_COUNTRY ||
      "India",

    billing_email:
      String(
        order.contact?.email ||
          ""
      ),

    billing_phone:
      String(
        order.contact?.phone ||
          ""
      ),

    /*
     * Shipping
     */
    shipping_is_billing:
      true,

    shipping_customer_name:
      String(
        order.contact?.name ||
          "Customer"
      ).slice(0, 120),

    shipping_last_name:
      "",

    shipping_address:
      shippingAddress ||
      "N/A",

    shipping_city:
      String(
        order.address?.city ||
          ""
      ),

    shipping_pincode:
      String(
        order.address?.pincode ||
          ""
      ),

    shipping_state:
      String(
        order.address?.state ||
          ""
      ),

    shipping_country:
      process.env.SHIPROCKET_COUNTRY ||
      "India",

    shipping_email:
      String(
        order.contact?.email ||
          ""
      ),

    shipping_phone:
      String(
        order.contact?.phone ||
          ""
      ),

    payment_method:
      isCod ? "COD" : "Prepaid",

    ...(isCod
      ? {
          cod_amount: codAmount,
        }
      : {}),

    /*
     * IMPORTANT:
     *
     * Products only.
     *
     * Shipping is NOT added here because it is
     * sent separately below.
     */
    sub_total:
      Number(
        netItemsSubtotal || 0
      ).toFixed(2),

    /*
     * Customer's shipping charge.
     */
    shipping_charges:
      Number(
        shippingAmount || 0
      ).toFixed(2),

    total_discount:
      discountAmount.toFixed(2),

    /*
     * Product rows.
     *
     * Each row contains:
     *
     * selling_price = GST-inclusive
     * tax           = product gstRate
     * hsn           = product hsnCode
     */
    order_items:
      orderItems,

    /*
     * Optional customer GSTIN.
     */
    ...(order.customerGstin
      ? {
          customer_gstin:
            String(
              order.customerGstin
            ),
        }
      : {}),

    /*
     * Optional invoice number.
     */
    ...(order.invoiceNumber
      ? {
          invoice_number:
            String(
              order.invoiceNumber
            ),
        }
      : {}),

    /*
     * Package dimensions.
     */
    length:
      Number(
        process.env.SHIPROCKET_PACKET_LENGTH ||
          10
      ),

    breadth:
      Number(
        process.env.SHIPROCKET_PACKET_BREADTH ||
          10
      ),

    height:
      Number(
        process.env.SHIPROCKET_PACKET_HEIGHT ||
          5
      ),

    weight:
      Number(
        process.env.SHIPROCKET_PACKET_WEIGHT ||
          0.5
      ),
  };

  /*
   * ----------------------------------------------------------
   * SERVER LOG
   * ----------------------------------------------------------
   *
   * Useful for checking GST calculations in Vercel logs.
   */
  console.log(
    "Shiprocket order GST:",
    {
      orderId,

      businessState:
        BUSINESS_STATE,

      customerState,

      sameState:
        gst.sameState,

      productsGrossTotal:
        gst.productsGrossTotal,

      shippingAmount:
        gst.shippingAmount,

      grossTotal:
        gst.grossTotal,

      taxableValue:
        gst.taxableValue,

      totalGst:
        gst.totalGst,

      cgst:
        gst.cgst,

      sgst:
        gst.sgst,

      igst:
        gst.igst,

      products:
        gst.productBreakdown,
    }
  );

  /*
   * ----------------------------------------------------------
   * CREATE ORDER
   * ----------------------------------------------------------
   */
  const response =
    await shiprocketFetch(
      "/v1/external/orders/create/adhoc",
      {
        method: "POST",

        body:
          payload,

        token,
      }
    );

  const data =
    response?.data ??
    response?.result ??
    response ??
    {};

  const shipmentId =
    findFirstNestedValue(
      data,
      [
        "shipment_id",
        "shipmentId",
        "id",
      ]
    ) || null;

  const result =
    normalizeTrackingResult(
      data
    );

  if (!shipmentId) {
    throw new Error(
      `Shiprocket order creation did not return a shipment id. Response: ${JSON.stringify(
        data
      )}`
    );
  }

  /*
   * ----------------------------------------------------------
   * COURIER
   * ----------------------------------------------------------
   */
  const pickupPincode =
    String(
      process.env.SHIPROCKET_PICKUP_PINCODE ||
        "110001"
    ).trim();

  const deliveryPincode =
    String(
      order?.address?.pincode ||
        ""
    ).trim();

  if (!deliveryPincode) {
    throw new Error(
      `Order ${orderId} is missing a valid delivery pincode for Shiprocket courier selection.`
    );
  }

  const route =
    await resolveShiprocketCourier({
      pickupPincode,

      deliveryPincode,

      weight:
        Number(
          process.env.SHIPROCKET_PACKET_WEIGHT ||
            0.5
        ),

      cod:
        0,
    });

  /*
   * ----------------------------------------------------------
   * ASSIGN AWB
   * ----------------------------------------------------------
   */
  try {
    const assigned =
      await assignShiprocketAwb({
        shipmentId,

        courierId:
          route.courierId,

        orderId,
      });

    if (assigned.awb) {
      result.trackingId =
        assigned.awb;

      result.waybill =
        assigned.awb;

      result.trackingUrl =
        result.trackingUrl ||
        `https://shiprocket.co/tracking/${assigned.awb}`;
    }
  } catch (awberr) {
    throw new Error(
      `Shiprocket AWB assignment failed for order ${orderId}: ${
        awberr.message ||
        awberr
      }`
    );
  }

  if (!result.waybill) {
    throw new Error(
      `Shiprocket did not return a valid AWB/tracking value for order ${orderId}. Response: ${JSON.stringify(
        data
      )}`
    );
  }

  /*
   * ----------------------------------------------------------
   * PICKUP
   * ----------------------------------------------------------
   */
  const pickupLocation =
    String(
      process.env.SHIPROCKET_PICKUP_LOCATION ||
        "default"
    ).trim();

  const pickup =
    await scheduleShiprocketPickup({
      shipmentId,

      orderId,

      order,

      pickupLocation,
    });

  /*
   * ----------------------------------------------------------
   * RETURN
   * ----------------------------------------------------------
   *
   * GST is returned so your calling API can save it
   * to Firestore.
   */
  return {
    ...result,

    shipmentId,

    courierId:
      route.courierId,

    pickup,

    gst,

    raw:
      data,
  };
}


export async function trackShiprocketShipment(
  identifier
) {
  const token =
    await getShiprocketToken();

  const target =
    String(
      identifier || ""
    ).trim();

  if (!target) {
    throw new Error(
      "Missing Shiprocket tracking identifier."
    );
  }

  const candidates = [
    `/v1/external/courier/track/awb/${encodeURIComponent(
      target
    )}`,

    `/v1/external/courier/track/shipment/${encodeURIComponent(
      target
    )}`,
  ];

  let lastError =
    null;

  for (const path of candidates) {
    try {
      const response =
        await shiprocketFetch(
          path,
          {
            method: "GET",
            token,
          }
        );

      const data =
        response?.data ??
        response?.result ??
        response ??
        {};

      return normalizeTrackingResult(
        data
      );
    } catch (err) {
      lastError =
        err;
    }
  }

  throw (
    lastError ||
    new Error(
      `Unable to track Shiprocket shipment ${target}.`
    )
  );
}