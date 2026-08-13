// Server-side only.
// DELHIVERY_API_TOKEN must NEVER be sent to the browser.
//
// Uses Delhivery's Surface / B2C API.
// Staging vs production is controlled by DELHIVERY_BASE_URL.
//
// staging:
// https://staging-express.delhivery.com
//
// production:
// https://track.delhivery.com


const BASE_URL =
  process.env.DELHIVERY_BASE_URL ||
  "https://track.delhivery.com";


function getToken() {
  const token = process.env.DELHIVERY_API_TOKEN;

  if (!token) {
    throw new Error(
      "Missing DELHIVERY_API_TOKEN in the server environment."
    );
  }

  return token;
}


function getPickupLocation() {
  const name = process.env.DELHIVERY_PICKUP_LOCATION;

  if (!name) {
    throw new Error(
      "Missing DELHIVERY_PICKUP_LOCATION (the warehouse/pickup name registered with Delhivery) in the server environment."
    );
  }

  return name;
}


// ---------------------------------------------------------
// CREATE DELHIVERY SHIPMENT
// ---------------------------------------------------------
//
// Creates a forward prepaid shipment after Razorpay payment
// has already been verified.
//
// Returns the Delhivery AWB / waybill.
//
// ---------------------------------------------------------

export async function createDelhiveryShipment(order, orderId) {
  const token = getToken();
  const pickupLocation = getPickupLocation();


  // -------------------------------------------------------
  // Validate order data
  // -------------------------------------------------------

  if (!order) {
    throw new Error("Order data is missing.");
  }

  if (!orderId) {
    throw new Error("Order ID is missing.");
  }

  if (!order.contact?.name) {
    throw new Error("Customer name is missing.");
  }

  if (!order.contact?.phone) {
    throw new Error("Customer phone is missing.");
  }

  if (!order.address?.line1) {
    throw new Error("Customer address is missing.");
  }

  if (!order.address?.city) {
    throw new Error("Customer city is missing.");
  }

  if (!order.address?.state) {
    throw new Error("Customer state is missing.");
  }

  if (!order.address?.pincode) {
    throw new Error("Customer pincode is missing.");
  }

  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new Error("Order has no items.");
  }


  // -------------------------------------------------------
  // Shipment weight
  // -------------------------------------------------------
  //
  // Delhivery expects shipment weight in grams.
  //
  // 500g is an initial value for testing.
  // IMPORTANT: replace this with your actual packed weight
  // once you know the weight of your CaseWall packages.
  //
  const weight = 500;


  // -------------------------------------------------------
  // Product description
  // -------------------------------------------------------

  const productsDescription = order.items
    .map((item) => `${item.name} x${item.qty}`)
    .join(", ")
    .slice(0, 500);


  // -------------------------------------------------------
  // Quantity
  // -------------------------------------------------------

  const quantity = order.items.reduce(
    (total, item) => total + (Number(item.qty) || 1),
    0
  );


  // -------------------------------------------------------
  // Customer address
  // -------------------------------------------------------

  const address = [
    order.address.line1,
    order.address.line2,
  ]
    .filter(Boolean)
    .join(", ")
    .slice(0, 300);


  // -------------------------------------------------------
  // Delhivery shipment payload
  // -------------------------------------------------------

  const shipment = {
    name: String(order.contact.name).slice(0, 120),
    client: process.env.DELHIVERY_CLIENT_NAME,
    add: address,

    city: String(order.address.city).slice(0, 100),

    state: String(order.address.state).slice(0, 100),

    pin: String(order.address.pincode),

    country: "India",

    phone: String(order.contact.phone),

    order: String(orderId),

    // Razorpay has already collected the payment.
    payment_mode: "Prepaid",

    total_amount: order.amount
      ? Number(order.amount) / 100
      : 0,

    products_desc: productsDescription,

    quantity,

    // Weight in grams.
    weight,

    // CaseWall currently using Surface delivery.
    shipping_mode: "Surface",
  };


  // -------------------------------------------------------
  // Complete Delhivery request payload
  // -------------------------------------------------------

  const payload = {
    shipments: [shipment],

    pickup_location: {
      name: pickupLocation,
    },
  };


  // -------------------------------------------------------
  // Convert payload to Delhivery format
  // -------------------------------------------------------

  const body = new URLSearchParams({
    format: "json",
    data: JSON.stringify(payload),
  });


  // -------------------------------------------------------
  // Safe debugging
  // -------------------------------------------------------
  //
  // The token is intentionally NOT logged.
  //

  console.log("Delhivery shipment request:", {
    orderId,
    pickupLocation,
    shipment,
  });


  // -------------------------------------------------------
  // Send request
  // -------------------------------------------------------

  const res = await fetch(
    `${BASE_URL}/api/cmu/create.json`,
    {
      method: "POST",

      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },

      body,
    }
  );


  // -------------------------------------------------------
  // Read response safely
  // -------------------------------------------------------

  const responseText = await res.text();

  let data = null;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Delhivery returned an invalid response: ${res.status} ${responseText}`
    );
  }


  console.log("Delhivery shipment response:", {
    status: res.status,
    data,
  });


  // -------------------------------------------------------
  // Handle HTTP error
  // -------------------------------------------------------

  if (!res.ok) {
    throw new Error(
      `Delhivery shipment creation failed: ${res.status} ${JSON.stringify(data)}`
    );
  }


  // -------------------------------------------------------
  // Get AWB / waybill (be tolerant to different response shapes)
  // -------------------------------------------------------

  // Common places Delhivery may put package info
  const packageCandidates = [];
  if (Array.isArray(data?.packages)) packageCandidates.push(...data.packages);
  if (Array.isArray(data?.packages_data)) packageCandidates.push(...data.packages_data);
  if (Array.isArray(data?.shipments)) packageCandidates.push(...data.shipments);
  if (Array.isArray(data?.data?.packages)) packageCandidates.push(...data.data.packages);

  const packageResult = packageCandidates[0] || null;

  // Common waybill field names
  const possibleWaybills = [
    packageResult?.waybill,
    packageResult?.awb,
    packageResult?.awb_no,
    packageResult?.ewaybill,
    data?.waybill,
  ].filter(Boolean);

  const waybill = possibleWaybills[0] || null;

  if (!waybill) {
    // Provide more diagnostic info to logs so the caller can see what came back.
    throw new Error(
      `Delhivery did not return a waybill. Response keys: ${JSON.stringify(Object.keys(data || {}))}. Full response: ${JSON.stringify(data)}`
    );
  }

  // -------------------------------------------------------
  // Success
  // -------------------------------------------------------

  return {
    waybill,
    raw: data,
  };
}


// ---------------------------------------------------------
// TRACK DELHIVERY SHIPMENT
// ---------------------------------------------------------
//
// Server-side proxy.
// DELHIVERY_API_TOKEN never reaches the browser.
//
// ---------------------------------------------------------

export async function trackDelhiveryShipment(waybill) {
  const token = getToken();

  if (!waybill) {
    throw new Error("Waybill is required.");
  }


  const url =
    `${BASE_URL}/api/v1/packages/json/?waybill=` +
    encodeURIComponent(waybill);


  const res = await fetch(url, {
    method: "GET",

    headers: {
      Authorization: `Token ${token}`,
    },
  });


  const responseText = await res.text();

  let data = null;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Delhivery tracking returned an invalid response: ${res.status} ${responseText}`
    );
  }


  if (!res.ok) {
    throw new Error(
      `Delhivery tracking failed: ${res.status} ${JSON.stringify(data)}`
    );
  }


  return data;
}