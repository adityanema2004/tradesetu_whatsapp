require("dotenv").config();

// ─────────────────────────────────────────────
//  CONFIG  –  via environment variables
// ─────────────────────────────────────────────
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const GRAPH_API_VERSION = "v22.0"; // ✅ Latest Graph API version (June 2026)
const WHATSAPP_API_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`;
const TEMPLATE_NAME = "new_contract"; // exactly as registered in Meta
const TEMPLATE_LANG = "en"; // language code of your template
const REVIEW_BASE_URL = "https://tradesetu.com/contracts"; // base URL for REVIEW button

// Retry config
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // initial delay; doubles on each retry (exponential backoff)

// ─────────────────────────────────────────────
//  HELPER  –  validate E.164 phone number format
//  Valid:   "919876543210"  (country code + number, no + or spaces)
// ─────────────────────────────────────────────
function validatePhone(phone) {
  const e164Regex = /^\d{10,15}$/;
  if (!e164Regex.test(phone)) {
    throw new Error(
      `Invalid phone number format: "${phone}". Use E.164 without '+' (e.g. "919876543210").`,
    );
  }
}

// ─────────────────────────────────────────────
//  HELPER  –  format commodity rows into one string for {{5}}
//
//  Input array item:
//  {
//    commodity:     string   – e.g. "Maize"
//    quantity:      number   – e.g. 500
//    quantityUnit:  string   – e.g. "MT"
//    price:         number   – e.g. 22000
//    priceUnit:     string   – e.g. "MT"
//  }
//
//  Output: "Maize – 500 MT – Rs. 22,000/MT\nSoybean – 300 MT – Rs. 48,000/MT"
// ─────────────────────────────────────────────
function formatCommodities(commodities = []) {
  if (!Array.isArray(commodities) || commodities.length === 0) {
    throw new Error("At least one commodity is required.");
  }

  return commodities
    .map((c) => {
      const formattedPrice = Number(c.price).toLocaleString("en-IN");
      return `${c.commodity} – ${c.quantity} ${c.quantityUnit} – Rs. ${formattedPrice}/${c.priceUnit}`;
    })
    .join("\n");
}

// ─────────────────────────────────────────────
//  HELPER  –  sleep for exponential backoff
// ─────────────────────────────────────────────
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────
//  HELPER  –  fetch with exponential backoff retry
// ─────────────────────────────────────────────
async function fetchWithRetry(
  url,
  options,
  retries = MAX_RETRIES,
  delayMs = RETRY_DELAY_MS,
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);

      // 429 = rate limited, 5xx = server error → retry
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < retries
      ) {
        console.warn(
          `⚠️  Attempt ${attempt} failed with status ${response.status}. Retrying in ${delayMs}ms...`,
        );
        await sleep(delayMs);
        delayMs *= 2; // exponential backoff
        continue;
      }

      return response;
    } catch (networkError) {
      if (attempt < retries) {
        console.warn(
          `⚠️  Attempt ${attempt} network error: ${networkError.message}. Retrying in ${delayMs}ms...`,
        );
        await sleep(delayMs);
        delayMs *= 2;
      } else {
        throw networkError;
      }
    }
  }
}

// ─────────────────────────────────────────────
//  MAIN  –  send the WhatsApp template message
// ─────────────────────────────────────────────
/**
 * Sends the "new_contract" WhatsApp template to a single recipient.
 *
 * @param {string} recipientPhone              - E.164 without '+', e.g. "919876543210"
 * @param {object} contractData
 * @param {string} contractData.entityName     - {{1}} Name of entity that entered trade
 * @param {string} contractData.entityRole     - {{2}} Role of entity e.g. "Broker"
 * @param {string} contractData.sellerName     - {{3}} Seller entity name
 * @param {string} contractData.buyerName      - {{4}} Buyer entity name
 * @param {Array}  contractData.commodities    - {{5}} Array of commodity objects
 * @param {string} contractData.tradeSetuContractNo - {{6}} TradeSetu Contract Number
 * @param {string} contractData.contractId     - Used in the dynamic REVIEW button URL
 */
async function sendNewContractMessage(recipientPhone, contractData) {
  const {
    entityName,
    entityRole,
    sellerName,
    buyerName,
    commodities,
    tradeSetuContractNo,
    contractId,
  } = contractData;

  // ── Validate required fields ──
  const missingFields = [];
  if (!entityName) missingFields.push("entityName");
  if (!entityRole) missingFields.push("entityRole");
  if (!sellerName) missingFields.push("sellerName");
  if (!buyerName) missingFields.push("buyerName");
  if (!tradeSetuContractNo) missingFields.push("tradeSetuContractNo");
  if (!contractId) missingFields.push("contractId");

  if (missingFields.length > 0) {
    throw new Error(
      `Missing required contract fields: ${missingFields.join(", ")}`,
    );
  }

  // ── Validate phone number ──
  validatePhone(recipientPhone);

  // ── Build commodity string for {{5}} ──
  const commodityText = formatCommodities(commodities);

  // ── Build WhatsApp API payload ──
  const payload = {
    messaging_product: "whatsapp",
    to: recipientPhone,
    type: "template",
    template: {
      name: TEMPLATE_NAME,
      language: { code: TEMPLATE_LANG },
      components: [
        // BODY – all 6 variables
        {
          type: "body",
          parameters: [
            { type: "text", text: entityName }, // {{1}} – Entity that entered the trade
            { type: "text", text: entityRole }, // {{2}} – Role e.g. "Broker"
            { type: "text", text: sellerName }, // {{3}} – Seller entity name
            { type: "text", text: buyerName }, // {{4}} – Buyer entity name
            { type: "text", text: commodityText }, // {{5}} – Formatted commodity lines
            { type: "text", text: tradeSetuContractNo }, // {{6}} – TradeSetu Contract No.
          ],
        },

        // BUTTON – dynamic REVIEW URL
        // ⚠️  In Meta template manager, button URL must be saved as:
        //     https://tradesetu.com/contracts/{{1}}
        //     The contractId below is appended as the dynamic suffix.
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: contractId }],
        },
      ],
    },
  };

  // ── Call Meta API with retry ──
  try {
    const response = await fetchWithRetry(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        `❌ API error for ${recipientPhone}:`,
        JSON.stringify(data, null, 2),
      );
      return { success: false, error: data };
    }

    console.log(`✅ Message sent to ${recipientPhone}:`, data);
    return { success: true, data };
  } catch (error) {
    console.error(`❌ Network error for ${recipientPhone}:`, error.message);
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────
//  HANDLER  –  called when a contract is submitted on the portal
// ─────────────────────────────────────────────
/**
 * @param {object} contract - Full contract object from your portal/database
 *
 * contract shape:
 * {
 *   sellerPhone:          string   – Seller's phone in E.164 (no '+'), e.g. "919876543210"
 *   buyerPhone:           string   – Buyer's phone in E.164 (no '+'), e.g. "919123456789"
 *   entityName:           string   – Name of entity that entered the trade e.g. "A"
 *   entityRole:           string   – Role of entity e.g. "Broker"
 *   sellerName:           string   – Seller entity name e.g. "B"
 *   buyerName:            string   – Buyer entity name e.g. "C"
 *   tradeSetuContractNo:  string   – TradeSetu Contract Number e.g. "123334444444"
 *   contractId:           string   – Used in REVIEW button URL
 *   commodities: [
 *     {
 *       commodity:    string  – e.g. "Maize"
 *       quantity:     number  – e.g. 500
 *       quantityUnit: string  – e.g. "MT"
 *       price:        number  – e.g. 22000
 *       priceUnit:    string  – e.g. "MT"
 *     }
 *   ]
 * }
 */
async function onContractSubmit(contract) {
  const recipients = [
    { label: "Seller", phone: contract.sellerPhone },
    { label: "Buyer", phone: contract.buyerPhone },
    // { label: "Broker", phone: contract.brokerPhone }, // uncomment if broker should also receive it
  ];

  const results = [];

  for (const recipient of recipients) {
    console.log(`📤 Sending to ${recipient.label} (${recipient.phone})...`);
    const result = await sendNewContractMessage(recipient.phone, {
      entityName: contract.entityName,
      entityRole: contract.entityRole,
      sellerName: contract.sellerName,
      buyerName: contract.buyerName,
      commodities: contract.commodities,
      tradeSetuContractNo: contract.tradeSetuContractNo,
      contractId: contract.contractId,
    });
    results.push({
      recipient: recipient.label,
      phone: recipient.phone,
      ...result,
    });
  }

  return results;
}

// ─────────────────────────────────────────────
//  SAMPLE DATA  –  for local testing
// ─────────────────────────────────────────────
const sampleContract = {
  sellerPhone: "919876543210", // Seller's phone in E.164
  buyerPhone: "919123456789", // Buyer's phone in E.164
  entityName: "A", // {{1}}
  entityRole: "Broker", // {{2}}
  sellerName: "B", // {{3}}
  buyerName: "C", // {{4}}
  tradeSetuContractNo: "123334444444", // {{6}}
  contractId: "123334444444", // used in REVIEW button URL
  commodities: [
    // {{5}}
    {
      commodity: "Maize",
      quantity: 500,
      quantityUnit: "MT",
      price: 22000,
      priceUnit: "MT",
    },
    {
      commodity: "Soybean",
      quantity: 300,
      quantityUnit: "MT",
      price: 48000,
      priceUnit: "MT",
    },
    {
      commodity: "Wheat",
      quantity: 200,
      quantityUnit: "MT",
      price: 25500,
      priceUnit: "MT",
    },
  ],
};

// Run the test
onContractSubmit(sampleContract)
  .then((results) =>
    console.log("\n📋 Final Results:", JSON.stringify(results, null, 2)),
  )
  .catch((err) => console.error("Unhandled error:", err));

export default {
  sendNewContractMessage,
  formatCommodities,
  onContractSubmit,
};
