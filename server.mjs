import http from "node:http";
import { publishingSetup } from "./ebay-setup.mjs";
import { linkedEbayProfile, identityScope, refreshScopes } from "./ebay-profile.mjs";
import { fetchOrders } from "./orders.mjs";
import { dailyDue, trackingSettings, runTracking, assertTrackingConnection, findLiveOffer, updatePrice } from "./repricing.mjs";
import { recoveredListingCandidates, mergeRecoveredListings } from "./ebay-recovery.mjs";
import { readFile as readLocalFile, mkdir, stat } from "node:fs/promises";
import { createStorage } from "./storage.mjs";
import { createAccessGuard } from "./access.mjs";
import { accountRequestUrl, ebayErrorMessage } from "./ebay-request.mjs";
import { draftPricing, targetSalePrice, applyTargetPrice } from "./public/pricing.js";
import { compareDraftToMarket, marketSearchTerm } from "./public/market.js";
import { optimizeDraft } from "./public/optimizer.js";
import { normalizeQuotes } from "./cj-quotes.mjs";
import { listingRows, mainListingRowIndex, prepareListing, variationErrors, inventoryPayload, inventoryGroup, aspectMap, categoryErrors, alignVariationAxesToSchema, collapseSingleVariation } from "./public/listing.js";
import { buildDraftDescription, buildEbayListingDescription } from "./public/description.js";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
await loadEnvFile(path.join(__dirname, ".env"));

const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const storePath = path.join(dataDir, "store.json");
const tokenPath = path.join(dataDir, "ebay-token.json");
const cjTokenPath = path.join(dataDir, "cj-token.json");
const statePath = path.join(dataDir, "ebay-oauth-state.json");
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || (process.env.LOCAL_NETWORK === "true" ? "0.0.0.0" : undefined);
const accessGuard = createAccessGuard(process.env);
const { readFile, writeFile, withJobLock } = await createStorage(dataDir, process.env.DATABASE_URL);
let ebayAppTokenCache = null;

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const htmlHeaders = { "content-type": "text/html; charset=utf-8" };
const ebayScopes = [
  identityScope,
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.marketing",
  "https://api.ebay.com/oauth/api_scope/sell.marketing.readonly"
];

const ebayMarketingScope = "https://api.ebay.com/oauth/api_scope/sell.marketing";
const promotedListingsTerms = {
  EBAY_AU: "https://useragreement.ebay.com.au/usragmt/agreement/PROMOTED_LISTINGS_USER_AGREEMENT",
  EBAY_CA: "https://useragreement.ebay.ca/usragmt/agreement/PROMOTED_LISTINGS_USER_AGREEMENT",
  EBAY_FR: "https://useragreement.ebay.fr/usragmt/agreement/PROMOTED_LISTINGS_USER_AGREEMENT",
  EBAY_DE: "https://useragreement.ebay.de/usragmt/agreement/PROMOTED_LISTINGS_USER_AGREEMENT",
  EBAY_IT: "https://useragreement.ebay.it/usragmt/agreement/PROMOTED_LISTINGS_USER_AGREEMENT",
  EBAY_ES: "https://useragreement.ebay.es/usragmt/agreement/PROMOTED_LISTINGS_USER_AGREEMENT",
  EBAY_GB: "https://useragreement.ebay.co.uk/usragmt/agreement/PROMOTED_LISTINGS_USER_AGREEMENT",
  EBAY_US: "https://useragreement.ebay.com/usragmt/agreement/PROMOTED_LISTINGS_USER_AGREEMENT"
};

const ebayAccountSetupPaths = {
  locations: "/sell/inventory/v1/location?limit=100",
  paymentPolicies: "/sell/account/v1/payment_policy",
  returnPolicies: "/sell/account/v1/return_policy",
  fulfillmentPolicies: "/sell/account/v1/fulfillment_policy"
};

const mockProducts = [
  {
    pid: "CJ-BAG-0042",
    sku: "CJBAG0042",
    title: "Foldable Travel Organiser Bag",
    category: "Travel Accessories",
    warehouse: "GB",
    cost: 7.8,
    shipping: 3.45,
    weight: 420,
    stock: 184,
    deliveryDays: 5,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80",
    variants: ["Black", "Navy", "Grey"],
    tags: ["trending", "travel", "fashion", "bag", "bags", "luggage", "organiser"],
    riskyTerms: []
  },
  {
    pid: "CJ-HOME-1180",
    sku: "CJHOME1180",
    title: "Under Sink Expandable Storage Rack",
    category: "Home Storage",
    warehouse: "GB",
    cost: 9.4,
    shipping: 4.1,
    weight: 760,
    stock: 96,
    deliveryDays: 6,
    image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=80",
    variants: ["White", "Matte Black"],
    tags: ["trending", "home", "storage", "kitchen", "bathroom", "organiser"],
    riskyTerms: []
  },
  {
    pid: "CJ-FIT-2201",
    sku: "CJFIT2201",
    title: "Adjustable Resistance Band Set",
    category: "Fitness",
    warehouse: "US",
    cost: 11.7,
    shipping: 5.3,
    weight: 890,
    stock: 61,
    deliveryDays: 7,
    image: "https://images.unsplash.com/photo-1598971639058-a8bfe53d9d9d?auto=format&fit=crop&w=900&q=80",
    variants: ["5 Pack", "11 Pack"],
    tags: ["fitness", "trending", "exercise", "gym", "home workout"],
    riskyTerms: []
  },
  {
    pid: "CJ-ELEC-3900",
    sku: "CJELEC3900",
    title: "Magnetic USB Charging Cable",
    category: "Phone Accessories",
    warehouse: "CN",
    cost: 2.1,
    shipping: 2.8,
    weight: 65,
    stock: 430,
    deliveryDays: 14,
    image: "https://images.unsplash.com/photo-1603539444875-76e7684265f6?auto=format&fit=crop&w=900&q=80",
    variants: ["USB-C", "Lightning", "Micro USB"],
    tags: ["electronics", "trending", "charger", "charging", "cable", "usb", "phone", "gadget"],
    riskyTerms: ["Lightning"]
  },
  {
    pid: "CJ-FASH-5102",
    sku: "CJFASH5102",
    title: "Minimal Crossbody Phone Bag",
    category: "Fashion Accessories",
    warehouse: "GB",
    cost: 5.9,
    shipping: 2.95,
    weight: 210,
    stock: 142,
    deliveryDays: 4,
    image: "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80",
    variants: ["Black", "Tan", "Cream"],
    tags: ["fashion", "trending", "bag", "bags", "accessories", "phone bag"],
    riskyTerms: []
  },
  {
    pid: "CJ-ELEC-4108",
    sku: "CJELEC4108",
    title: "Compact 20W USB-C Wall Charger",
    category: "Electronics",
    warehouse: "US",
    cost: 4.6,
    shipping: 3.2,
    weight: 95,
    stock: 288,
    deliveryDays: 6,
    image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=900&q=80",
    variants: ["White", "Black"],
    tags: ["electronics", "trending", "charger", "usb-c", "phone", "adapter", "wall charger"],
    riskyTerms: []
  },
  {
    pid: "CJ-BEAUTY-7821",
    sku: "CJBEAUTY7821",
    title: "Reusable Silicone Facial Cleansing Pads",
    category: "Beauty",
    warehouse: "GB",
    cost: 2.8,
    shipping: 1.95,
    weight: 80,
    stock: 350,
    deliveryDays: 5,
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=80",
    variants: ["Pink", "Green", "Clear"],
    tags: ["trending", "beauty", "skincare", "fashion", "bathroom"],
    riskyTerms: []
  },
  {
    pid: "CJ-ELEC-4214",
    sku: "CJELEC4214",
    title: "Braided 3-in-1 Fast Charging Cable",
    category: "Electronics",
    warehouse: "GB",
    cost: 3.25,
    shipping: 2.35,
    weight: 85,
    stock: 510,
    deliveryDays: 4,
    image: "https://images.unsplash.com/photo-1625948515291-69613efd103f?auto=format&fit=crop&w=900&q=80",
    variants: ["1m", "2m", "3m"],
    tags: ["electronics", "trending", "charger", "charging", "cable", "usb", "phone", "tech"],
    riskyTerms: []
  },
  {
    pid: "CJ-ELEC-4388",
    sku: "CJELEC4388",
    title: "Wireless Charging Stand",
    category: "Electronics",
    warehouse: "US",
    cost: 8.9,
    shipping: 4.15,
    weight: 280,
    stock: 174,
    deliveryDays: 6,
    image: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=900&q=80",
    variants: ["Black", "White"],
    tags: ["electronics", "trending", "charger", "wireless", "phone", "desk", "gadget"],
    riskyTerms: []
  },
  {
    pid: "CJ-ELEC-4490",
    sku: "CJELEC4490",
    title: "LED Desk Lamp With USB Port",
    category: "Electronics",
    warehouse: "GB",
    cost: 10.2,
    shipping: 4.75,
    weight: 620,
    stock: 88,
    deliveryDays: 5,
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80",
    variants: ["White", "Black", "Silver"],
    tags: ["electronics", "home", "desk", "lamp", "usb", "office"],
    riskyTerms: []
  },
  {
    pid: "CJ-ELEC-4615",
    sku: "CJELEC4615",
    title: "Bluetooth Sleep Headband",
    category: "Electronics",
    warehouse: "CN",
    cost: 6.45,
    shipping: 3.8,
    weight: 160,
    stock: 240,
    deliveryDays: 12,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80",
    variants: ["Grey", "Black", "Blue"],
    tags: ["electronics", "fitness", "travel", "bluetooth", "sleep", "headphones"],
    riskyTerms: []
  },
  {
    pid: "CJ-FASH-5204",
    sku: "CJFASH5204",
    title: "Ribbed Beanie Hat",
    category: "Fashion Accessories",
    warehouse: "GB",
    cost: 3.1,
    shipping: 1.95,
    weight: 110,
    stock: 330,
    deliveryDays: 4,
    image: "https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=900&q=80",
    variants: ["Black", "Grey", "Khaki"],
    tags: ["fashion", "trending", "hat", "winter", "accessories"],
    riskyTerms: []
  },
  {
    pid: "CJ-FASH-5366",
    sku: "CJFASH5366",
    title: "Canvas Tote Bag With Inner Pocket",
    category: "Fashion Accessories",
    warehouse: "GB",
    cost: 4.35,
    shipping: 2.2,
    weight: 180,
    stock: 210,
    deliveryDays: 5,
    image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80",
    variants: ["Natural", "Black", "Olive"],
    tags: ["fashion", "travel", "bag", "bags", "tote", "accessories"],
    riskyTerms: []
  },
  {
    pid: "CJ-FASH-5481",
    sku: "CJFASH5481",
    title: "Adjustable Nylon Belt Bag",
    category: "Fashion Accessories",
    warehouse: "US",
    cost: 5.7,
    shipping: 2.85,
    weight: 190,
    stock: 166,
    deliveryDays: 6,
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    variants: ["Black", "Stone", "Green"],
    tags: ["fashion", "travel", "trending", "bag", "belt bag", "accessories"],
    riskyTerms: []
  },
  {
    pid: "CJ-HOME-1299",
    sku: "CJHOME1299",
    title: "Drawer Divider Storage Set",
    category: "Home Storage",
    warehouse: "GB",
    cost: 4.95,
    shipping: 2.65,
    weight: 250,
    stock: 260,
    deliveryDays: 4,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80",
    variants: ["4 Pack", "8 Pack"],
    tags: ["home", "trending", "storage", "drawer", "organiser", "bedroom"],
    riskyTerms: []
  },
  {
    pid: "CJ-HOME-1350",
    sku: "CJHOME1350",
    title: "Self-Adhesive Cable Clips Pack",
    category: "Home Office",
    warehouse: "GB",
    cost: 1.95,
    shipping: 1.55,
    weight: 45,
    stock: 620,
    deliveryDays: 3,
    image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
    variants: ["20 Pack", "40 Pack"],
    tags: ["home", "electronics", "trending", "cable", "desk", "office", "organiser"],
    riskyTerms: []
  },
  {
    pid: "CJ-HOME-1477",
    sku: "CJHOME1477",
    title: "Silicone Air Fryer Liner",
    category: "Kitchen",
    warehouse: "US",
    cost: 3.75,
    shipping: 2.4,
    weight: 130,
    stock: 398,
    deliveryDays: 5,
    image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80",
    variants: ["Round", "Square"],
    tags: ["home", "trending", "kitchen", "cooking", "silicone"],
    riskyTerms: []
  },
  {
    pid: "CJ-HOME-1592",
    sku: "CJHOME1592",
    title: "Rechargeable Motion Sensor Wardrobe Light",
    category: "Home Lighting",
    warehouse: "CN",
    cost: 5.2,
    shipping: 3.1,
    weight: 155,
    stock: 225,
    deliveryDays: 11,
    image: "https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?auto=format&fit=crop&w=900&q=80",
    variants: ["Warm", "Cool", "Neutral"],
    tags: ["home", "electronics", "lighting", "wardrobe", "storage", "usb"],
    riskyTerms: []
  },
  {
    pid: "CJ-FIT-2320",
    sku: "CJFIT2320",
    title: "Non-Slip Yoga Mat Strap",
    category: "Fitness",
    warehouse: "GB",
    cost: 2.6,
    shipping: 1.85,
    weight: 70,
    stock: 405,
    deliveryDays: 4,
    image: "https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?auto=format&fit=crop&w=900&q=80",
    variants: ["Black", "Purple", "Teal"],
    tags: ["fitness", "yoga", "gym", "exercise", "travel"],
    riskyTerms: []
  },
  {
    pid: "CJ-FIT-2417",
    sku: "CJFIT2417",
    title: "Grip Strength Trainer Set",
    category: "Fitness",
    warehouse: "US",
    cost: 4.8,
    shipping: 2.9,
    weight: 210,
    stock: 134,
    deliveryDays: 6,
    image: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=900&q=80",
    variants: ["Light", "Medium", "Heavy"],
    tags: ["fitness", "trending", "gym", "exercise", "hand grip"],
    riskyTerms: []
  },
  {
    pid: "CJ-FIT-2582",
    sku: "CJFIT2582",
    title: "Cooling Sports Towel",
    category: "Fitness",
    warehouse: "GB",
    cost: 3.4,
    shipping: 2.15,
    weight: 120,
    stock: 312,
    deliveryDays: 4,
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80",
    variants: ["Blue", "Grey", "Pink"],
    tags: ["fitness", "travel", "gym", "sport", "summer"],
    riskyTerms: []
  },
  {
    pid: "CJ-TRAVEL-6031",
    sku: "CJTRAVEL6031",
    title: "Compression Packing Cubes Set",
    category: "Travel Accessories",
    warehouse: "GB",
    cost: 8.6,
    shipping: 3.35,
    weight: 360,
    stock: 153,
    deliveryDays: 5,
    image: "https://images.unsplash.com/photo-1553531580-652231dae097?auto=format&fit=crop&w=900&q=80",
    variants: ["3 Pack", "6 Pack"],
    tags: ["travel", "trending", "luggage", "organiser", "bags", "packing"],
    riskyTerms: []
  },
  {
    pid: "CJ-TRAVEL-6174",
    sku: "CJTRAVEL6174",
    title: "Travel Cable Organiser Case",
    category: "Travel Accessories",
    warehouse: "GB",
    cost: 4.9,
    shipping: 2.45,
    weight: 150,
    stock: 280,
    deliveryDays: 4,
    image: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=900&q=80",
    variants: ["Grey", "Black", "Navy"],
    tags: ["travel", "electronics", "charger", "cable", "organiser", "bag"],
    riskyTerms: []
  },
  {
    pid: "CJ-TRAVEL-6292",
    sku: "CJTRAVEL6292",
    title: "Waterproof Toiletry Bag",
    category: "Travel Accessories",
    warehouse: "US",
    cost: 5.35,
    shipping: 2.95,
    weight: 220,
    stock: 201,
    deliveryDays: 6,
    image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=900&q=80",
    variants: ["Black", "Beige", "Blue"],
    tags: ["travel", "fashion", "bathroom", "bag", "luggage"],
    riskyTerms: []
  },
  {
    pid: "CJ-BEAUTY-7954",
    sku: "CJBEAUTY7954",
    title: "Makeup Brush Cleaning Mat",
    category: "Beauty",
    warehouse: "GB",
    cost: 2.25,
    shipping: 1.7,
    weight: 55,
    stock: 460,
    deliveryDays: 4,
    image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80",
    variants: ["Pink", "Black"],
    tags: ["fashion", "beauty", "trending", "makeup", "skincare"],
    riskyTerms: []
  },
  {
    pid: "CJ-BEAUTY-8066",
    sku: "CJBEAUTY8066",
    title: "Satin Heatless Curling Rod Set",
    category: "Beauty",
    warehouse: "US",
    cost: 4.95,
    shipping: 2.55,
    weight: 115,
    stock: 188,
    deliveryDays: 6,
    image: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80",
    variants: ["Pink", "Champagne", "Black"],
    tags: ["fashion", "beauty", "trending", "hair", "accessories"],
    riskyTerms: []
  }
];

const demoImageGalleries = {
  electronics: [
    "https://images.unsplash.com/photo-1603539444875-76e7684265f6?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1625948515291-69613efd103f?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?auto=format&fit=crop&w=1200&q=85"
  ],
  fashion: [
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=1200&q=85"
  ],
  home: [
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1200&q=85"
  ],
  fitness: [
    "https://images.unsplash.com/photo-1598971639058-a8bfe53d9d9d?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=85"
  ],
  travel: [
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=85"
  ],
  trending: [
    "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1603539444875-76e7684265f6?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=85"
  ]
};

const categoryAliases = {
  trending: ["trending", "popular", "hot", "viral", "winner"],
  fashion: ["fashion", "clothes", "clothing", "style", "bags", "bag", "accessories", "beauty"],
  electronics: ["electronics", "charger", "charging", "cable", "usb", "usb-c", "phone", "adapter", "gadget", "tech"],
  home: ["home", "storage", "kitchen", "bathroom", "organiser", "organizer", "house"],
  fitness: ["fitness", "gym", "exercise", "workout", "sport"],
  travel: ["travel", "luggage", "bag", "bags", "organiser", "organizer"]
};

async function ensureStore() {
  if (process.env.DATABASE_URL) return;
  await mkdir(dataDir, { recursive: true });
  try {
    await stat(storePath);
  } catch {
    await writeFile(storePath, JSON.stringify({ drafts: [], published: [] }, null, 2));
  }
}

async function loadEnvFile(filePath) {
  try {
    const content = await readLocalFile(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // Local development can still run in demo mode without a .env file.
  }
}

async function readStore() {
  await ensureStore();
  return compactStore(JSON.parse(await readFile(storePath, "utf8")));
}

async function saveStore(store) {
  await ensureStore();
  await writeFile(storePath, JSON.stringify(compactStore(store)));
}

function compactStore(store = {}) {
  return {
    ...store,
    drafts: (store.drafts || []).map(compactListing),
    published: (store.published || []).map(compactListing)
  };
}

function compactListing(listing = {}) {
  const next = { ...listing };
  if (Array.isArray(next.supplierImages)) next.supplierImages = next.supplierImages.filter(Boolean).slice(0, 12);
  if (Array.isArray(next.priceHistory)) next.priceHistory = next.priceHistory.slice(0, 50).map(compactHistoryEntry);
  if (Array.isArray(next.listingVariants)) {
    next.listingVariants = next.listingVariants.map((row) => ({
      ...row,
      supplierImages: Array.isArray(row.supplierImages) ? row.supplierImages.filter(Boolean).slice(0, 6) : row.supplierImages
    }));
  }
  if (Array.isArray(next.ebayPublishDetails)) next.ebayPublishDetails = next.ebayPublishDetails.slice(0, 20).map(({ sku, status, offerId, listingId, message }) => ({ sku, status, offerId, listingId, message }));
  if (next.ebayPromotionAdResult) next.ebayPromotionAdResult = promotionResultSummary(next.ebayPromotionAdResult);
  return next;
}

function compactHistoryEntry(entry = {}) {
  const keep = {};
  for (const key of ["at", "checkedAt", "sku", "variantId", "status", "message", "reason", "oldPrice", "price", "salePrice", "calculatedPrice", "confirmedPrice", "landedCost", "margin", "marginPercent", "promotedAdRatePercent", "priceUpdateMethod"]) {
    if (entry[key] != null && entry[key] !== "") keep[key] = entry[key];
  }
  return keep;
}

function promotionResultSummary(result = {}) {
  const responses = Array.isArray(result.responses) ? result.responses : [];
  return {
    responseCount: responses.length,
    errors: responses.flatMap((response) => response.errors || []).slice(0, 5).map((error) => ({
      errorId: error.errorId,
      message: error.message || error.longMessage
    })),
    warnings: responses.flatMap((response) => response.warnings || []).slice(0, 5).map((warning) => ({
      errorId: warning.errorId,
      message: warning.message || warning.longMessage
    }))
  };
}

function localNetworkUrls() {
  const urls = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) urls.push(`http://${entry.address}:${port}`);
    }
  }
  return [...new Set(urls)];
}

function mockProductById(id) {
  return mockProducts.find((product) => product.pid === id);
}

function demoGalleryForProduct(product) {
  const group = primaryProductGroup(product);
  return imageUrlList(product.image, demoImageGalleries[group], demoImageGalleries.trending);
}

function supplierImagesForProduct(product) {
  return imageUrlList(
    product.supplierImages,
    product.images,
    product.galleryImages,
    product.image,
    product.productImageSet,
    product.imageUrls
  );
}

function ensureDraftSupplierImage(draft) {
  if (draft.supplierImages?.length) return draft;
  if (draft.supplierImage) return { ...draft, supplierImages: [draft.supplierImage] };
  if (!String(draft.image || "").startsWith("demo:")) return { ...draft, supplierImages: imageUrlList(draft.image) };
  const product = mockProductById(draft.cjProductId);
  const supplierImages = product ? demoGalleryForProduct(product) : [];
  if (!supplierImages.length) return draft;
  return { ...draft, supplierImage: supplierImages[0], supplierImages };
}

function sendJson(res, status, body) {
  res.writeHead(status, jsonHeaders);
  res.end(JSON.stringify(body));
}

function sendHtml(res, status, body) {
  res.writeHead(status, htmlHeaders);
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function estimateFees(price) {
  return Number((price * 0.128 + 0.3).toFixed(2));
}

function makeDraftFromProduct(product) {
  const landedCost = Number((product.cost + product.shipping).toFixed(2));
  const price = Number((landedCost * 1.55 + estimateFees(landedCost * 1.55)).toFixed(2));
  const image = product.image && !isSampleProduct(product) ? product.image : `demo:${primaryProductGroup(product)}`;
  const supplierImages = supplierImagesForProduct(product);
  const supplierImage = supplierImages[0] || "";
  const draft = {
    id: crypto.randomUUID(),
    source: "cj",
    cjProductId: product.pid,
    sku: `${product.sku}-${Date.now().toString().slice(-5)}`,
    title: product.title,
    description: buildDraftDescription(product),
    category: product.category,
    itemSpecifics: {
      Brand: "Unbranded",
      Type: product.category,
      Condition: "New"
    },
    ebayCategoryId: "",
    ebayCategoryName: "",
    multiVariation: false,
    variationAxes: ["Colour", "Size"],
    listingVariants: [],
    sharedShippingConfirmed: false,
    warehouse: product.warehouse,
    quantity: Math.min(product.stock, 10),
    stock: product.stock,
    cost: product.cost,
    shippingCost: isSampleProduct(product) ? product.shipping : null,
    costCurrency: isSampleProduct(product) ? "GBP" : "USD",
    usdToGbp: null,
    pricingReviewed: false,
    autoPrice: true,
    priceTargetType: "fixed",
    targetProfitGbp: 5,
    targetMarginPercent: 25,
    promotedListingEnabled: false,
    promotedAdRatePercent: 0,
    otherCostsGbp: 0,
    salePrice: isSampleProduct(product) ? price : 0,
    handlingDays: product.deliveryDays > 10 ? 5 : 3,
    deliveryDays: product.deliveryDays,
    image,
    supplierImage,
    supplierImages,
    variants: product.variants,
    riskyTerms: product.riskyTerms,
    status: "draft",
    ebayListingId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return applyTargetPrice(draft);
}

function isSampleProduct(product) {
  return String(product.pid || product.cjProductId || "").startsWith("CJ-");
}

function primaryProductGroup(product) {
  const tags = product.tags || [];
  if (tags.includes("electronics") || String(product.image || "").includes("demo:electronics")) return "electronics";
  if (tags.includes("fashion") || String(product.image || "").includes("demo:fashion")) return "fashion";
  if (tags.includes("home") || String(product.image || "").includes("demo:home")) return "home";
  if (tags.includes("fitness") || String(product.image || "").includes("demo:fitness")) return "fitness";
  if (tags.includes("travel") || String(product.image || "").includes("demo:travel")) return "travel";
  return "trending";
}

function validateDraft(draft) {
  draft = collapseSingleVariation(draft);
  if (draft.multiVariation) {
    const rows = listingRows(draft);
    const rowChecks = rows.map((row) => validateDraft(row));
    const failures = [
      ...variationErrors(draft),
      ...rowChecks.flatMap((check, index) => check.failures.map((failure) => `${rows[index]?.label || rows[index]?.sku || `Variation ${index + 1}`}: ${failure}`))
    ];
    const margins = rowChecks.map((check) => check.marginPercent).filter((value) => value != null);
    const warnings = [...new Set(rowChecks.flatMap((check) => check.warnings))];
    const summary = rowChecks[mainListingRowIndex(draft, rows)] || {};
    if (!/^\d+$/.test(draft.ebayCategoryId || "")) failures.push("Choose an eBay category.");
    return {
      passed: failures.length === 0,
      failures: [...new Set(failures)],
      warnings,
      landedCost: summary.landedCost ?? null,
      estimatedFees: summary.estimatedFees ?? null,
      margin: summary.margin ?? null,
      marginPercent: margins.length ? Math.min(...margins) : null
    };
  }

  const pricing = draftPricing(draft);
  const { landedCost: landed, estimatedFees: fees, margin, marginPercent } = pricing;
  const text = `${draft.title} ${draft.description}`.toLowerCase();
  const blockedTerms = ["nike", "adidas", "apple", "dyson", "stanley", "lego", "disney", "dupe", "replica"];
  const foundBlocked = blockedTerms.filter((term) => text.includes(term));
  const warnings = [];
  const failures = [...pricing.failures];
  if (!/^\d+$/.test(draft.ebayCategoryId || "")) failures.push("Choose an eBay category.");
  if (!isSampleProduct(draft) && !draft.cjVariantId) failures.push("Select a CJ variant.");
  if (draft.autoPrice === true) {
    const target = targetSalePrice(draft);
    if (target.error) failures.push(target.error);
    else if (Number(draft.salePrice) !== target.price) failures.push("Save the draft to update its calculated sale price.");
  }

  if (!draft.title || draft.title.length < 12) failures.push("Title needs more detail.");
  if (draft.title && draft.title.length > 80) failures.push("eBay titles should stay within 80 characters.");
  if (!draft.description || draft.description.length < 40) failures.push("Description is too thin.");
  if (!draft.category) failures.push("Category is required.");
  if (!draft.quantity || draft.quantity < 1) failures.push("Quantity must be at least 1.");
  if (draft.stock != null && draft.quantity > draft.stock) failures.push("Quantity is higher than CJ stock.");
  if (!draft.image) failures.push("At least one image is required.");
  if (!ebayImageUrlsForDraft(ensureDraftSupplierImage(draft))) failures.push("A real supplier image URL is required for eBay publishing.");
  if (draft.priceTargetType === "percent" && marginPercent < Number(draft.targetMarginPercent ?? 15)) warnings.push("Margin is below the target.");
  if ((draft.priceTargetType || "fixed") !== "percent" && margin < Number(draft.targetProfitGbp ?? 5)) warnings.push("Profit is below the target.");
  if (draft.deliveryDays > 10) warnings.push("Delivery estimate is slow for eBay buyers.");
  if (foundBlocked.length) failures.push(`Blocked brand/risk terms found: ${foundBlocked.join(", ")}.`);
  if (draft.riskyTerms?.length) warnings.push(`Supplier data contains review terms: ${draft.riskyTerms.join(", ")}.`);

  return {
    passed: failures.length === 0,
    failures,
    warnings,
    landedCost: landed,
    estimatedFees: fees,
    margin,
    marginPercent
  };
}

function ebayCategoryIdForDraft(draft) {
  if (!/^\d+$/.test(draft.ebayCategoryId || "")) throw new Error("Choose an eBay category before publishing.");
  return draft.ebayCategoryId;
}

function ebayImageUrlsForDraft(draft) {
  const urls = imageUrlList(draft.supplierImages, draft.supplierImage, draft.image);
  return urls.length ? urls.slice(0, 12) : undefined;
}

function ebayListingDescription(draft) {
  const imageCount = ebayImageUrlsForDraft(draft)?.length || 0;
  return buildEbayListingDescription(draft, imageCount);
}

function ebayInventoryItemPayload(draft) {
  return inventoryPayload(draft, ebayImageUrlsForDraft(draft));
}

function ebayOfferPayload(draft) {
  return {
    sku: draft.sku,
    marketplaceId: process.env.EBAY_MARKETPLACE_ID || "EBAY_GB",
    format: "FIXED_PRICE",
    listingDuration: "GTC",
    availableQuantity: Number(draft.quantity),
    categoryId: ebayCategoryIdForDraft(draft),
    merchantLocationKey: process.env.EBAY_MERCHANT_LOCATION_KEY,
    listingDescription: ebayListingDescription(draft),
    pricingSummary: {
      price: {
        currency: "GBP",
        value: Number(draft.salePrice).toFixed(2)
      }
    },
    listingPolicies: {
      paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID,
      returnPolicyId: process.env.EBAY_RETURN_POLICY_ID,
      fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID
    }
  };
}

async function ebayCategorySchema(categoryId, token) {
  const marketplace = process.env.EBAY_MARKETPLACE_ID || "EBAY_GB";
  const tree = await ebayApi(`/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${marketplace}`, token);
  const result = await ebayApi(`/commerce/taxonomy/v1/category_tree/${tree.categoryTreeId}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`, token);
  const aspects = (result.aspects || []).map((aspect) => ({
    localizedAspectName: aspect.localizedAspectName,
    aspectValues: aspect.aspectValues || [],
    aspectConstraint: aspect.aspectConstraint || {}
  }));
  return {
    categoryId,
    variationsSupported: aspects.some((aspect) => aspect.aspectConstraint?.aspectEnabledForVariations),
    aspects
  };
}

async function ebayCategoryFailures(draft, token) {
  if (!draft.ebayCategoryId) return ["Choose an eBay category."];
  try {
    return categoryErrors(draft, await ebayCategorySchema(draft.ebayCategoryId, token));
  } catch (error) {
    return [`Could not confirm eBay category rules before publishing: ${error.message}`];
  }
}

async function alignDraftForEbayCategory(draft, token) {
  if (!draft.multiVariation || !draft.ebayCategoryId) return draft;
  try {
    return alignVariationAxesToSchema(draft, await ebayCategorySchema(draft.ebayCategoryId, token));
  } catch {
    return draft;
  }
}

async function fetchCjProducts(url) {
  const keyword = url.searchParams.get("keyword")?.trim().toLowerCase() || "";
  const category = url.searchParams.get("category") || "";
  const warehouse = url.searchParams.get("warehouse") || "";

  if (process.env.CJ_USE_LIVE === "true") {
    const cjAccessToken = await getUsableCjToken();
    const cjUrl = new URL("https://developers.cjdropshipping.com/api2.0/v1/product/listV2");
    cjUrl.searchParams.set("page", "1");
    cjUrl.searchParams.set("size", "20");
    if (keyword || category) cjUrl.searchParams.set("keyWord", keyword || category);
    const response = await fetch(cjUrl, {
      headers: { "CJ-Access-Token": cjAccessToken }
    });
    if (!response.ok) throw new Error(`CJ API failed with ${response.status}`);
    const body = await response.json();
    const products = cjProductListFromResponse(body.data);
    return { live: true, products: products.map(normalizeCjProduct) };
  }

  const products = mockProducts.filter((product) => {
    const keywordMatch = matchesProduct(product, keyword);
    const categoryMatch = matchesCategory(product, category);
    const warehouseMatch = !warehouse || product.warehouse === warehouse;
    return keywordMatch && categoryMatch && warehouseMatch;
  });
  return { live: false, products };
}

const researchSeeds = {
  trending: ["wireless charger", "crossbody bag", "led desk lamp", "winter jacket", "storage rack"],
  fashion: ["mens jacket", "crossbody bag", "beanie hat", "tote bag"],
  electronics: ["usb c charger", "charging cable", "wireless charger", "led desk lamp"],
  home: ["storage rack", "kitchen organiser", "led lamp", "silicone mat"],
  fitness: ["resistance bands", "yoga mat", "fitness strap"],
  travel: ["travel organiser", "packing cubes", "crossbody bag"]
};

async function researchOpportunities(url) {
  const keyword = url.searchParams.get("keyword")?.trim() || "";
  const category = url.searchParams.get("category") || "trending";
  const terms = keyword ? [keyword] : researchSeeds[category] || researchSeeds.trending;
  const token = await getEbayAppToken();
  const groups = [];
  const recommendations = [];
  for (const term of terms.slice(0, 5)) {
    const ebayItems = await searchEbayMarket(term, token);
    const ebayPrices = ebayItems.map((item) => item.price).filter((price) => price > 0).sort((a, b) => a - b);
    const medianPrice = ebayPrices.length ? ebayPrices[Math.floor(ebayPrices.length / 2)] : null;
    const cjUrl = new URL("http://local/api/products");
    cjUrl.searchParams.set("keyword", term);
    const cjResult = await fetchCjProducts(cjUrl);
    const cjProducts = (cjResult.products || []).slice(0, 8);
    groups.push({ term, medianPrice, ebayItems: ebayItems.slice(0, 5), cjCount: cjProducts.length });
    for (const product of cjProducts) {
      const landed = Number((Number(product.cost || 0) + Number(product.shipping || 0)).toFixed(2));
      const market = medianPrice || ebayItems[0]?.price || 0;
      const fees = market ? estimateFees(market) : 0;
      const roughMargin = Number((market - landed - fees).toFixed(2));
      const match = titleMatchScore(term, product.title || product.productNameEn || "");
      recommendations.push({
        term,
        product,
        ebayMedianPrice: medianPrice,
        ebayExampleCount: ebayItems.length,
        landedEstimate: landed || null,
        estimatedFees: market ? fees : null,
        roughMargin: market ? roughMargin : null,
        score: Number(((roughMargin || 0) + match * 8 + Math.min(Number(product.stock || 0), 50) / 20).toFixed(2)),
        caution: !Number(product.shipping || 0) ? "CJ shipping quote needed before trusting margin." : ""
      });
    }
  }
  recommendations.sort((a, b) => b.score - a.score);
  return {
    category,
    keyword,
    marketplace: process.env.EBAY_MARKETPLACE_ID || "EBAY_GB",
    generatedAt: new Date().toISOString(),
    groups,
    recommendations: recommendations.slice(0, 12)
  };
}

async function searchEbayMarket(term, token, options = {}) {
  const query = new URLSearchParams({
    q: term,
    limit: "12",
    filter: "buyingOptions:{FIXED_PRICE},conditions:{NEW}"
  });
  if (/^\d+$/.test(options.categoryId || "")) query.set("category_ids", options.categoryId);
  const result = await ebayApi(`/buy/browse/v1/item_summary/search?${query}`, token);
  return (result.itemSummaries || []).map((item) => ({
    itemId: item.itemId,
    title: item.title || "eBay item",
    price: Number(item.price?.value || 0),
    currency: item.price?.currency || "GBP",
    image: item.image?.imageUrl || "",
    url: item.itemWebUrl || "",
    seller: item.seller?.username || "",
    shippingCost: Number(item.shippingOptions?.[0]?.shippingCost?.value ?? 0),
    shippingCurrency: item.shippingOptions?.[0]?.shippingCost?.currency || item.price?.currency || "GBP"
  })).filter((item) => item.price > 0);
}

async function draftMarketCheck(draft) {
  const token = await getEbayAppToken();
  const prepared = prepareListing(draft);
  const term = marketSearchTerm(prepared);
  const competitors = await searchEbayMarket(term, token, { categoryId: prepared.ebayCategoryId });
  return {
    generatedAt: new Date().toISOString(),
    marketplace: process.env.EBAY_MARKETPLACE_ID || "EBAY_GB",
    ...compareDraftToMarket(prepared, competitors)
  };
}

function titleMatchScore(term, title) {
  const titleWords = new Set(String(title || "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
  const words = String(term || "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2);
  if (!words.length) return 0;
  return words.filter((word) => titleWords.has(word)).length / words.length;
}

function normalizeCjProduct(product) {
  const supplierImages = imageUrlList(
    product.image,
    product.productImage,
    product.productImageSet,
    product.bigImage,
    product.productImageUrl,
    product.productImageUrls,
    product.variantImg,
    product.imageUrls,
    product.img,
    product.variants
  );
  const image = supplierImages[0] || "";
  const cost = moneyNumber(product.cost ?? product.sellPrice ?? product.productSellPrice ?? product.price ?? 0);
  const shipping = moneyNumber(product.shipping ?? product.shippingCost ?? product.freight ?? product.estimatedShippingCost ?? 0);
  return {
    ...product,
    pid: product.pid || product.productId || product.cjProductId || product.id,
    sku: product.sku || product.productSku || product.productId || product.pid || crypto.randomUUID(),
    title: product.title || product.productNameEn || product.nameEn || product.productName || "CJ product",
    category: product.category || product.categoryName || product.threeCategoryName || product.productType || "CJ Product",
    warehouse: product.warehouse || product.warehouseName || "CJ",
    cost,
    shipping,
    weight: Number(product.weight || product.productWeight || 0),
    stock: Number(product.stock || product.productStock || product.inventory || product.warehouseInventoryNum || 10),
    deliveryDays: Number(product.deliveryDays || product.estimatedDeliveryDays || 7),
    image,
    supplierImages,
    variants: product.variants || product.variantList || [],
    tags: product.tags || [],
    riskyTerms: product.riskyTerms || []
  };
}

function moneyNumber(value) {
  if (typeof value === "number") return value;
  const match = String(value || "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function cjProductListFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.records)) return data.records;
  if (Array.isArray(data?.content)) {
    return data.content.flatMap((item) => {
      if (Array.isArray(item)) return item;
      if (Array.isArray(item.productList)) return item.productList;
      return item ? [item] : [];
    });
  }
  if (Array.isArray(data?.productList)) return data.productList;
  return [];
}

function imageUrlList(...values) {
  const urls = [];
  collectImageUrls(urls, values);
  return [...new Set(urls)].slice(0, 24);
}

function collectImageUrls(urls, value) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(urls, item));
    return;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        collectImageUrls(urls, JSON.parse(trimmed));
        return;
      } catch {
        // Fall through to regex extraction.
      }
    }
    const matches = trimmed.match(/https:\/\/[^"',\]\s]+/g);
    if (matches) matches.forEach((url) => urls.push(url));
    return;
  }
  if (typeof value === "object") {
    [
      "url",
      "image",
      "img",
      "bigImg",
      "bigImage",
      "imageUrl",
      "productImage",
      "productImageUrl",
      "productImageSet",
      "productImageUrls",
      "variantImage"
    ].forEach((key) => collectImageUrls(urls, value[key]));
  }
}

async function enrichProductForDraft(product) {
  if (process.env.CJ_USE_LIVE !== "true") return product;
  const pid = product.pid || product.productId || product.cjProductId;
  const productSku = product.sku || product.productSku;
  if (!pid && !productSku) return product;
  const cjAccessToken = await getUsableCjToken();

  const detailUrl = new URL("https://developers.cjdropshipping.com/api2.0/v1/product/query");
  if (pid) detailUrl.searchParams.set("pid", pid);
  else detailUrl.searchParams.set("productSku", productSku);

  const response = await fetch(detailUrl, {
    headers: { "CJ-Access-Token": cjAccessToken }
  });
  if (!response.ok) return product;

  const body = await response.json();
  const detail = body.data || {};
  return normalizeCjProduct({ ...product, ...detail, cost: detail.sellPrice ?? product.cost });
}

function productHaystack(product) {
  return [product.title, product.category, product.warehouse, ...(product.tags || [])].join(" ").toLowerCase();
}

function matchesProduct(product, keyword) {
  if (!keyword) return true;
  const haystack = productHaystack(product);
  const tags = product.tags || [];
  const terms = keyword.split(/\s+/).filter(Boolean);
  return terms.every((term) => {
    if (haystack.includes(term)) return true;
    return Object.entries(categoryAliases).some(([category, aliases]) => aliases.includes(term) && tags.includes(category));
  });
}

function matchesCategory(product, category) {
  if (!category) return true;
  const tags = product.tags || [];
  return tags.includes(category) || product.category.toLowerCase().includes(category);
}

async function publishDraft(draft) {
  draft = ensureDraftSupplierImage(draft);
  draft = collapseSingleVariation(draft);
  const validation = validateDraft(draft);
  if (!validation.passed) {
    return { ok: false, validation };
  }

  if (process.env.EBAY_LIVE_PUBLISH === "true") {
    if (ebayEnvironment() === "production" && process.env.EBAY_PRODUCTION_CONFIRM !== "REAL_LISTINGS_ENABLED") {
      return {
        ok: false,
        error: "Production eBay publishing is blocked until EBAY_PRODUCTION_CONFIRM=REAL_LISTINGS_ENABLED is set in .env."
      };
    }
    const required = [
      "EBAY_MERCHANT_LOCATION_KEY",
      "EBAY_PAYMENT_POLICY_ID",
      "EBAY_RETURN_POLICY_ID",
      "EBAY_FULFILLMENT_POLICY_ID"
    ];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length) {
      return { ok: false, error: `Live eBay publishing is missing: ${missing.join(", ")}` };
    }
    const token = await getUsableEbayToken();
    draft = await alignDraftForEbayCategory(draft, token);
    draft = collapseSingleVariation(draft);
    const categoryFailures = await ebayCategoryFailures(draft, token);
    if (categoryFailures.length) {
      return {
        ok: false,
        validation: {
          ...validation,
          passed: false,
          failures: [...new Set([...validation.failures, ...categoryFailures])]
        }
      };
    }
    try {
      return await publishDraftToEbay(draft, token);
    } catch (error) {
      return ebayPublishValidationError(error, validateDraft(draft));
    }
  }

  return {
    ok: true,
    listingId: `SIM-${Math.floor(1000000000 + Math.random() * 8999999999)}`,
    draft,
    mode: "simulated"
  };
}

async function publishDraftToEbay(draft, token = null) {
  token ||= await getUsableEbayToken();
  if (draft.multiVariation) {
    const rows = listingRows(draft);
    for (const row of rows) {
      await ebayStage(`uploading inventory item ${row.label || row.sku}`, () => ebayApi(`/sell/inventory/v1/inventory_item/${encodeURIComponent(row.sku)}`, token, {
        method: "PUT",
        body: ebayInventoryItemPayload(row)
      }));
    }

    const groupKey = `CJ-${draft.id}`;
    await ebayStage("creating eBay variation group", () => ebayApi(`/sell/inventory/v1/inventory_item_group/${encodeURIComponent(groupKey)}`, token, {
      method: "PUT",
      body: inventoryGroup(draft, rows)
    }));

    const offers = [];
    for (const row of rows) {
      offers.push(await ebayStage(`creating offer for ${row.label || row.sku}`, () => createOrGetEbayOffer(row, token)));
    }

    const published = await ebayStage("publishing the eBay variation group", () => ebayApi("/sell/inventory/v1/offer/publish_by_inventory_item_group", token, {
      method: "POST",
      body: {
        inventoryItemGroupKey: groupKey,
        marketplaceId: process.env.EBAY_MARKETPLACE_ID || "EBAY_GB"
      }
    }));
    const verification = await verifyPublishedOffers(rows.map((row) => row.sku), token);
    const verifiedListingId = verification.listingIds[0] || null;
    return {
      ok: true,
      listingId: published.listingId || verifiedListingId || groupKey,
      offerIds: offers.map((offer) => offer.offerId).filter(Boolean),
      groupKey,
      publishVerified: verification.allPublished,
      publishDetails: verification.details,
      draft,
      mode: ebayEnvironment()
    };
  }

  const sku = encodeURIComponent(draft.sku);
  await ebayStage("uploading inventory item", () => ebayApi(`/sell/inventory/v1/inventory_item/${sku}`, token, {
    method: "PUT",
    body: ebayInventoryItemPayload(draft)
  }));

  const offer = await ebayStage("creating eBay offer", () => createOrGetEbayOffer(draft, token));
  const offerId = offer.offerId;
  if (!offerId) throw new Error("eBay created the offer but did not return an offerId.");

  const published = await ebayStage("publishing eBay offer", () => ebayApi(`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`, token, {
    method: "POST"
  }));
  const verification = await verifyPublishedOffers([draft.sku], token);
  return {
    ok: true,
    listingId: published.listingId || verification.listingIds[0] || offerId,
    offerId,
    publishVerified: verification.allPublished,
    publishDetails: verification.details,
    draft,
    mode: ebayEnvironment()
  };
}

async function createOrGetEbayOffer(draft, token) {
  try {
    return await ebayApi("/sell/inventory/v1/offer", token, {
      method: "POST",
      body: ebayOfferPayload(draft)
    });
  } catch (error) {
    if (!error.message.includes("Offer entity already exists")) throw error;
    const existing = await ebayApi(`/sell/inventory/v1/offer?sku=${encodeURIComponent(draft.sku)}`, token);
    const offer = existing.offers?.[0];
    if (!offer) throw new Error("eBay says the offer exists, but it was not returned by SKU lookup.");
    if (offer.status === "PUBLISHED") throw new Error("This SKU is already published. Review the existing eBay listing before retrying.");
    await ebayApi(`/sell/inventory/v1/offer/${encodeURIComponent(offer.offerId)}`, token, {
      method: "PUT",
      body: ebayOfferPayload(draft)
    });
    return offer;
  }
}

async function ebayStage(stage, action) {
  try {
    return await action();
  } catch (error) {
    throw new Error(`eBay failed while ${stage}: ${error.message}`);
  }
}

function ebayPublishValidationError(error, validation) {
  const message = String(error?.message || "");
  if (message.includes("25005") || /does not support multi-variation|multi-SKU/i.test(message)) {
    return {
      ok: false,
      validation: {
        ...validation,
        passed: false,
        failures: [...new Set([
          ...(validation.failures || []),
          "This eBay category does not support multi-variation listings. Choose another eBay category that supports variations, or turn off multi-variation and publish one selected variant at a time."
        ])],
        warnings: validation.warnings || []
      }
    };
  }
  throw error;
}

async function verifyPublishedOffers(skus, token) {
  const details = [];
  const listingIds = [];
  for (const sku of skus) {
    try {
      const existing = await ebayApi(`/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`, token);
      const offer = existing.offers?.[0];
      const listingId = offer?.listing?.listingId || offer?.listingId || "";
      if (listingId) listingIds.push(listingId);
      details.push({ sku, status: offer?.status || "UNKNOWN", offerId: offer?.offerId || null, listingId: listingId || null });
    } catch (error) {
      details.push({ sku, status: "VERIFY_FAILED", message: error.message });
    }
  }
  return {
    allPublished: details.length > 0 && details.every((item) => item.status === "PUBLISHED"),
    listingIds: [...new Set(listingIds)],
    details
  };
}

async function withdrawPublishedFromEbay(listing, token = null) {
  if (listing.status === "withdrawn") return { alreadyWithdrawn: true };
  if (listing.publishedMode === "simulated") return { simulated: true };
  if (listing.publishedMode !== ebayEnvironment()) {
    throw new Error(`This listing was published in ${listing.publishedMode || "another mode"}. Switch the app to that eBay environment before withdrawing it.`);
  }
  token ||= await getUsableEbayToken();
  if (listing.ebayGroupKey) {
    return ebayStage("withdrawing eBay variation group", () => ebayApi("/sell/inventory/v1/offer/withdraw_by_inventory_item_group", token, {
      method: "POST",
      body: {
        inventoryItemGroupKey: listing.ebayGroupKey,
        marketplaceId: process.env.EBAY_MARKETPLACE_ID || "EBAY_GB"
      }
    }));
  }
  const offerIds = [...new Set([listing.ebayOfferId, ...(listing.ebayOfferIds || [])].filter(Boolean))];
  if (!offerIds.length) throw new Error("This listing does not have an eBay offer ID saved, so it cannot be withdrawn automatically.");
  const results = [];
  for (const offerId of offerIds) {
    results.push(await ebayStage(`withdrawing eBay offer ${offerId}`, () => ebayApi(`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/withdraw`, token, {
      method: "POST"
    })));
  }
  return { offers: results };
}

function tokenHasScope(token, scope) {
  return String(token.scope || "").split(/\s+/).includes(scope);
}

function assertMarketingReady(listing, token) {
  if (listing.status === "withdrawn") throw new Error("This listing has been withdrawn, so it cannot be promoted.");
  if (listing.publishedMode === "simulated") throw new Error("This is a simulated listing. Publish it to live eBay before applying a promoted listing campaign.");
  if (listing.publishedMode !== ebayEnvironment()) {
    throw new Error(`This listing was published in ${listing.publishedMode || "another mode"}. Switch the app to that eBay environment before promoting it.`);
  }
  if (!tokenHasScope(token, ebayMarketingScope)) {
    throw new Error("Reconnect eBay in Settings so the app can request the new marketing permission, then try applying promotion again.");
  }
}

function promotionListingId(listing) {
  const listingId = String(listing.ebayListingId || "").trim();
  if (!/^\d+$/.test(listingId)) {
    throw new Error("This published record does not have a numeric eBay listing ID yet, so eBay cannot attach a promoted listing campaign to it.");
  }
  return listingId;
}

function validPromotionRate(value) {
  const rate = Number(value ?? 0);
  if (!Number.isFinite(rate) || rate <= 0 || rate >= 100) {
    throw new Error("Enter a promoted listing ad rate greater than 0% and below 100%.");
  }
  return Number(rate.toFixed(2));
}

function campaignIdFromLocation(location) {
  const value = String(location || "");
  return value.split("/").filter(Boolean).pop() || "";
}

function recommendedAdRateFromResponse(body, listingId) {
  const recommendations = [
    ...(body.listingRecommendations || []),
    ...(body.recommendations || [])
  ];
  const recommendation = recommendations.find((item) => String(item.listingId || item.listing?.listingId || "") === listingId) || recommendations[0] || body;
  const ad = recommendation.marketing?.ad || recommendation.ad || recommendation;
  const bidPercentages = ad.bidPercentages || ad.bidPercentageRecommendations || ad.adRates || [];
  const selected = bidPercentages.find((item) => /TRENDING|SUGGESTED|RECOMMENDED/i.test(String(item.basis || item.type || item.name || ""))) || bidPercentages[0];
  const rawRate = selected?.value ?? selected?.bidPercentage ?? selected?.adRate ?? ad.trendingAdRate ?? ad.recommendedAdRate ?? ad.bidPercentage;
  const rate = Number(rawRate);
  return {
    listingId,
    recommendedAdRatePercent: Number.isFinite(rate) && rate > 0 ? Number(rate.toFixed(2)) : null,
    promoteWithAd: ad.promoteWithAd ?? recommendation.promoteWithAd ?? null,
    message: ad.message || recommendation.message || "",
    raw: recommendation
  };
}

async function promotionRecommendationForListing(listing) {
  const token = await getUsableEbayToken();
  assertMarketingReady(listing, token);
  promotedListingsMarketplace();
  const listingId = promotionListingId(listing);
  const body = await ebayApi("/sell/recommendation/v1/find?filter=recommendationTypes:{AD}&limit=10", token, {
    method: "POST",
    body: { listingIds: [listingId] }
  });
  return recommendedAdRateFromResponse(body, listingId);
}

async function promotePublishedListingOnEbay(listing, adRatePercent) {
  const token = await getUsableEbayToken();
  assertMarketingReady(listing, token);
  const marketplaceId = promotedListingsMarketplace();
  const listingId = promotionListingId(listing);
  const bidPercentage = validPromotionRate(adRatePercent);
  if (listing.ebayPromotionCampaignId && listing.ebayPromotionMode === ebayEnvironment()) {
    const updateResult = await ebayApi(`/sell/marketing/v1/ad_campaign/${encodeURIComponent(listing.ebayPromotionCampaignId)}/bulk_update_ads_bid_by_listing_id`, token, {
      method: "POST",
      body: {
        requests: [
          {
            listingId,
            bidPercentage: String(bidPercentage)
          }
        ]
      }
    });
    return {
      listingId,
      campaignId: listing.ebayPromotionCampaignId,
      campaignName: listing.ebayPromotionCampaignName || "Promoted listing campaign",
      bidPercentage,
      appliedAt: new Date().toISOString(),
      adResult: updateResult,
      updatedExistingCampaign: true
    };
  }
  const campaignStamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 12);
  const campaignName = `CJ eBay ${listingId} ${campaignStamp}`;
  let campaign;
  try {
    campaign = await ebayApi("/sell/marketing/v1/ad_campaign", token, {
      method: "POST",
      includeHeaders: true,
      body: {
        marketplaceId,
        campaignName,
        fundingStrategy: {
          fundingModel: "COST_PER_SALE",
          adRateStrategy: "FIXED",
          bidPercentage: String(bidPercentage)
        },
        startDate: new Date(Date.now() + 60_000).toISOString()
      }
    });
  } catch (error) {
    if (/35021|campaign.*name.*exists/i.test(error.message)) {
      throw new Error("eBay says a previous promotion campaign name already exists. Try Apply promotion again; the app now generates a fresh campaign name for each attempt.");
    }
    if (/marketplace.*not supported|145101|35095/i.test(error.message)) {
      throw new Error(`eBay rejected ${marketplaceId} for this promoted listing campaign. Check that Render has EBAY_MARKETPLACE_ID set to EBAY_GB, EBAY_ENV set to production, and that your seller account has accepted the UK Promoted Listings terms: ${promotedListingsTermsUrl(marketplaceId)}`);
    }
    throw error;
  }
  const campaignId = campaign.body?.campaignId || campaign.body?.campaign?.campaignId || campaignIdFromLocation(campaign.headers.location);
  if (!campaignId) throw new Error("eBay created the promotion campaign but did not return a campaign ID.");
  const adResult = await ebayApi(`/sell/marketing/v1/ad_campaign/${encodeURIComponent(campaignId)}/bulk_create_ads_by_listing_id`, token, {
    method: "POST",
    body: {
      requests: [
        {
          listingId,
          bidPercentage: String(bidPercentage)
        }
      ]
    }
  });
  return {
    listingId,
    campaignId,
    campaignName,
    bidPercentage,
    appliedAt: new Date().toISOString(),
    adResult
  };
}

async function applyPromotedListingPrices(listing) {
  if (listing.publishedMode === "simulated") return { status: "simulated", rows: [] };
  const token = await getUsableEbayToken();
  assertMarketingReady(listing, token);
  const rows = listingRows(listing);
  if (!rows.length) throw new Error("This listing has no priced rows to update on eBay.");
  const request = (pathname, options) => ebayApi(pathname, token, options);
  const updates = [];
  for (const row of rows) {
    const target = targetSalePrice(row);
    if (!target.price) throw new Error(target.error || `Could not calculate a promoted price for ${row.sku}.`);
    const pricing = draftPricing({ ...row, salePrice: target.price });
    if (pricing.failures.length) throw new Error(pricing.failures.join(" "));
    const offer = await findLiveOffer(request, listing, row);
    const oldPrice = Number(offer.pricingSummary?.price?.value);
    const event = {
      at: new Date().toISOString(),
      checkedAt: new Date().toISOString(),
      sku: row.sku,
      variantId: row.cjVariantId || "",
      oldPrice: Number.isFinite(oldPrice) ? oldPrice : null,
      price: target.price,
      salePrice: target.price,
      calculatedPrice: target.price,
      landedCost: pricing.landedCost,
      margin: pricing.margin,
      marginPercent: pricing.marginPercent,
      promotedAdRatePercent: row.promotedAdRatePercent,
      status: "unchanged",
      reason: "Promotion ad rate applied to eBay price"
    };
    if (Math.round(Number(oldPrice || 0) * 100) !== Math.round(target.price * 100)) {
      let priceUpdateMethod = "bulk";
      await updatePrice(request, row, offer, target.price, {
        fallback: async () => {
          priceUpdateMethod = "offer";
          await ebayApi(`/sell/inventory/v1/offer/${encodeURIComponent(offer.offerId)}`, token, {
            method: "PUT",
            body: ebayOfferPayload({
              ...row,
              salePrice: target.price,
              quantity: row.quantity || offer.availableQuantity || listing.quantity
            })
          });
        }
      });
      const confirmed = await findLiveOffer(request, listing, row);
      const confirmedPrice = Number(confirmed.pricingSummary?.price?.value);
      event.confirmedPrice = Number.isFinite(confirmedPrice) ? confirmedPrice : null;
      if (confirmed.pricingSummary?.price?.currency !== "GBP" || Math.round(Number(confirmedPrice || 0) * 100) !== Math.round(target.price * 100)) {
        throw new Error(`eBay did not confirm the updated promoted price for ${row.sku}.`);
      }
      event.status = "updated";
      event.priceUpdateMethod = priceUpdateMethod;
    } else {
      event.confirmedPrice = Number.isFinite(oldPrice) ? oldPrice : null;
    }
    const targetRow = listing.multiVariation ? listing.listingVariants.find((item) => item.cjVariantId === row.cjVariantId || item.sku === row.sku) : listing;
    if (targetRow) targetRow.salePrice = target.price;
    updates.push(event);
  }
  if (listing.multiVariation) {
    const prices = (listing.listingVariants || []).filter((item) => item.enabled).map((item) => Number(item.salePrice)).filter(Number.isFinite);
    if (prices.length) listing.salePrice = Math.min(...prices);
  }
  listing.priceHistory = [...updates, ...(listing.priceHistory || [])].slice(0, 50);
  return {
    status: updates.some((event) => event.status === "updated") ? "updated" : "unchanged",
    at: new Date().toISOString(),
    rows: updates
  };
}

function ebayEnvironment() {
  return process.env.EBAY_ENV === "production" ? "production" : "sandbox";
}

function ebayAuthEndpoint() {
  return ebayEnvironment() === "production" ? "https://auth.ebay.com/oauth2/authorize" : "https://auth.sandbox.ebay.com/oauth2/authorize";
}

function ebayTokenEndpoint() {
  return ebayEnvironment() === "production" ? "https://api.ebay.com/identity/v1/oauth2/token" : "https://api.sandbox.ebay.com/identity/v1/oauth2/token";
}

function ebayApiBaseUrl() {
  return ebayEnvironment() === "production" ? "https://api.ebay.com" : "https://api.sandbox.ebay.com";
}

function ebayMarketplaceId() {
  const raw = String(process.env.EBAY_MARKETPLACE_ID || "EBAY_GB").trim().toUpperCase();
  const aliases = {
    GB: "EBAY_GB",
    UK: "EBAY_GB",
    UNITED_KINGDOM: "EBAY_GB",
    US: "EBAY_US",
    USA: "EBAY_US",
    UNITED_STATES: "EBAY_US"
  };
  return aliases[raw] || raw;
}

function promotedListingsMarketplace() {
  const marketplaceId = ebayMarketplaceId();
  if (!promotedListingsTerms[marketplaceId]) {
    throw new Error(`Promoted Listings is not configured for marketplace ${marketplaceId}. Set EBAY_MARKETPLACE_ID to EBAY_GB for UK listings.`);
  }
  return marketplaceId;
}

function promotedListingsTermsUrl(marketplaceId = ebayMarketplaceId()) {
  return promotedListingsTerms[marketplaceId] || promotedListingsTerms.EBAY_GB;
}

function marketplaceDeletionEndpoint() {
  return process.env.EBAY_MARKETPLACE_DELETION_ENDPOINT || "";
}

function marketplaceDeletionVerificationToken() {
  return process.env.EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN || "";
}

function marketplaceDeletionChallengeResponse(challengeCode) {
  const endpoint = marketplaceDeletionEndpoint();
  const token = marketplaceDeletionVerificationToken();
  if (!endpoint || !token) {
    throw new Error("Set EBAY_MARKETPLACE_DELETION_ENDPOINT and EBAY_MARKETPLACE_DELETION_VERIFICATION_TOKEN in .env.");
  }
  return createHash("sha256").update(challengeCode).update(token).update(endpoint).digest("hex");
}

function hasRealValue(value, placeholder) {
  return Boolean(value && value !== placeholder && !value.startsWith("paste_"));
}

function ebayConfigStatus() {
  const clientId = process.env.EBAY_CLIENT_ID || "";
  const clientSecret = process.env.EBAY_CLIENT_SECRET || "";
  const runame = process.env.EBAY_RUNAME || "";
  return {
    environment: ebayEnvironment(),
    clientIdReady: hasRealValue(clientId, ""),
    clientSecretReady: hasRealValue(clientSecret, ""),
    runameReady: hasRealValue(runame, ""),
    runame,
    marketplaceId: process.env.EBAY_MARKETPLACE_ID || "EBAY_GB",
    scopes: ebayScopes
  };
}

async function ebayTokenStatus() {
  try {
    const token = JSON.parse(await readFile(tokenPath, "utf8"));
    return {
      connected: Boolean(token.access_token),
      hasRefreshToken: Boolean(token.refresh_token),
      environment: token.environment || ebayEnvironment(),
      savedAt: token.savedAt || null,
      scopeCount: token.scope ? token.scope.split(" ").filter(Boolean).length : 0
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      connected: false,
      hasRefreshToken: false,
      environment: ebayEnvironment(),
      savedAt: null,
      scopeCount: 0
    };
  }
}

async function readCjToken() {
  try {
    return JSON.parse(await readFile(cjTokenPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

function tokenFreshUntil(expiryDate) {
  if (!expiryDate) return false;
  return Date.now() < new Date(expiryDate).getTime() - 60_000;
}

async function saveCjToken(data) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(
    cjTokenPath,
    JSON.stringify(
      {
        accessToken: data.accessToken,
        accessTokenExpiryDate: data.accessTokenExpiryDate,
        refreshToken: data.refreshToken,
        refreshTokenExpiryDate: data.refreshTokenExpiryDate,
        savedAt: new Date().toISOString()
      },
      null,
      2
    )
  );
}

async function cjAuthRequest(pathname, body) {
  const response = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/authentication/${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok || result.result === false || result.success === false) {
    throw new Error(result.message || `CJ authentication failed with ${response.status}`);
  }
  return result.data;
}

async function connectCjWithApiKey(apiKey = process.env.CJ_API_KEY) {
  if (!apiKey) throw new Error("Add CJ_API_KEY to .env first.");
  const data = await cjAuthRequest("getAccessToken", { apiKey });
  await saveCjToken(data);
  return data;
}

async function getUsableCjToken() {
  if (process.env.CJ_ACCESS_TOKEN) return process.env.CJ_ACCESS_TOKEN;
  const token = await readCjToken();
  if (token?.accessToken && tokenFreshUntil(token.accessTokenExpiryDate)) return token.accessToken;
  if (token?.refreshToken && tokenFreshUntil(token.refreshTokenExpiryDate)) {
    const data = await cjAuthRequest("refreshAccessToken", { refreshToken: token.refreshToken });
    await saveCjToken(data);
    return data.accessToken;
  }
  if (process.env.CJ_API_KEY) {
    const data = await connectCjWithApiKey();
    return data.accessToken;
  }
  throw new Error("CJ is not connected. Add CJ_API_KEY to .env or connect CJ first.");
}

async function cjTokenStatus() {
  const token = await readCjToken();
  return {
    apiKeyReady: Boolean(process.env.CJ_API_KEY),
    connected: Boolean(process.env.CJ_ACCESS_TOKEN || token?.accessToken),
    expiresAt: token?.accessTokenExpiryDate || null,
    hasRefreshToken: Boolean(token?.refreshToken)
  };
}

async function readEbayToken() {
  try {
    return JSON.parse(await readFile(tokenPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

function ebayTokenIsFresh(token) {
  if (!token?.access_token || !token.savedAt || !token.expires_in) return Boolean(token?.access_token);
  const savedAt = new Date(token.savedAt).getTime();
  const expiresAt = savedAt + Number(token.expires_in) * 1000;
  return Date.now() < expiresAt - 60_000;
}

async function refreshEbayToken(token) {
  if (!token?.refresh_token) throw new Error("Connect eBay Sandbox again before checking account setup.");
  const status = ebayConfigStatus();
  if (!status.clientSecretReady) throw new Error("Paste your eBay Cert ID into EBAY_CLIENT_SECRET first.");

  const credentials = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(ebayTokenEndpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${credentials}`
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
      scope: refreshScopes(token, ebayScopes)
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error_description || body.error || `eBay token refresh failed with ${response.status}`);

  const refreshed = {
    ...token,
    token_type: body.token_type || token.token_type,
    access_token: body.access_token,
    refresh_token: body.refresh_token || token.refresh_token,
    expires_in: body.expires_in,
    scope: body.scope || token.scope,
    savedAt: new Date().toISOString()
  };
  await writeFile(tokenPath, JSON.stringify(refreshed, null, 2));
  return refreshed;
}

async function getUsableEbayToken() {
  const token = await readEbayToken();
  if (!token?.access_token) throw new Error("Connect eBay before checking account setup.");
  if (token.environment !== ebayEnvironment()) throw new Error("Reconnect eBay for the selected environment before checking account setup.");
  return ebayTokenIsFresh(token) ? token : refreshEbayToken(token);
}

async function getEbayAppToken() {
  const status = ebayConfigStatus();
  if (!status.clientIdReady || !status.clientSecretReady) throw new Error("Set eBay App ID and Cert ID before using product research.");
  if (ebayAppTokenCache?.access_token && Date.now() < ebayAppTokenCache.expiresAt - 60_000) return ebayAppTokenCache;
  const credentials = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(ebayTokenEndpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${credentials}`
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope"
    })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error_description || body.error || `eBay app token failed with ${response.status}`);
  ebayAppTokenCache = {
    access_token: body.access_token,
    token_type: body.token_type,
    expiresAt: Date.now() + Number(body.expires_in || 0) * 1000
  };
  return ebayAppTokenCache;
}

async function ebayApi(pathname, token, options = {}) {
  const marketplaceId = ebayMarketplaceId();
  const url = accountRequestUrl(pathname, ebayApiBaseUrl(), marketplaceId, options.method || "GET");
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    method: options.method || "GET",
    headers: {
      authorization: `Bearer ${token.access_token}`,
      accept: "application/json",
      "accept-language": process.env.EBAY_LOCALE || "en-GB",
      "content-language": process.env.EBAY_LOCALE || "en-GB",
      "content-type": "application/json",
      "x-ebay-c-marketplace-id": marketplaceId
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(ebayErrorMessage(body, response.status));
  if (options.includeHeaders) {
    return {
      body,
      headers: Object.fromEntries(response.headers.entries())
    };
  }
  return body;
}

async function optIntoEbaySellingPolicies() {
  const token = await getUsableEbayToken();
  await ebayApi("/sell/account/v1/program/opt_in", token, {
    method: "POST",
    body: { programType: "SELLING_POLICY_MANAGEMENT" }
  });
  return { optedIn: true };
}

async function checkEbayAccountSetup() {
  const token = await getUsableEbayToken();
  const [locations, paymentPolicies, returnPolicies, fulfillmentPolicies] = await Promise.all([
    ebayApi(ebayAccountSetupPaths.locations, token),
    ebayApi(ebayAccountSetupPaths.paymentPolicies, token),
    ebayApi(ebayAccountSetupPaths.returnPolicies, token),
    ebayApi(ebayAccountSetupPaths.fulfillmentPolicies, token)
  ]);
  return {
    marketplaceId: process.env.EBAY_MARKETPLACE_ID || "EBAY_GB",
    locations: locations.locations || [],
    paymentPolicies: paymentPolicies.paymentPolicies || [],
    returnPolicies: returnPolicies.returnPolicies || [],
    fulfillmentPolicies: fulfillmentPolicies.fulfillmentPolicies || []
  };
}

async function ebayRecoveryCandidates(store) {
  const token = await getUsableEbayToken();
  const offers = [];
  const limit = 200;
  for (let offset = 0; offset < 1000; offset += limit) {
    const page = await ebayApi(`/sell/inventory/v1/offer?limit=${limit}&offset=${offset}`, token);
    const rows = page.offers || [];
    offers.push(...rows);
    const total = Number(page.total || rows.length);
    if (!rows.length || offers.length >= total) break;
  }
  const details = [];
  for (const offer of offers) {
    let inventory = {};
    if (offer.sku) {
      try {
        inventory = await ebayApi(`/sell/inventory/v1/inventory_item/${encodeURIComponent(offer.sku)}`, token);
      } catch {
        inventory = {};
      }
    }
    details.push({ offer, inventory, sku: offer.sku });
  }
  return recoveredListingCandidates(details, {
    environment: ebayEnvironment(),
    marketplaceId: ebayMarketplaceId(),
    existingPublished: store.published || []
  });
}

async function saveOauthState(state) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(statePath, JSON.stringify({ state, createdAt: new Date().toISOString() }, null, 2));
}

async function readOauthState() {
  try {
    return JSON.parse(await readFile(statePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
}

async function buildEbayAuthUrl() {
  const status = ebayConfigStatus();
  if (!status.clientIdReady || !status.runameReady) {
    throw new Error("Set EBAY_CLIENT_ID and EBAY_RUNAME in .env first.");
  }
  const state = crypto.randomUUID();
  await saveOauthState(state);
  const authUrl = new URL(ebayAuthEndpoint());
  authUrl.searchParams.set("client_id", process.env.EBAY_CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", process.env.EBAY_RUNAME);
  authUrl.searchParams.set("scope", ebayScopes.join(" "));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "login");
  return authUrl.toString();
}

async function exchangeEbayCode(code, returnedState) {
  const status = ebayConfigStatus();
  if (!status.clientSecretReady) {
    return { ok: false, reason: "missing_secret" };
  }

  const expectedState = await readOauthState();
  if (!expectedState?.state || !returnedState || expectedState.state !== returnedState ||
      Date.now() - Date.parse(expectedState.createdAt) > 10 * 60_000) {
    return { ok: false, reason: "state_mismatch" };
  }

  const credentials = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.EBAY_RUNAME
  });
  const response = await fetch(ebayTokenEndpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: `Basic ${credentials}`
    },
    body
  });
  const token = await response.json();
  if (!response.ok) {
    return { ok: false, reason: "exchange_failed", detail: token.error_description || token.error || `HTTP ${response.status}` };
  }

  await mkdir(dataDir, { recursive: true });
  await writeFile(
    tokenPath,
    JSON.stringify(
      {
        environment: ebayEnvironment(),
        connectionId: crypto.randomUUID(),
        token_type: token.token_type,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_in: token.expires_in,
        refresh_token_expires_in: token.refresh_token_expires_in,
        scope: token.scope || ebayScopes.join(" "),
        savedAt: new Date().toISOString()
      },
      null,
      2
    )
  );
  await writeFile(statePath, JSON.stringify({}));
  return { ok: true };
}

async function exchangeEbayCodeSafely(code, state) {
  try {
    return await exchangeEbayCode(code, state);
  } catch (error) {
    if (error.message === "fetch failed") {
      return {
        ok: false,
        reason: "network_failed",
        detail: "The app could not reach eBay from this local server. The code is valid, but the token exchange needs internet access from Node."
      };
    }
    throw error;
  }
}

function extractEbayCode(input = "") {
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  try {
    const pastedUrl = new URL(trimmed);
    return {
      code: pastedUrl.searchParams.get("code") || trimmed,
      state: pastedUrl.searchParams.get("state") || ""
    };
  } catch {
    return { code: trimmed, state: "" };
  }
}

async function handleEbayCallback(req, res, url) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    sendHtml(res, 400, oauthPage("eBay declined the connection", `eBay returned: ${escapeHtml(error)}`));
    return;
  }

  if (!code) {
    sendHtml(res, 400, oauthPage("No authorization code received", "Try the Connect eBay Sandbox button again."));
    return;
  }

  try {
    const result = await exchangeEbayCodeSafely(code, state);
    if (result.ok) {
      sendHtml(res, 200, oauthPage("eBay connected", "Your connection has been saved. Return to the dashboard to continue."));
      return;
    }
    if (result.reason === "missing_secret") {
      sendHtml(
        res,
        200,
        oauthPage(
          "Authorization code received",
          "Your Client Secret is not in .env yet. Paste your Cert ID into EBAY_CLIENT_SECRET, then run the OAuth login again."
        )
      );
      return;
    }
    sendHtml(res, 400, oauthPage("eBay token exchange failed", result.detail || result.reason));
  } catch (error) {
    sendHtml(res, 500, oauthPage("eBay token exchange failed", error.message));
  }
}

function oauthPage(title, message) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f8f6; color: #18201d; }
      main { width: min(620px, calc(100% - 32px)); background: white; border: 1px solid #d9dfdc; border-radius: 8px; padding: 28px; box-shadow: 0 18px 45px rgba(24,32,29,.08); }
      h1 { margin-top: 0; }
      p { line-height: 1.55; color: #66716d; }
      a { color: #116149; font-weight: 800; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <p><a href="/">Return to dashboard</a></p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function cjPriceQuote(input) {
  if (!input.pid || !input.vid) throw new Error("Select a CJ variant first.");
  const token = await getUsableCjToken();
  const detailResponse = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/query?pid=${encodeURIComponent(input.pid)}`, { headers: { "CJ-Access-Token": token }, signal: AbortSignal.timeout(20000) });
  const detail = await detailResponse.json();
  if (!detailResponse.ok || detail.code !== 200) throw new Error(detail.message || "CJ product lookup failed.");
  const variant = (detail.data?.variants || []).find((item) => item.vid === input.vid);
  if (!variant || variant.variantSellPrice == null || variant.variantSellPrice === "" || !Number.isFinite(Number(variant.variantSellPrice))) throw new Error("CJ did not return a price for this variant.");
  const freightResponse = await fetch("https://developers.cjdropshipping.com/api2.0/v1/logistic/freightCalculate", {
    method: "POST", signal: AbortSignal.timeout(20000),
    headers: { "CJ-Access-Token": token, "content-type": "application/json" },
    body: JSON.stringify({ startCountryCode: "CN", endCountryCode: "GB", ...(input.postcode ? { zip: String(input.postcode).trim() } : {}), products: [{ vid: variant.vid, quantity: 1 }] })
  });
  const freight = await freightResponse.json();
  const shippingError = !freightResponse.ok || freight.code !== 200 ? freight.message || "CJ shipping quote failed." : null;
  return { cost: Number(variant.variantSellPrice), currency: "USD", variantId: variant.vid, quotes: shippingError ? [] : normalizeQuotes(freight.data), shippingError, origin: "CN", destination: "GB", quantity: 1, quotedAt: new Date().toISOString() };
}

let repricingQueued = false;
function enqueueRepricing(options) {
  if (repricingQueued) return false;
  repricingQueued = true;
  const operation = draftQueue.then(() => withJobLock(() => runTracking({
    readStore, saveStore,
    quote: (row) => cjPriceQuote({ pid: row.cjProductId, vid: row.cjVariantId, postcode: row.quotePostcode }),
    async connect(settings, preview) {
      const token = await getUsableEbayToken();
      assertTrackingConnection(settings, { environment: ebayEnvironment(), connectionId: token.connectionId, liveEnabled: process.env.EBAY_LIVE_PUBLISH === "true", productionConfirmed: process.env.EBAY_PRODUCTION_CONFIRM === "REAL_LISTINGS_ENABLED" }, preview);
      return { request: (pathname, options) => ebayApi(pathname, token, options) };
    }
  }, options)));
  draftQueue = operation.catch(() => { console.error("Price tracking could not complete; inspect storage and tracking status."); }).finally(() => { repricingQueued = false; });
  return true;
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/repricing") {
      const store = await readStore();
      const { connectionId, ...settings } = store.repricing || { enabled: false, autoApply: false, maxChangePercent: 20, rules: {} };
      if (settings.run?.status === "running" && !repricingQueued) settings.run = { ...settings.run, status: "interrupted", message: "The server restarted during a check. Preview prices to reconcile with eBay before retrying." };
      sendJson(res, 200, { settings, running: repricingQueued, environment: ebayEnvironment(), listings: (store.published || []).filter((item) => item.publishedMode === ebayEnvironment()).map((item) => ({ id: item.id, title: item.title, sku: item.sku, salePrice: item.salePrice, targetMarginPercent: item.targetMarginPercent, usdToGbp: item.usdToGbp, cjShippingService: item.cjShippingService, multiVariation: item.multiVariation, history: item.priceHistory || [] })) });
      return;
    }
    if (req.method === "PUT" && url.pathname === "/api/repricing") {
      const input = await readBody(req);
      const store = await readStore();
      const token = await getUsableEbayToken();
      const settings = trackingSettings(input, store.published || [], { environment: ebayEnvironment(), connectionId: token.connectionId });
      store.repricing = { ...store.repricing, ...settings };
      await saveStore(store);
      sendJson(res, 200, { saved: true });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/repricing/run") {
      const input = await readBody(req);
      const settings = (await readStore()).repricing;
      if (!settings) { sendJson(res, 400, { error: "Save price tracking settings first." }); return; }
      if (input.scheduled === true && !dailyDue(settings)) { sendJson(res, 200, { skipped: true }); return; }
      const started = enqueueRepricing({ scheduled: input.scheduled === true, preview: input.scheduled === true ? !settings.autoApply : input.preview !== false });
      sendJson(res, 202, { started, running: true });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/orders") {
      res.setHeader("Cache-Control", "no-store");
      try {
        const token = await getUsableEbayToken();
        const store = await readStore();
        sendJson(res, 200, await fetchOrders(url.searchParams, (pathname) => ebayApi(pathname, token), store.published || [], ebayEnvironment()));
      } catch (error) {
        sendJson(res, 400, { error: `Orders could not be loaded. ${error.message} If eBay denies access, reconnect eBay in Settings to approve order access.` });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/cj/price-quote") {
      sendJson(res, 200, await cjPriceQuote(await readBody(req)));
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/ebay/locations/cj-jinhua") {
      const token = await getUsableEbayToken();
      const key = "CJ_CN_JINHUA";
      const locationPath = `/sell/inventory/v1/location/${key}`;
      const result = await ebayApi("/sell/inventory/v1/location?limit=100", token);
      const existing = (result.locations || []).find((item) => item.merchantLocationKey === key);
      if (existing) {
        const address = existing.location?.address || {};
        if (address.country !== "CN" || address.city !== "Jinhua" || address.stateOrProvince !== "Zhejiang" || existing.merchantLocationStatus !== "ENABLED") {
          sendJson(res, 409, { error: "This location key already exists with different details or is disabled. Review it before using it." });
          return;
        }
      } else {
        await ebayApi(locationPath, token, {
          method: "POST",
          body: {
            name: "CJ Jinhua dispatch",
            merchantLocationStatus: "ENABLED",
            locationTypes: ["WAREHOUSE"],
            location: { address: { city: "Jinhua", stateOrProvince: "Zhejiang", country: "CN" } }
          }
        });
      }
      sendJson(res, 200, { merchantLocationKey: key, environment: ebayEnvironment(), created: !existing });
      return;
    }
    if (url.pathname === "/api/ebay/marketplace-account-deletion") {
      if (req.method === "GET") {
        const challengeCode = url.searchParams.get("challenge_code");
        if (!challengeCode) {
          sendJson(res, 400, { error: "Missing challenge_code." });
          return;
        }
        sendJson(res, 200, { challengeResponse: marketplaceDeletionChallengeResponse(challengeCode) });
        return;
      }

      if (req.method === "POST") {
        await readBody(req);
        sendJson(res, 200, { received: true });
        return;
      }
    }

    if (req.method === "GET" && url.pathname === "/api/ebay/auth-url") {
      sendJson(res, 200, { url: await buildEbayAuthUrl(), scopes: ebayScopes, environment: ebayEnvironment() });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/ebay/exchange-code") {
      const body = await readBody(req);
      const extracted = extractEbayCode(body.callbackUrl || body.code);
      if (!extracted?.code) {
        sendJson(res, 400, { error: "Paste the full eBay callback URL or authorization code first." });
        return;
      }

      const result = await exchangeEbayCodeSafely(extracted.code, extracted.state);
      if (!result.ok) {
        sendJson(res, 400, { error: result.detail || result.reason || "Could not exchange the eBay authorization code." });
        return;
      }

      sendJson(res, 200, { connected: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/ebay/account-setup") {
      try {
        sendJson(res, 200, await checkEbayAccountSetup());
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (url.pathname === "/api/ebay/recover-listings") {
      try {
        const store = await readStore();
        const candidates = await ebayRecoveryCandidates(store);
        if (req.method === "GET") {
          sendJson(res, 200, { candidates, environment: ebayEnvironment(), marketplaceId: ebayMarketplaceId() });
          return;
        }
        if (req.method === "POST") {
          const body = await readBody(req);
          const selectedIds = new Set(Array.isArray(body.ids) ? body.ids.map(String) : []);
          const selected = candidates.filter((candidate) => selectedIds.has(candidate.id));
          if (!selected.length) {
            sendJson(res, 400, { error: "Select at least one eBay listing to import." });
            return;
          }
          store.published = mergeRecoveredListings(store.published || [], selected);
          await saveStore(store);
          sendJson(res, 200, { imported: selected.length, published: store.published, candidates });
          return;
        }
      } catch (error) {
        sendJson(res, 400, { error: error.message });
        return;
      }
    }

    if (req.method === "POST" && url.pathname === "/api/ebay/opt-in-selling-policies") {
      try {
        sendJson(res, 200, await optIntoEbaySellingPolicies());
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === "GET" && (url.pathname === "/api/ebay/categories" || url.pathname === "/api/ebay/category-suggestions")) {
      try {
        const token = await getUsableEbayToken();
        const marketplace = process.env.EBAY_MARKETPLACE_ID || "EBAY_GB";
        const tree = await ebayApi(`/commerce/taxonomy/v1/get_default_category_tree_id?marketplace_id=${marketplace}`, token);
        const query = url.searchParams.get("q") || "";
        const suggestions = await ebayApi(`/commerce/taxonomy/v1/category_tree/${tree.categoryTreeId}/get_category_suggestions?q=${encodeURIComponent(query)}`, token);
        sendJson(res, 200, {
          categories: (suggestions.categorySuggestions || []).map((item) => ({
            id: item.category.categoryId,
            name: [...(item.categoryTreeNodeAncestors || []).map((node) => node.categoryName), item.category.categoryName].join(" / ")
          }))
        });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/ebay/category-aspects") {
      try {
        const categoryId = url.searchParams.get("categoryId") || "";
        if (!/^\d+$/.test(categoryId)) throw new Error("Choose an eBay category first.");
        const token = await getUsableEbayToken();
        sendJson(res, 200, await ebayCategorySchema(categoryId, token));
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/cj/connect") {
      try {
        const body = await readBody(req);
        const token = await connectCjWithApiKey(body.apiKey || process.env.CJ_API_KEY);
        sendJson(res, 200, {
          connected: true,
          expiresAt: token.accessTokenExpiryDate
        });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/cj/status") {
      sendJson(res, 200, await cjTokenStatus());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/products") {
      sendJson(res, 200, await fetchCjProducts(url));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/research/opportunities") {
      try {
        sendJson(res, 200, await researchOpportunities(url));
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/drafts") {
      const store = await readStore();
      sendJson(res, 200, { drafts: store.drafts, published: store.published });
      return;
    }

    const publishedMatch = url.pathname.match(/^\/api\/published\/([^/]+)(?:\/(withdraw|promotion-recommendation|promote))?$/);
    if (publishedMatch && (req.method === "PATCH" || req.method === "POST")) {
      const store = await readStore();
      const id = decodeURIComponent(publishedMatch[1]);
      const action = publishedMatch[2] || "";
      const index = store.published.findIndex((listing) => listing.id === id);
      if (index === -1) {
        sendJson(res, 404, { error: "Published listing not found" });
        return;
      }

      if (req.method === "PATCH" && !action) {
        const body = await readBody(req);
        const enabled = body.promotedListingEnabled === true;
        const rate = Number(body.promotedAdRatePercent ?? 0);
        if (!Number.isFinite(rate) || rate < 0 || rate >= 100) {
          sendJson(res, 400, { error: "Enter a valid promoted listing ad rate below 100%." });
          return;
        }
        const next = {
          ...store.published[index],
          promotedListingEnabled: enabled,
          promotedAdRatePercent: enabled ? rate : 0,
          updatedAt: new Date().toISOString()
        };
        if (next.multiVariation) {
          next.listingVariants = (next.listingVariants || []).map((row) => ({
            ...row,
            promotedListingEnabled: enabled,
            promotedAdRatePercent: enabled ? rate : 0
          }));
        }
        store.published[index] = next;
        await saveStore(store);
        sendJson(res, 200, { published: next });
        return;
      }

      if (req.method === "POST" && action === "promotion-recommendation") {
        try {
          sendJson(res, 200, { recommendation: await promotionRecommendationForListing(store.published[index]) });
        } catch (error) {
          sendJson(res, 400, { error: error.message });
        }
        return;
      }

      if (req.method === "POST" && action === "promote") {
        try {
          const body = await readBody(req);
          const promotion = await promotePublishedListingOnEbay(store.published[index], body.promotedAdRatePercent);
          const next = {
            ...store.published[index],
            promotedListingEnabled: true,
            promotedAdRatePercent: promotion.bidPercentage,
            ebayPromotionCampaignId: promotion.campaignId,
            ebayPromotionCampaignName: promotion.campaignName,
            ebayPromotionListingId: promotion.listingId,
            ebayPromotionAppliedAt: promotion.appliedAt,
            ebayPromotionMode: ebayEnvironment(),
            ebayPromotionAdResult: promotion.adResult,
            updatedAt: new Date().toISOString()
          };
          if (next.multiVariation) {
            next.listingVariants = (next.listingVariants || []).map((row) => ({
              ...row,
              promotedListingEnabled: true,
              promotedAdRatePercent: promotion.bidPercentage
            }));
          }
          try {
            next.ebayPromotionPriceUpdate = await applyPromotedListingPrices(next);
          } catch (error) {
            next.ebayPromotionPriceUpdate = {
              status: "failed",
              at: new Date().toISOString(),
              message: error.message
            };
          }
          store.published[index] = next;
          await saveStore(store);
          sendJson(res, 200, { published: next, promotion, priceUpdate: next.ebayPromotionPriceUpdate });
        } catch (error) {
          sendJson(res, 400, { error: error.message });
        }
        return;
      }

      if (!(req.method === "POST" && action === "withdraw")) {
        sendJson(res, 404, { error: "Not found" });
        return;
      }

      try {
        const result = await withdrawPublishedFromEbay(store.published[index]);
        store.published[index] = {
          ...store.published[index],
          status: "withdrawn",
          withdrawnAt: new Date().toISOString(),
          withdrawMode: ebayEnvironment(),
          ebayWithdrawDetails: result
        };
        await saveStore(store);
        sendJson(res, 200, { published: store.published[index] });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/drafts") {
      const body = await readBody(req);
      const product = await enrichProductForDraft(body.product);
      const draft = makeDraftFromProduct(product);
      const store = await readStore();
      store.drafts.unshift(draft);
      await saveStore(store);
      sendJson(res, 201, { draft, validation: validateDraft(draft) });
      return;
    }

    const draftMatch = url.pathname.match(/^\/api\/drafts\/([^/]+)(?:\/(validate|publish|market-check|optimize))?$/);
    if (draftMatch) {
      const [, id, action] = draftMatch;
      const store = await readStore();
      const index = store.drafts.findIndex((draft) => draft.id === id);
      if (index === -1) {
        sendJson(res, 404, { error: "Draft not found" });
        return;
      }

      if (req.method === "DELETE" && !action) {
        store.drafts.splice(index, 1);
        await saveStore(store);
        sendJson(res, 200, { deleted: true });
        return;
      }

      if (req.method === "PATCH" && !action) {
        const body = await readBody(req);
        store.drafts[index] = prepareListing({ ...store.drafts[index], ...body, updatedAt: new Date().toISOString() });
        await saveStore(store);
        sendJson(res, 200, { draft: store.drafts[index], validation: validateDraft(store.drafts[index]) });
        return;
      }

      if (req.method === "POST" && action === "validate") {
        sendJson(res, 200, { validation: validateDraft(store.drafts[index]) });
        return;
      }

      if (req.method === "POST" && action === "market-check") {
        try {
          sendJson(res, 200, { market: await draftMarketCheck(store.drafts[index]) });
        } catch (error) {
          sendJson(res, 400, { error: error.message });
        }
        return;
      }

      if (req.method === "POST" && action === "optimize") {
        try {
          const market = await draftMarketCheck(store.drafts[index]).catch(() => ({ competitors: [] }));
          const result = optimizeDraft(store.drafts[index], market.competitors || []);
          store.drafts[index] = prepareListing({ ...result.draft, updatedAt: new Date().toISOString() });
          await saveStore(store);
          sendJson(res, 200, { draft: store.drafts[index], validation: validateDraft(store.drafts[index]), changes: result.changes, checklist: result.checklist });
        } catch (error) {
          sendJson(res, 400, { error: error.message });
        }
        return;
      }

      if (req.method === "POST" && action === "publish") {
        store.drafts[index] = ensureDraftSupplierImage(store.drafts[index]);
        const result = await publishDraft(store.drafts[index]);
        if (!result.ok) {
          sendJson(res, 422, result);
          return;
        }
        const sourceDraft = result.draft || store.drafts[index];
        const published = {
          ...sourceDraft,
          status: "published",
          ebayListingId: result.listingId,
          ebayOfferId: result.offerId || null,
          ebayOfferIds: result.offerIds || [],
          ebayGroupKey: result.groupKey || null,
          ebayPublishVerified: result.publishVerified === true,
          ebayPublishDetails: result.publishDetails || [],
          publishedMode: result.mode,
          publishedAt: new Date().toISOString()
        };
        store.drafts.splice(index, 1);
        store.published.unshift(published);
        await saveStore(store);
        sendJson(res, 200, { published });
        return;
      }
    }

    if (req.method === "GET" && url.pathname === "/api/settings") {
      const ebayConfig = ebayConfigStatus();
      const ebayToken = await ebayTokenStatus();
      const ebayPublishingSetup = publishingSetup(process.env, ebayToken, ebayEnvironment());
      const ebayProfile = ebayToken.connected
        ? await linkedEbayProfile(ebayEnvironment(), getUsableEbayToken)
        : { username: null, message: "Not connected yet" };
      const cjToken = await cjTokenStatus();
      sendJson(res, 200, {
        cjLive: process.env.CJ_USE_LIVE === "true" && cjToken.connected,
        cjToken,
        ebayLivePublish: process.env.EBAY_LIVE_PUBLISH === "true",
        ebayProductionConfirmed: process.env.EBAY_PRODUCTION_CONFIRM === "REAL_LISTINGS_ENABLED",
        ebayReady: ebayPublishingSetup.ready,
        ebayPublishingSetup,
        ebayProfile,
        ebayOauth: ebayConfig,
        ebayToken
      });
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

function contentType(filePath) {
  const ext = path.extname(filePath);
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg"
  }[ext] || "application/octet-stream";
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(publicDir, requested));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    await stat(filePath);
    res.writeHead(200, { "content-type": contentType(filePath) });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

// Serialize draft operations so concurrent requests cannot overwrite saved changes.
let draftQueue = Promise.resolve();
const server = http.createServer(async (req, res) => {
  try {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (await accessGuard.handleSession(req, res, url)) return;
  if (!accessGuard(req, res, url)) return;
  if (url.pathname === "/healthz") {
    sendJson(res, 200, { status: "ok", revision: process.env.RENDER_GIT_COMMIT || "local", features: ["orders", "price-tracking"] });
    return;
  }
  if (url.pathname === "/auth/ebay/callback") {
    const operation = draftQueue.then(() => handleEbayCallback(req, res, url));
    draftQueue = operation.catch(() => {});
    await operation;
  } else if (url.pathname === "/auth/ebay/declined") {
    sendHtml(res, 200, oauthPage("eBay connection declined", "No eBay token was created. You can return to the dashboard and try again."));
  } else if (url.pathname.startsWith("/api/")) {
    if (!(req.method === "GET" && ["/api/ebay/marketplace-account-deletion", "/api/repricing"].includes(url.pathname))) {
      const operation = draftQueue.then(() => handleApi(req, res, url));
      draftQueue = operation.catch(() => {});
      await operation;
    } else {
      await handleApi(req, res, url);
    }
  } else {
    await serveStatic(req, res, url);
  }
  } catch {
    if (!res.headersSent) sendJson(res, 500, { error: "The request could not be completed." });
    else res.end();
  }
});

server.listen(port, host, () => {
  console.log(`CJ to eBay listing control running at http://localhost:${port}`);
  if (host === "0.0.0.0") {
    for (const url of localNetworkUrls()) console.log(`Network access: ${url}`);
    console.log("Tailscale access: open the laptop's Tailscale MagicDNS name or 100.x address on this port.");
  }
});

// External daily trigger wakes sleeping hosts; also support an always-on server.
setInterval(() => {
  if (!repricingQueued) enqueueRepricing({ scheduled: true, preview: false });
}, 60000).unref();
