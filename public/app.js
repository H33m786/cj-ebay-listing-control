import { draftPricing, targetSalePrice, applyTargetPrice } from "./pricing.js";
import { listingRows, mainListingRowIndex, variationErrors, categoryErrors, alignVariationAxesToSchema, collapseSingleVariation } from "./listing.js";
import { buildDraftDescription } from "./description.js";
import { compareDraftToMarket, marketSearchTerm, prePublishChecklist } from "./market.js";
import { createOrdersView } from "./orders.js";
const ordersView = createOrdersView(document.querySelector("#ordersView"));
import { createRepricingView } from "./repricing.js";
const repricingView = createRepricingView(document.querySelector("#repricingView"));

const state = {
  products: [],
  drafts: [],
  published: [],
  research: null,
  selectedDraftId: null,
  selectedPublishedId: null,
  publishedSales: null,
  publishedSalesError: "",
  settings: null,
  ebayAccountSetup: null
};

const hostedStoreKey = "cj-ebay-listing-control-store";
const sampleProducts = [
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

const categoryAliases = {
  trending: ["trending", "popular", "hot", "viral", "winner"],
  fashion: ["fashion", "clothes", "clothing", "style", "bags", "bag", "accessories", "beauty"],
  electronics: ["electronics", "charger", "charging", "cable", "usb", "usb-c", "phone", "adapter", "gadget", "tech"],
  home: ["home", "storage", "kitchen", "bathroom", "organiser", "organizer", "house"],
  fitness: ["fitness", "gym", "exercise", "workout", "sport"],
  travel: ["travel", "luggage", "bag", "bags", "organiser", "organizer"]
};

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

const viewCopy = {
  orders: ["Fulfilment", "eBay orders"],
  repricing: ["Pricing", "Price tracking"],
  research: ["Market research", "Find product opportunities"],
  import: ["Supplier search", "Import CJ products"],
  drafts: ["Listing review", "Prepare eBay drafts"],
  published: ["Live catalogue", "Published listings"],
  settings: ["Setup", "Integration settings"]
};

const $ = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
  try {
    const response = await fetch(path, {
      headers: { "content-type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(body.error || "Request failed");
      error.body = body;
      error.fromServer = true;
      throw error;
    }
    return body;
  } catch (error) {
    if (error.fromServer) throw error;
    return localApi(path, options, error);
  }
}

function money(value, currency = "GBP") {
  if (value == null) return "Not calculated";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, currencyDisplay: "code" }).format(Number(value || 0));
}

function readHostedStore() {
  const fallback = { drafts: [], published: [] };
  try {
    return JSON.parse(localStorage.getItem(hostedStoreKey)) || fallback;
  } catch {
    return fallback;
  }
}

function writeHostedStore(store) {
  localStorage.setItem(hostedStoreKey, JSON.stringify(store));
}

function makeHostedDraft(product) {
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
    warehouse: product.warehouse,
    quantity: Math.min(product.stock, 10),
    stock: product.stock,
    cost: product.cost,
    shippingCost: product.shipping,
    costCurrency: "GBP",
    usdToGbp: null,
    pricingReviewed: false,
    autoPrice: true,
    priceTargetType: "fixed",
    targetProfitGbp: 5,
    targetMarginPercent: 25,
    promotedListingEnabled: false,
    promotedAdRatePercent: 0,
    otherCostsGbp: 0,
    salePrice: price,
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

async function localApi(path, options, originalError) {
  const url = new URL(path, window.location.origin);
  const store = readHostedStore();

  if (url.pathname === "/api/settings") {
    return {
      cjLive: false,
      cjToken: {
        apiKeyReady: false,
        connected: false,
        expiresAt: null,
        hasRefreshToken: false
      },
      ebayLivePublish: false,
      ebayReady: false,
      ebayToken: {
        connected: false,
        hasRefreshToken: false,
        environment: "sandbox",
        savedAt: null,
        scopeCount: 0
      },
      hostedDemo: true,
      ebayOauth: {
        environment: "sandbox",
        clientIdReady: true,
        clientSecretReady: false,
        runameReady: true,
        runame: "Ibraheem_Ali-Ibraheem-CJtoeB-jeurj",
        marketplaceId: "EBAY_GB",
        scopes: [
          "https://api.ebay.com/oauth/api_scope",
          "https://api.ebay.com/oauth/api_scope/sell.inventory",
          "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
          "https://api.ebay.com/oauth/api_scope/sell.account",
          "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
          "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
          "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly"
        ]
      }
    };
  }

  if (url.pathname === "/api/ebay/auth-url") {
    throw new Error("Open the local desktop app to connect eBay sandbox. The phone demo cannot store your eBay token.");
  }

  if (url.pathname === "/api/cj/connect") {
    throw new Error("Open the local desktop app to connect CJ. The phone demo cannot store your CJ token.");
  }

  if (url.pathname === "/api/products") {
    const keyword = url.searchParams.get("keyword")?.toLowerCase() || "";
    const category = url.searchParams.get("category") || "";
    const warehouse = url.searchParams.get("warehouse") || "";
    return {
      live: false,
      products: sampleProducts.filter((product) => {
        const keywordMatch = matchesProduct(product, keyword);
        const categoryMatch = matchesCategory(product, category);
        const warehouseMatch = !warehouse || product.warehouse === warehouse;
        return keywordMatch && categoryMatch && warehouseMatch;
      })
    };
  }

  if (url.pathname === "/api/research/opportunities") {
    const keyword = url.searchParams.get("keyword")?.toLowerCase() || "";
    const category = url.searchParams.get("category") || "trending";
    const terms = keyword ? [keyword] : [category, ...(categoryAliases[category] || [])].slice(0, 3);
    const groups = terms.map((term) => {
      const products = sampleProducts.filter((product) => matchesProduct(product, term) || matchesCategory(product, category)).slice(0, 3);
      const prices = products.map((product) => Number((product.cost + product.shipping) * 2.2 + 4));
      return {
        term,
        medianPrice: prices[0] || 24.99,
        cjCount: products.length,
        ebayItems: products.map((product) => ({ title: product.title, price: Number((product.cost + product.shipping) * 2.2 + 4), currency: "GBP", image: product.image, url: "" }))
      };
    });
    const recommendations = groups.flatMap((group) => sampleProducts
      .filter((product) => matchesProduct(product, group.term) || matchesCategory(product, category))
      .slice(0, 4)
      .map((product) => {
        const landed = Number((product.cost + product.shipping).toFixed(2));
        const market = group.medianPrice || 0;
        const fees = estimateFees(market);
        return { term: group.term, product, ebayMedianPrice: market, ebayExampleCount: group.ebayItems.length, landedEstimate: landed, estimatedFees: fees, roughMargin: Number((market - landed - fees).toFixed(2)), score: Number((market - landed).toFixed(2)), caution: "Sample recommendation. Use live eBay/CJ connections for production research." };
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return { category, keyword, marketplace: "sample", generatedAt: new Date().toISOString(), groups, recommendations };
  }

  if (url.pathname === "/api/drafts" && (!options.method || options.method === "GET")) {
    return store;
  }

  if (url.pathname === "/api/drafts" && options.method === "POST") {
    const body = JSON.parse(options.body);
    const draft = makeHostedDraft(body.product);
    store.drafts.unshift(draft);
    writeHostedStore(store);
    return { draft, validation: validateClient(draft) };
  }

  const publishedMatch = url.pathname.match(/^\/api\/published\/([^/]+)$/);
  if (publishedMatch && options.method === "PATCH") {
    const id = decodeURIComponent(publishedMatch[1]);
    const index = store.published.findIndex((item) => item.id === id);
    if (index === -1) throw originalError;
    const body = JSON.parse(options.body || "{}");
    const enabled = body.promotedListingEnabled === true;
    const rate = Number(body.promotedAdRatePercent ?? 0);
    if (!Number.isFinite(rate) || rate < 0 || rate >= 100) throw new Error("Enter a valid promoted listing ad rate below 100%.");
    store.published[index] = {
      ...store.published[index],
      promotedListingEnabled: enabled,
      promotedAdRatePercent: enabled ? rate : 0,
      listingVariants: (store.published[index].listingVariants || []).map((row) => ({
        ...row,
        promotedListingEnabled: enabled,
        promotedAdRatePercent: enabled ? rate : 0
      }))
    };
    writeHostedStore(store);
    return { published: store.published[index] };
  }

  const draftMatch = url.pathname.match(/^\/api\/drafts\/([^/]+)(?:\/(validate|publish|market-check))?$/);
  if (draftMatch) {
    const [, id, action] = draftMatch;
    const index = store.drafts.findIndex((draft) => draft.id === id);
    if (index === -1) throw originalError;

    if (options.method === "DELETE" && !action) {
      store.drafts.splice(index, 1);
      writeHostedStore(store);
      return { deleted: true };
    }

    if (options.method === "PATCH" && !action) {
      store.drafts[index] = applyTargetPrice({ ...store.drafts[index], ...JSON.parse(options.body), updatedAt: new Date().toISOString() });
      writeHostedStore(store);
      return { draft: store.drafts[index], validation: validateClient(store.drafts[index]) };
    }

    if (options.method === "POST" && action === "validate") {
      return { validation: validateClient(store.drafts[index]) };
    }

    if (options.method === "POST" && action === "market-check") {
      const draft = store.drafts[index];
      const term = marketSearchTerm(draft);
      const competitors = sampleProducts
        .filter((product) => matchesProduct(product, term) || matchesCategory(product, draft.category || ""))
        .slice(0, 8)
        .map((product) => ({
          title: product.title,
          price: Number(((product.cost + product.shipping) * 1.6 + 5).toFixed(2)),
          currency: "GBP",
          image: product.image,
          url: "",
          seller: "sample"
        }));
      return { market: { generatedAt: new Date().toISOString(), marketplace: "sample", ...compareDraftToMarket(draft, competitors) } };
    }

    if (options.method === "POST" && action === "publish") {
      const validation = validateClient(store.drafts[index]);
      if (!validation.passed) {
        const error = new Error("Draft needs review before publishing");
        error.body = { validation };
        throw error;
      }
      const published = {
        ...store.drafts[index],
        status: "published",
        ebayListingId: `SIM-${Math.floor(1000000000 + Math.random() * 8999999999)}`,
        publishedMode: "simulated",
        publishedAt: new Date().toISOString()
      };
      store.drafts.splice(index, 1);
      store.published.unshift(published);
      writeHostedStore(store);
      return { published };
    }
  }

  throw originalError;
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

function setView(name) {
  if (name === "repricing") repricingView.load();
  else repricingView.clear();
  if (name === "orders") ordersView.load();
  else ordersView.clear();
  document.querySelectorAll(".nav-tab").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  $(`#${name}View`).classList.add("active");
  $("#viewEyebrow").textContent = viewCopy[name][0];
  $("#viewTitle").textContent = viewCopy[name][1];
  if (name === "published") loadPublishedSales();
}

function renderCounts() {
  $("#draftCount").textContent = state.drafts.length;
  $("#publishedCount").textContent = state.published.length;
}

function renderProducts() {
  const grid = $("#productGrid");
  grid.innerHTML = "";
  if (!state.products.length) {
    grid.innerHTML = '<div class="empty-state">No CJ products matched this search.</div>';
    return;
  }

  const template = $("#productCardTemplate");
  state.products.forEach((product) => {
    const node = template.content.cloneNode(true);
    const card = node.querySelector(".product-card");
    card.querySelector(".product-media").innerHTML = productVisual(product);
    card.querySelector(".meta").textContent = `${product.category || product.categoryName || "Unmapped"} / ${product.warehouse || "CJ"}`;
    card.querySelector("h3").textContent = product.title || product.productNameEn || "Untitled CJ product";
    card.querySelector("dl").innerHTML = `
      <div><dt>Cost</dt><dd>${money(product.cost, String(product.pid).startsWith("CJ-") ? "GBP" : "USD")}</dd></div>
      <div><dt>Ship</dt><dd>${String(product.pid).startsWith("CJ-") ? money(product.shipping) : "Quote required"}</dd></div>
      <div><dt>Stock</dt><dd>${product.stock ?? "Check"}</dd></div>
      <div><dt>Delivery</dt><dd>${product.deliveryDays ?? "Check"} days</dd></div>
    `;
    card.querySelector("button").addEventListener("click", async () => {
      const result = await api("/api/drafts", {
        method: "POST",
        body: JSON.stringify({ product })
      });
      state.drafts.unshift(result.draft);
      state.selectedDraftId = result.draft.id;
      renderDrafts();
      renderCounts();
      setView("drafts");
    });
    grid.appendChild(node);
  });
}

async function loadResearch() {
  const results = $("#researchResults");
  const keyword = encodeURIComponent($("#researchKeywordInput").value.trim());
  const category = encodeURIComponent($("#researchCategoryInput").value);
  results.innerHTML = '<div class="empty-state">Checking eBay market prices and matching CJ products...</div>';
  try {
    state.research = await api(`/api/research/opportunities?keyword=${keyword}&category=${category}`);
    renderResearch();
  } catch (error) {
    results.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderResearch() {
  const results = $("#researchResults");
  const research = state.research;
  if (!research) {
    results.innerHTML = '<div class="empty-state">Search a niche to compare live eBay prices against similar CJ products.</div>';
    return;
  }
  results.innerHTML = `
    <section class="research-panel">
      <h3>eBay market snapshot</h3>
      <div class="research-terms">
        ${(research.groups || []).map((group) => `
          <article class="research-term">
            <strong>${escapeHtml(group.term)}</strong>
            <span>${money(group.medianPrice)} median / ${group.ebayItems?.length || 0} eBay examples / ${group.cjCount || 0} CJ matches</span>
            ${(group.ebayItems || []).slice(0, 3).map((item) => `<p class="meta">${escapeHtml(item.title)} / ${money(item.price, item.currency || "GBP")}${item.url ? ` / <a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">View</a>` : ""}</p>`).join("")}
          </article>
        `).join("")}
      </div>
    </section>
    <section class="research-panel">
      <h3>Recommended CJ products to check</h3>
      <div class="research-recommendations">
        ${(research.recommendations || []).map((item, index) => researchRecommendationMarkup(item, index)).join("") || '<div class="empty-state">No CJ matches found. Try a broader search.</div>'}
      </div>
    </section>
  `;
  results.querySelectorAll("[data-research-index]").forEach((button) => {
    button.addEventListener("click", async () => {
      const recommendation = state.research.recommendations[Number(button.dataset.researchIndex)];
      if (!recommendation?.product) return;
      button.disabled = true;
      button.textContent = "Creating draft...";
      try {
        const result = await api("/api/drafts", {
          method: "POST",
          body: JSON.stringify({ product: recommendation.product })
        });
        state.drafts.unshift(result.draft);
        state.selectedDraftId = result.draft.id;
        renderDrafts();
        renderCounts();
        setView("drafts");
      } catch (error) {
        button.disabled = false;
        button.textContent = "Create draft";
        alert(error.message);
      }
    });
  });
}

function researchRecommendationMarkup(item, index) {
  const product = item.product || {};
  return `
    <article class="research-card">
      ${productVisual(product)}
      <div>
        <p class="eyebrow">${escapeHtml(item.term || "Opportunity")}</p>
        <h3>${escapeHtml(product.title || product.productNameEn || "CJ product")}</h3>
        <div class="detail-metrics">
          <div class="metric"><span>eBay median</span><strong>${money(item.ebayMedianPrice)}</strong></div>
          <div class="metric"><span>CJ landed</span><strong>${money(item.landedEstimate)}</strong></div>
          <div class="metric"><span>Rough margin</span><strong>${money(item.roughMargin)}</strong></div>
          <div class="metric"><span>Score</span><strong>${escapeHtml(item.score ?? "0")}</strong></div>
        </div>
        ${item.caution ? `<p class="inline-status">${escapeHtml(item.caution)}</p>` : ""}
        <button type="button" data-research-index="${index}">Create draft</button>
      </div>
    </article>
  `;
}

function renderDrafts() {
  const list = $("#draftList");
  list.innerHTML = "";
  if (!state.drafts.length) {
    list.innerHTML = '<div class="empty-state">Imported products will appear here as editable eBay drafts.</div>';
    $("#draftEditor").innerHTML = '<div class="empty-state">Create a draft from the import screen to start reviewing.</div>';
    return;
  }

  if (!state.selectedDraftId) state.selectedDraftId = state.drafts[0].id;

  state.drafts.forEach((draft) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `draft-row ${draft.id === state.selectedDraftId ? "active" : ""}`;
    row.innerHTML = `<strong>${draft.title}</strong><span>${draft.sku} / ${money(draft.salePrice)} / ${draft.quantity} units</span>`;
    row.addEventListener("click", () => {
      state.selectedDraftId = draft.id;
      renderDrafts();
    });
    list.appendChild(row);
  });

  renderEditor(state.drafts.find((draft) => draft.id === state.selectedDraftId));
}

function validationMarkup(validation) {
  const items = [...validation.failures, ...validation.warnings];
  const status = validation.passed ? "pass" : "fail";
  return `
    <section class="validation-box ${status}">
      <strong>${validation.passed ? "Ready to publish" : "Needs review before publishing"}</strong>
      ${items.length ? `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>` : ""}
      <div class="metrics">
        <div class="metric"><span>Landed</span><strong>${money(validation.landedCost)}</strong></div>
        <div class="metric"><span>Fees</span><strong>${money(validation.estimatedFees)}</strong></div>
        <div class="metric"><span>Margin</span><strong>${money(validation.margin)}</strong></div>
        <div class="metric"><span>Margin %</span><strong>${validation.marginPercent == null ? "Not calculated" : `${validation.marginPercent}%`}</strong></div>
      </div>
    </section>
  `;
}

function showEditorError(editor, message) {
  const box = editor.querySelector(".validation-box");
  if (!box) return;
  box.outerHTML = validationMarkup({
    passed: false,
    failures: [message || "Something went wrong. Please try again."],
    warnings: [],
    landedCost: null,
    estimatedFees: null,
    margin: null,
    marginPercent: null
  });
}

function showEditorStatus(editor, title, message) {
  const box = editor.querySelector(".validation-box");
  if (!box) return;
  box.outerHTML = `
    <section class="validation-box pass">
      <strong>${escapeHtml(title)}</strong>
      <p class="meta">${escapeHtml(message)}</p>
    </section>
  `;
}

function pricingBreakdownMarkup(draft) {
  const rows = draft.multiVariation ? listingRows(draft) : [];
  const subject = rows.length ? rows[mainListingRowIndex(draft, rows)] : draft;
  const target = targetSalePrice(subject);
  const pricing = draftPricing({ ...subject, salePrice: target.price ?? subject.salePrice });
  const breakdown = pricing.breakdown || {};
  const targetText = subject.priceTargetType === "percent"
    ? `${subject.targetMarginPercent ?? 25}% margin`
    : `${money(subject.targetProfitGbp ?? 5)} profit`;
  const lines = [
    ["Item cost", money(breakdown.itemCostGbp)],
    ["Shipping cost", money(breakdown.shippingCostGbp)],
    ["Other costs", money(breakdown.otherCostsGbp)],
    ["Landed cost", money(pricing.landedCost)],
    ["Estimated eBay fees", money(pricing.estimatedFees)],
    ["Promoted ad fee", money(pricing.promotedAdFee)],
    ["Total fees", money(pricing.totalEstimatedFees)],
    ["Target", targetText],
    ["Calculated eBay price", target.price == null ? "Not calculated" : money(target.price)],
    ["Expected profit", money(pricing.margin)]
  ];
  return `
    <section class="validation-box pricing-breakdown" id="pricingBreakdown">
      <strong>Price calculation</strong>
      ${target.error ? `<p class="meta">${escapeHtml(target.error)}</p>` : ""}
      <div class="metrics">
        ${lines.map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
      </div>
      <p class="meta">Formula: sale price covers landed cost, eBay percentage fee, fixed fee, then your chosen profit target.</p>
    </section>
  `;
}

function checklistItemsMarkup(checklist) {
  return `
    <div class="quality-list">
      ${(checklist.items || []).map((item) => `
        <article class="quality-item quality-${escapeAttr(item.status)}">
          <span>${escapeHtml(item.name)}</span>
          <strong>${escapeHtml(Math.round(item.score))}/100</strong>
          <p>${escapeHtml(item.message)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function suggestedTitleMarkup(title, currentTitle = "") {
  if (!title || title.trim().toLowerCase() === String(currentTitle || "").trim().toLowerCase()) return "";
  return `
    <div class="suggested-title">
      <span>Suggested title</span>
      <strong>${escapeHtml(title)}</strong>
      <button type="button" class="secondary" data-suggested-title="${escapeAttr(title)}">Use title</button>
    </div>
  `;
}

function bindMarketCheckActions(editor) {
  editor.querySelectorAll("[data-suggested-title]").forEach((button) => {
    button.addEventListener("click", () => {
      editor.elements.title.value = button.dataset.suggestedTitle || "";
      editor.elements.ebayCategorySearch.value = editor.elements.title.value;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
}

function marketCheckMarkup(market = null, draft = null) {
  if (!market) {
    const checklist = draft ? prePublishChecklist(draft, []) : null;
    return `
      <section class="validation-box market-check" id="marketCheck">
        <strong>Listing quality${checklist ? `: ${escapeHtml(checklist.score)}/100` : ""}</strong>
        <p class="meta">Run market comparison to score this against similar active eBay listings.</p>
        ${checklist ? checklistItemsMarkup(checklist) : ""}
        ${checklist ? suggestedTitleMarkup(checklist.suggestedTitle, draft.title) : ""}
      </section>
    `;
  }
  const competitors = market.competitors || [];
  return `
    <section class="validation-box market-check" id="marketCheck">
      <strong>Market comparison score: ${escapeHtml(market.score ?? "0")}/100</strong>
      <p class="meta">${escapeHtml(market.query || "")} / ${escapeHtml(market.marketplace || "EBAY_GB")} / ${escapeHtml(market.competitorCount || 0)} examples</p>
      ${market.checklist ? `<h3>Pre-publish checklist: ${escapeHtml(market.checklist.score)}/100</h3>${checklistItemsMarkup(market.checklist)}` : ""}
      ${suggestedTitleMarkup(market.suggestedTitle, draft?.title || "")}
      <div class="metrics">
        <div class="metric"><span>Your price</span><strong>${money(market.salePrice)}</strong></div>
        <div class="metric"><span>Median competitor</span><strong>${money(market.medianPrice)}</strong></div>
        <div class="metric"><span>Position</span><strong>${escapeHtml(market.pricePosition || "Unknown")}</strong></div>
        <div class="metric"><span>Title match</span><strong>${escapeHtml(market.keywordScore ?? 0)}%</strong></div>
        <div class="metric"><span>Images</span><strong>${escapeHtml(market.imageCount ?? 0)}</strong></div>
        <div class="metric"><span>Specifics</span><strong>${escapeHtml(market.specificsCount ?? 0)}</strong></div>
      </div>
      <h3>Recommended fixes</h3>
      <ul>${(market.recommendations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      ${competitors.length ? `
        <h3>Similar eBay examples</h3>
        <div class="market-examples">
          ${competitors.slice(0, 5).map((item) => `
            <article>
              <strong>${escapeHtml(item.title)}</strong>
              <span>${money(item.price, item.currency || "GBP")}${item.url ? ` / <a href="${escapeAttr(item.url)}" target="_blank" rel="noreferrer">View</a>` : ""}</span>
            </article>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function splitVariantLabel(variant = {}) {
  const label = variant.variantKey || variant.variantNameEn || variant.variantSku || variant.vid || "";
  const parts = String(label).split("-").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { option1: parts.slice(0, -1).join("-"), option2: parts.at(-1), label };
  return { option1: label || "Option", option2: "", label };
}

function supportedVariationAxes(draft) {
  const schema = draft.ebayCategorySchema?.categoryId === draft.ebayCategoryId ? draft.ebayCategorySchema : null;
  const axes = (schema?.aspects || []).filter((aspect) => aspect.aspectConstraint?.aspectEnabledForVariations).map((aspect) => aspect.localizedAspectName);
  return axes.length ? axes : ["Colour", "Size", "Type", "Cable Length", "Compatible Brand"];
}

function normalizeVariationAxes(draft) {
  const supported = supportedVariationAxes(draft);
  const current = (draft.variationAxes || []).filter(Boolean);
  const valid = current.filter((axis) => supported.includes(axis));
  if (valid.length) return valid.slice(0, 2);
  if (supported.includes("Colour")) return [supported.find((axis) => axis === "Colour"), supported.find((axis) => axis !== "Colour")].filter(Boolean).slice(0, 2);
  return supported.slice(0, 2);
}

function defaultListingVariants(draft) {
  const axes = normalizeVariationAxes(draft);
  const existing = new Map((draft.listingVariants || []).map((row) => [row.cjVariantId, row]));
  return (draft.variants || []).filter((variant) => variant?.vid).map((variant) => {
    const parts = splitVariantLabel(variant);
    const existingRow = existing.get(variant.vid) || {};
    const existingAspects = existingRow.aspects || {};
    const aspects = {};
    axes.forEach((axis, index) => {
      aspects[axis] = existingAspects[axis] || existingAspects[index === 0 ? "Colour" : "Size"] || parts[`option${index + 1}`] || "";
    });
    return {
      enabled: existingRow.enabled === true,
      cjVariantId: variant.vid,
      label: existingRow.label || parts.label,
      quantity: existingRow.quantity ?? 1,
      cost: existingRow.cost ?? null,
      shippingCost: existingRow.shippingCost ?? null,
      salePrice: existingRow.salePrice ?? null,
      costCurrency: existingRow.costCurrency || null,
      image: existingRow.image || variant.variantImage || variant.variantImg || draft.image,
      cjShippingService: existingRow.cjShippingService || "",
      aspects
    };
  });
}

function variantRowPricing(draft, row) {
  const prepared = listingRows({ ...draft, multiVariation: true, listingVariants: [{ ...row, enabled: true }] })[0];
  return { prepared, pricing: prepared ? draftPricing(prepared) : null };
}

function variantMarginText(prepared, pricing) {
  if (!prepared || !pricing) return "Not calculated";
  if (pricing.marginPercent != null) return `${pricing.marginPercent}%`;
  const failure = pricing.failures.find((item) => item.includes("GBP amount charged per USD"))
    || pricing.failures.find((item) => item.includes("item and shipping costs"))
    || pricing.failures.find((item) => item.includes("positive GBP sale price"))
    || pricing.failures[0];
  return failure || "Not calculated";
}

function variationsMarkup(draft) {
  if (!Array.isArray(draft.variants) || !draft.variants.some((item) => item?.vid)) return "";
  const axes = normalizeVariationAxes(draft);
  const supportedAxes = supportedVariationAxes(draft);
  const rows = defaultListingVariants(draft);
  const enabledCount = rows.filter((row) => row.enabled).length;
  const axisOptions = (selected) => supportedAxes.map((axis) => `<option value="${escapeAttr(axis)}" ${axis === selected ? "selected" : ""}>${escapeHtml(axis)}</option>`).join("");
  return `
    <section class="wide variation-builder" id="variationBuilder">
      <label class="pricing-confirmation"><input name="multiVariation" type="checkbox" ${draft.multiVariation ? "checked" : ""} /> Publish as one eBay listing with selectable variants</label>
      <div class="variation-axis-picker">
        <label>Variation attribute 1 <select data-axis-index="0">${axisOptions(axes[0])}</select></label>
        <label>Variation attribute 2 <select data-axis-index="1"><option value="">None</option>${axisOptions(axes[1])}</select></label>
      </div>
      <input type="hidden" name="variationAxes" value="${escapeAttr(axes.join(","))}" />
      <input type="hidden" name="listingVariantsJson" value="${escapeAttr(JSON.stringify(rows))}" />
      <div class="variation-toolbar">
        <button type="button" class="secondary" id="selectCommonVariantsButton">Select common sizes</button>
        <button type="button" class="secondary" id="quoteVariantsButton">Refresh selected variant quotes</button>
        <span id="variationStatus">${enabledCount ? `${enabledCount} selected` : "No variants selected"}</span>
      </div>
      <p class="variation-help">Tick the variants you want to sell. Cost and shipping are the CJ amounts for that exact colour/size; the app uses them to calculate the eBay sale price and margin.</p>
      <div class="variation-table">
        <div class="variation-row variation-row-head" aria-hidden="true">
          <span>Use</span>
          <span>CJ option</span>
          ${axes.map((axis) => `<span>${escapeHtml(axis)}</span>`).join("")}
          <span>Qty</span>
          <span>Item cost</span>
          <span>Shipping</span>
          <span>Shipping service</span>
          <span>eBay price</span>
          <span>Margin</span>
        </div>
        ${rows.map((row, index) => {
          const { pricing } = variantRowPricing(draft, row);
          return `
            <div class="variation-row" data-index="${index}">
              <label><input type="checkbox" data-field="enabled" ${row.enabled ? "checked" : ""} /> Use</label>
              <span>${escapeHtml(row.label)}</span>
              ${axes.map((axis, axisIndex) => `<input data-field="aspect" data-axis="${escapeAttr(axis)}" value="${escapeAttr(row.aspects?.[axis] || "")}" aria-label="${escapeAttr(axis)}" title="${escapeAttr(axis)} buyers will choose on eBay" placeholder="${axisIndex === 0 ? "Black" : "Option"}" />`).join("")}
              <input data-field="quantity" type="number" min="0" value="${escapeAttr(row.quantity ?? 1)}" aria-label="Quantity" title="How many units to make available for this variant" />
              <input data-field="cost" type="number" step="0.01" min="0" value="${row.cost ?? ""}" aria-label="Item cost" title="CJ product cost for this exact variant, before shipping" placeholder="0.00" />
              <input data-field="shippingCost" type="number" step="0.01" min="0" value="${row.shippingCost ?? ""}" aria-label="Shipping cost" title="CJ shipping cost for this exact variant" placeholder="0.00" />
              <span data-field="shippingServiceDisplay" title="CJ shipping service selected by the quote tool">${escapeHtml(row.cjShippingService || "Quote needed")}</span>
              <span data-field="salePriceDisplay" title="Calculated eBay price for this variant">${money(row.salePrice ?? variantRowPricing(draft, row).prepared?.salePrice)}</span>
              <span data-field="marginDisplay" title="Profit margin after landed cost and estimated eBay fees">${escapeHtml(variantMarginText(variantRowPricing(draft, row).prepared, pricing))}</span>
            </div>
          `;
        }).join("")}
      </div>
      <label class="pricing-confirmation"><input name="sharedShippingConfirmed" type="checkbox" ${draft.sharedShippingConfirmed === true ? "checked" : ""} /> Every selected variation uses the same dispatch location and eBay postage policy; variant shipping differences are included in each item price</label>
    </section>
  `;
}

function itemSpecificsMarkup(draft) {
  const specifics = { Brand: "Unbranded", Type: draft.category || "", ...(draft.itemSpecifics || {}) };
  const schema = draft.ebayCategorySchema?.categoryId === draft.ebayCategoryId ? draft.ebayCategorySchema : null;
  const aspectNames = new Set(["Brand", "Type"]);
  for (const aspect of schema?.aspects || []) {
    const rule = aspect.aspectConstraint || {};
    if (rule.aspectRequired || rule.aspectUsage === "RECOMMENDED") aspectNames.add(aspect.localizedAspectName);
  }
  for (const name of Object.keys(specifics)) {
    if (!schema?.aspects?.some((item) => item.localizedAspectName === name) && isLegacyClothingSpecific(name, specifics[name], draft)) continue;
    if (name !== "Condition") aspectNames.add(name);
  }
  const fields = [...aspectNames].filter((name) => name && !["Condition", ...(draft.multiVariation ? draft.variationAxes || [] : [])].includes(name));
  const fieldMarkup = fields.map((name) => {
    const aspect = schema?.aspects?.find((item) => item.localizedAspectName === name);
    const rule = aspect?.aspectConstraint || {};
    const values = (aspect?.aspectValues || []).map((item) => item.localizedValue).filter(Boolean);
    const required = rule.aspectRequired ? " required" : "";
    const label = `${escapeHtml(name)}${rule.aspectRequired ? " *" : ""}`;
    if (values.length && values.length <= 80 && rule.aspectMode === "SELECTION_ONLY") {
      return `<label>${label}<select name="specific.${escapeAttr(name)}"${required}><option value="">Select</option>${values.map((value) => `<option value="${escapeAttr(value)}" ${String(specifics[name] || "") === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label>`;
    }
    return `<label>${label}<input name="specific.${escapeAttr(name)}" value="${escapeAttr(specifics[name] || "")}"${required} /></label>`;
  }).join("");
  return `
    <fieldset class="wide item-specifics">
      <legend>eBay item specifics</legend>
      ${schema ? `<p class="specifics-note">Showing required and recommended specifics for the selected eBay category.</p>` : `<p class="specifics-note">Select an eBay category to load category-specific required fields.</p>`}
      ${fieldMarkup}
    </fieldset>
  `;
}

function isLegacyClothingSpecific(name, value, draft) {
  const text = String(value || "").trim().toLowerCase();
  if (name === "Department" && text === "men") return true;
  if (name === "Outer Shell Material" && text === "polyester") return true;
  if (name === "Style" && (text === "jacket" || text === String(draft.category || "").trim().toLowerCase())) return true;
  return false;
}

function renderEditor(draft) {
  const editor = $("#draftEditor");
  if (!draft) {
    editor.innerHTML = '<div class="empty-state">Select a draft to edit.</div>';
    return;
  }

  const validation = validateClient(draft);
  const categoryLabel = draft.ebayCategoryName || (draft.ebayCategoryId ? `eBay category ${draft.ebayCategoryId}` : "No eBay category selected");
  editor.innerHTML = `
    <div class="editor-grid">
      <label class="wide">Title <input name="title" maxlength="80" value="${escapeAttr(draft.title)}" /></label>
      <label>SKU <input name="sku" value="${escapeAttr(draft.sku)}" /></label>
      <label>Category <input name="category" value="${escapeAttr(draft.category)}" /></label>
      <label class="wide">eBay category search <input name="ebayCategorySearch" value="${escapeAttr(draft.ebayCategorySearch || draft.title || "")}" placeholder="Search eBay categories" /></label>
      <div class="wide category-picker">
        <input type="hidden" name="ebayCategoryId" value="${escapeAttr(draft.ebayCategoryId || "")}" />
        <input type="hidden" name="ebayCategoryName" value="${escapeAttr(draft.ebayCategoryName || "")}" />
        <input type="hidden" name="ebayCategorySchemaJson" value="${escapeAttr(JSON.stringify(draft.ebayCategorySchema || null))}" />
        <button type="button" class="secondary" id="findEbayCategoryButton">Find eBay categories</button>
        <span id="selectedEbayCategory">${escapeHtml(categoryLabel)}</span>
        <div id="ebayCategoryResults" class="category-results"></div>
      </div>
      ${Array.isArray(draft.variants) && draft.variants.some((item) => item?.vid) ? `
      <label class="wide">CJ size / colour <select name="cjVariantId" id="cjVariantSelect"><option value="">Select variant</option>${draft.variants.filter((item) => item?.vid).map((item) => `<option value="${escapeAttr(item.vid)}" ${draft.cjVariantId === item.vid ? "selected" : ""}>${escapeHtml(item.variantKey || item.variantNameEn || item.variantSku)}</option>`).join("")}</select></label>
      <label>UK destination postcode (optional) <input name="quotePostcode" value="${escapeAttr(draft.quotePostcode || "")}" /></label>
      <label>China to UK shipping (one item) <select name="cjShippingService" id="cjShippingSelect"><option value="${escapeAttr(draft.cjShippingService || "")}">${escapeHtml(draft.cjShippingService || "Select variant first")}</option></select></label>
      <button type="button" id="refreshCjQuoteButton">Refresh CJ prices</button>
      <p class="wide inline-status" id="cjQuoteStatus"></p>` : ""}
      ${variationsMarkup(draft)}
      <label class="wide pricing-confirmation"><input name="autoPrice" type="checkbox" ${draft.autoPrice !== false ? "checked" : ""} /> Calculate sale price from target profit</label>
      <label>Profit target type <select name="priceTargetType"><option value="fixed" ${(draft.priceTargetType || "fixed") !== "percent" ? "selected" : ""}>Fixed GBP profit</option><option value="percent" ${draft.priceTargetType === "percent" ? "selected" : ""}>Percentage margin</option></select></label>
      <label>Target profit (GBP) <input name="targetProfitGbp" type="number" step="0.01" min="0.01" value="${draft.targetProfitGbp ?? 5}" /></label>
      <label>Target profit margin (%) <input name="targetMarginPercent" type="number" step="0.1" min="0.1" max="99.9" value="${draft.targetMarginPercent ?? 25}" /></label>
      <label>Sale price (GBP) <input name="salePrice" type="number" step="0.01" min="0" value="${draft.salePrice ?? ""}" /></label>
      <p class="wide inline-status" id="targetPriceStatus"></p>
      <label class="wide pricing-confirmation"><input name="promotedListingEnabled" type="checkbox" ${draft.promotedListingEnabled === true ? "checked" : ""} /> Include promoted listing fee in pricing</label>
      <label>Promoted ad rate (%) <input name="promotedAdRatePercent" type="number" step="0.1" min="0" max="99" value="${draft.promotedAdRatePercent ?? 0}" /></label>
      <label>Quantity <input name="quantity" type="number" min="0" value="${draft.quantity}" /></label>
      <label>Supplier cost currency <select name="costCurrency"><option value="USD" ${(draft.costCurrency || (String(draft.cjProductId).startsWith("CJ-") ? "GBP" : "USD")) === "USD" ? "selected" : ""}>USD</option><option value="GBP" ${(draft.costCurrency || (String(draft.cjProductId).startsWith("CJ-") ? "GBP" : "USD")) === "GBP" ? "selected" : ""}>GBP</option></select></label>
      <label>GBP per USD (including conversion charges) <input name="usdToGbp" type="number" step="0.0001" min="0" value="${draft.usdToGbp ?? ""}" /></label>
      <label>Item cost (supplier currency) <input name="cost" type="number" step="0.01" min="0" required value="${draft.cost}" /></label>
      <label>Shipping cost (supplier currency) <input name="shippingCost" type="number" step="0.01" min="0" required value="${draft.shippingCost ?? ""}" /></label>
      <label>Estimated selling fees (%) <input name="feePercent" type="number" step="0.01" min="0" max="99" value="${draft.feePercent ?? 12.8}" /></label>
      <label>Estimated fixed fee (GBP) <input name="feeFixed" type="number" step="0.01" min="0" value="${draft.feeFixed ?? 0.3}" /></label>
      <label>Other costs per item (GBP) <input name="otherCostsGbp" type="number" step="0.01" min="0" value="${draft.otherCostsGbp ?? 0}" /></label>
      <label class="wide pricing-confirmation"><input name="pricingReviewed" type="checkbox" ${draft.pricingReviewed === true ? "checked" : ""} /> Selected variant, shipping quote and currency conversion confirmed</label>
      <label>Handling days <input name="handlingDays" type="number" min="1" value="${draft.handlingDays}" /></label>
      <label>Delivery estimate <input name="deliveryDays" type="number" min="1" value="${draft.deliveryDays}" /></label>
      <label class="wide">Description <textarea name="description">${escapeHtml(draft.description)}</textarea></label>
      ${itemSpecificsMarkup(draft)}
      <label class="wide">Image URL <input name="image" value="${escapeAttr(draft.image)}" /></label>
      ${supplierGalleryMarkup(draft)}
    </div>
    ${validationMarkup(validation)}
    ${pricingBreakdownMarkup(draft)}
    ${marketCheckMarkup(null, draft)}
    <div class="editor-actions">
      <button type="submit">Save draft</button>
      <button type="button" class="secondary" id="validateButton">Run checks</button>
      <button type="button" class="secondary" id="marketCheckButton">Compare market</button>
      <button type="button" id="publishButton" ${validation.passed ? "" : "disabled"} title="${validation.passed ? "Publish to eBay" : "Run checks and fix the listed issues first"}">Publish to eBay</button>
      <button type="button" class="danger" id="deleteDraftButton">Delete draft</button>
    </div>
  `;

  const updateValidation = (current) => {
    const nextValidation = validateClient(current);
    editor.querySelector(".validation-box").outerHTML = validationMarkup(nextValidation);
    const publishButton = editor.querySelector("#publishButton");
    publishButton.disabled = !nextValidation.passed;
    publishButton.title = nextValidation.passed ? "Publish to eBay" : "Run checks and fix the listed issues first";
  };

  let refreshVariationDisplays = () => {};
  const refreshPricing = () => {
    let current = { ...draft, ...draftFormValues(editor) };
    editor.elements.salePrice.readOnly = current.autoPrice;
    if (current.autoPrice) {
      const target = targetSalePrice(current);
      editor.elements.salePrice.value = target.price == null ? "" : target.price.toFixed(2);
      editor.querySelector("#targetPriceStatus").textContent = target.error || "";
      current = { ...current, salePrice: target.price };
    } else {
      editor.querySelector("#targetPriceStatus").textContent = "";
    }
    refreshVariationDisplays(current);
    updateValidation(current);
    editor.querySelector("#pricingBreakdown").outerHTML = pricingBreakdownMarkup(current);
  };
  refreshPricing();
  bindMarketCheckActions(editor);
  editor.oninput = refreshPricing;
  editor.onchange = refreshPricing;
  const variantSelect = editor.querySelector("#cjVariantSelect");
  if (variantSelect) {
    let requestNumber = 0;
    let quotes = [];
    const shippingSelect = editor.querySelector("#cjShippingSelect");
    const quoteStatus = editor.querySelector("#cjQuoteStatus");
    const applyShipping = () => {
      const quote = quotes.find((item) => item.name === shippingSelect.value);
      editor.elements.shippingCost.value = quote ? quote.price : "";
      editor.elements.pricingReviewed.checked = false;
      refreshPricing();
    };
    const refreshQuote = async () => {
      const currentRequest = ++requestNumber;
      const previousService = shippingSelect.value || draft.cjShippingService;
      quotes = [];
      shippingSelect.innerHTML = '<option value="">Fetching shipping options...</option>';
      editor.elements.cost.value = "";
      editor.elements.shippingCost.value = "";
      editor.elements.pricingReviewed.checked = false;
      refreshPricing();
      if (!variantSelect.value) { quoteStatus.textContent = "Select a variant."; return; }
      quoteStatus.textContent = "Fetching CJ item price and UK shipping quotes...";
      try {
        const response = await fetch("/api/cj/price-quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pid: draft.cjProductId, vid: variantSelect.value, postcode: editor.elements.quotePostcode.value }) });
        const result = await response.json();
        if (currentRequest !== requestNumber) return;
        if (!response.ok) throw new Error(result.error || "CJ quote failed.");
        editor.elements.cost.value = result.cost;
        editor.elements.costCurrency.value = "USD";
        quotes = result.quotes || [];
        shippingSelect.innerHTML = '<option value="">Select shipping service</option>' + quotes.map((quote) => `<option value="${escapeAttr(quote.name)}">${escapeHtml(quote.name)} - ${money(quote.price, "USD")} (${escapeHtml(quote.transit)} days)</option>`).join("");
        const selected = quotes.find((quote) => quote.name === previousService) || quotes.find((quote) => /luwei.*ordinary/i.test(quote.name));
        if (selected) shippingSelect.value = selected.name;
        applyShipping();
        quoteStatus.textContent = result.shippingError || (quotes.length ? "CJ quote: one item, China to UK. Processing time is additional; checkout charges may vary." : "CJ returned no shipping options. Enter a confirmed shipping quote manually.");
      } catch (error) {
        if (currentRequest === requestNumber) quoteStatus.textContent = error.message;
      }
    };
    variantSelect.addEventListener("change", refreshQuote);
    shippingSelect.addEventListener("change", applyShipping);
    editor.elements.quotePostcode.addEventListener("change", refreshQuote);
    editor.querySelector("#refreshCjQuoteButton").addEventListener("click", refreshQuote);
  }
  const variationBuilder = editor.querySelector("#variationBuilder");
  if (variationBuilder) {
    const hiddenRows = editor.elements.listingVariantsJson;
    const status = editor.querySelector("#variationStatus");
    const rowElements = () => [...variationBuilder.querySelectorAll(".variation-row[data-index]")];
    const selectedAxes = () => [...variationBuilder.querySelectorAll("[data-axis-index]")].map((input) => input.value.trim()).filter(Boolean);
    const setInputValue = (node, field, value) => {
      const input = node.querySelector(`[data-field="${field}"]`);
      if (!input || document.activeElement === input) return;
      input.value = value ?? "";
    };
    const readRows = () => {
      const previous = new Map((JSON.parse(hiddenRows.value || "[]")).map((row) => [row.cjVariantId, row]));
      const defaults = defaultListingVariants(draft);
      return rowElements().map((node) => {
        const base = defaults[Number(node.dataset.index)];
        if (!base) return null;
        const old = previous.get(base?.cjVariantId) || {};
        return {
          ...old,
          cjVariantId: base.cjVariantId,
          label: base.label,
          enabled: node.querySelector('[data-field="enabled"]').checked,
          quantity: Number(node.querySelector('[data-field="quantity"]').value || 0),
          cost: node.querySelector('[data-field="cost"]').value === "" ? null : Number(node.querySelector('[data-field="cost"]').value),
          shippingCost: node.querySelector('[data-field="shippingCost"]').value === "" ? null : Number(node.querySelector('[data-field="shippingCost"]').value),
          image: old.image || base.image,
          cjShippingService: old.cjShippingService || "",
          aspects: Object.fromEntries([...node.querySelectorAll('[data-field="aspect"]')].map((input) => [input.dataset.axis, input.value.trim()]))
        };
      }).filter(Boolean);
    };
    const paintRows = (rows, current) => {
      const selected = rows.filter((row) => row.enabled).length;
      status.textContent = selected ? `${selected} selected` : "No variants selected";
      rowElements().forEach((node, index) => {
        const row = rows[index];
        if (!row) return;
        const enabled = node.querySelector('[data-field="enabled"]');
        if (enabled) enabled.checked = row.enabled === true;
        node.querySelectorAll('[data-field="aspect"]').forEach((input) => {
          if (document.activeElement !== input) input.value = row.aspects?.[input.dataset.axis] || "";
        });
        setInputValue(node, "quantity", row.quantity ?? 1);
        setInputValue(node, "cost", row.cost ?? "");
        setInputValue(node, "shippingCost", row.shippingCost ?? "");
        const { prepared, pricing } = variantRowPricing(current, row);
        row.salePrice = prepared?.salePrice ?? row.salePrice ?? null;
        node.querySelector('[data-field="shippingServiceDisplay"]').textContent = row.cjShippingService || row.quoteError || "Quote needed";
        node.querySelector('[data-field="salePriceDisplay"]').textContent = money(row.salePrice);
        node.querySelector('[data-field="marginDisplay"]').textContent = variantMarginText(prepared, pricing);
      });
      hiddenRows.value = JSON.stringify(rows);
    };
    refreshVariationDisplays = (current) => {
      const rows = JSON.parse(hiddenRows.value || "[]");
      paintRows(rows, current);
    };
    const writeRows = (rows, { refresh = true } = {}) => {
      hiddenRows.value = JSON.stringify(rows);
      const current = { ...draft, ...draftFormValues(editor) };
      paintRows(rows, current);
      if (refresh) refreshPricing();
    };
    variationBuilder.addEventListener("input", () => writeRows(readRows()));
    variationBuilder.addEventListener("change", () => writeRows(readRows()));
    variationBuilder.querySelectorAll("[data-axis-index]").forEach((select) => {
      select.addEventListener("change", () => {
        editor.elements.variationAxes.value = selectedAxes().join(",");
        saveDraftFromForm(draft.id).catch((error) => alert(error.message));
      });
    });
    editor.querySelector("#selectCommonVariantsButton").addEventListener("click", () => {
      editor.elements.multiVariation.checked = true;
      const axes = selectedAxes();
      const rows = readRows().map((row) => {
        const values = axes.map((axis) => row.aspects?.[axis] || "").join(" ");
        return { ...row, enabled: /black|gray|grey|khaki|green|blue|white|usb|type|lightning|micro|1m|2m|3m|m|l|xl/i.test(values) };
      });
      writeRows(rows);
    });
    editor.querySelector("#quoteVariantsButton").addEventListener("click", async () => {
      editor.elements.multiVariation.checked = true;
      let rows = readRows();
      const selected = rows.filter((row) => row.enabled);
      if (!selected.length) { status.textContent = "Select at least two variants first."; return; }
      status.textContent = `Quoting 0/${selected.length} variants...`;
      let completed = 0;
      for (const row of rows) {
        if (!row.enabled) continue;
        try {
          const response = await fetch("/api/cj/price-quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pid: draft.cjProductId, vid: row.cjVariantId, postcode: editor.elements.quotePostcode?.value || "" }) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "CJ quote failed.");
          const quotes = result.quotes || [];
          const quote = quotes.find((item) => item.name === row.cjShippingService)
            || quotes.find((item) => /yunexpress ordinary|cjpacket ordinary|luwei ordinary/i.test(item.name))
            || quotes.slice().sort((a, b) => Number(a.price) - Number(b.price))[0];
          row.cost = result.cost;
          row.costCurrency = result.currency || "USD";
          row.shippingCost = quote ? quote.price : null;
          row.cjShippingService = quote?.name || "";
          row.enabled = Boolean(quote);
          row.quoteError = "";
        } catch (error) {
          row.enabled = false;
          row.quoteError = error.message;
        }
        completed += 1;
        status.textContent = `Quoting ${completed}/${selected.length} variants...`;
        writeRows(rows, { refresh: false });
      }
      writeRows(rows);
      status.textContent = "Variant quotes refreshed. Review prices and tick the shared shipping confirmation.";
    });
    writeRows(readRows());
  }
  const categoryResults = editor.querySelector("#ebayCategoryResults");
  const selectedCategory = editor.querySelector("#selectedEbayCategory");
  const findCategoryButton = editor.querySelector("#findEbayCategoryButton");
  const selectEbayCategory = async (category) => {
    editor.elements.ebayCategoryId.value = category.id;
    editor.elements.ebayCategoryName.value = category.name;
    selectedCategory.textContent = category.name;
    categoryResults.innerHTML = "";
    try {
      const schema = await api(`/api/ebay/category-aspects?categoryId=${encodeURIComponent(category.id)}`);
      editor.elements.ebayCategorySchemaJson.value = JSON.stringify(schema);
      const current = { ...draft, ...draftFormValues(editor), ebayCategorySchema: schema };
      editor.elements.variationAxes.value = normalizeVariationAxes(current).join(",");
      await saveDraftFromForm(draft.id);
      return;
    } catch (error) {
      editor.elements.ebayCategorySchemaJson.value = "";
      categoryResults.innerHTML = `<p class="inline-status">${escapeHtml(error.message)}</p>`;
    }
    refreshPricing();
  };
  findCategoryButton.addEventListener("click", async () => {
    const query = editor.elements.ebayCategorySearch.value.trim() || editor.elements.title.value.trim();
    if (!query) {
      categoryResults.innerHTML = '<p class="inline-status">Enter a product title or category search first.</p>';
      return;
    }
    categoryResults.innerHTML = '<p class="inline-status">Searching eBay categories...</p>';
    try {
      const result = await api(`/api/ebay/categories?q=${encodeURIComponent(query)}`);
      const categories = result.categories || [];
      if (!categories.length) {
        categoryResults.innerHTML = '<p class="inline-status">No eBay categories found. Try a shorter search like "mens jacket".</p>';
        return;
      }
      categoryResults.innerHTML = categories.slice(0, 6).map((category) => `
        <button type="button" class="category-result" data-id="${escapeAttr(category.id)}" data-name="${escapeAttr(category.name)}">
          ${escapeHtml(category.name)}
        </button>
      `).join("");
      categoryResults.querySelectorAll(".category-result").forEach((button) => {
        button.addEventListener("click", () => selectEbayCategory({ id: button.dataset.id, name: button.dataset.name }));
      });
    } catch (error) {
      categoryResults.innerHTML = `<p class="inline-status">${escapeHtml(error.message)}</p>`;
    }
  });
  editor.onsubmit = async (event) => {
    event.preventDefault();
    try {
      await saveDraftFromForm(draft.id);
    } catch (error) {
      alert(error.message);
    }
  };
  $("#validateButton").addEventListener("click", async () => {
    try {
      await saveDraftSilently(draft.id);
      const result = await api(`/api/drafts/${draft.id}/validate`, { method: "POST" });
      editor.querySelector(".validation-box").outerHTML = validationMarkup(result.validation);
      const publishButton = editor.querySelector("#publishButton");
      publishButton.disabled = !result.validation.passed;
      publishButton.title = result.validation.passed ? "Publish to eBay" : "Run checks and fix the listed issues first";
    } catch (error) {
      showEditorError(editor, error.message);
    }
  });
  $("#marketCheckButton").addEventListener("click", async () => {
    const button = $("#marketCheckButton");
    button.disabled = true;
    button.textContent = "Comparing...";
    editor.querySelector("#marketCheck").outerHTML = `
      <section class="validation-box market-check" id="marketCheck">
        <strong>Market comparison</strong>
        <p class="meta">Searching eBay for similar active listings...</p>
      </section>
    `;
    try {
      await saveDraftSilently(draft.id, draftFormValues(editor));
      const result = await api(`/api/drafts/${draft.id}/market-check`, { method: "POST" });
      editor.querySelector("#marketCheck").outerHTML = marketCheckMarkup(result.market, { ...draft, ...draftFormValues(editor) });
      bindMarketCheckActions(editor);
    } catch (error) {
      editor.querySelector("#marketCheck").outerHTML = `
        <section class="validation-box market-check fail" id="marketCheck">
          <strong>Market comparison failed</strong>
          <p class="meta">${escapeHtml(error.message)}</p>
        </section>
      `;
    } finally {
      button.disabled = false;
      button.textContent = "Compare market";
    }
  });
  $("#publishButton").addEventListener("click", async () => {
    const button = $("#publishButton");
    button.disabled = true;
    button.textContent = "Uploading...";
    try {
      await saveDraftSilently(draft.id);
      const validation = await api(`/api/drafts/${draft.id}/validate`, { method: "POST" });
      if (!validation.validation?.passed) {
        editor.querySelector(".validation-box").outerHTML = validationMarkup(validation.validation);
        button.disabled = false;
        button.textContent = "Publish to eBay";
        return;
      }
      showEditorStatus(editor, "Uploading to eBay", "Please wait while eBay creates the listing and the app saves the published record.");
      const result = await api(`/api/drafts/${draft.id}/publish`, { method: "POST" });
      if (!result.published?.id) throw new Error("eBay upload finished, but the app did not receive a published listing record.");
      const latest = await api("/api/drafts");
      state.drafts = latest.drafts || [];
      state.published = latest.published || [result.published, ...state.published.filter((item) => item.id !== result.published.id)];
      state.selectedDraftId = state.drafts[0]?.id || null;
      state.selectedPublishedId = result.published.id;
      renderCounts();
      setView("published");
      renderPublished();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Publish to eBay";
      if (error.body?.validation) {
        editor.querySelector(".validation-box").outerHTML = validationMarkup(error.body.validation);
      } else {
        showEditorError(editor, error.message);
      }
    }
  });
  $("#deleteDraftButton").addEventListener("click", async () => {
    if (!window.confirm("Delete this draft? This only removes it from the app; it does not affect eBay.")) return;
    try {
      await api(`/api/drafts/${draft.id}`, { method: "DELETE" });
      state.drafts = state.drafts.filter((item) => item.id !== draft.id);
      state.selectedDraftId = state.drafts[0]?.id || null;
      renderCounts();
      renderDrafts();
    } catch (error) {
      alert(error.message);
    }
  });
}

function supplierGalleryMarkup(draft) {
  const urls = imageUrlList(draft.supplierImages, draft.supplierImage, draft.image).slice(0, 12);
  if (!urls.length) return "";
  return `
    <div class="wide supplier-gallery">
      <strong>Supplier images for eBay (${urls.length})</strong>
      <div>
        ${urls.map((url, index) => `<a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">Image ${index + 1}</a>`).join("")}
      </div>
    </div>
  `;
}

function draftFormValues(form) {
  const formData = new FormData(form);
  const body = Object.fromEntries(formData.entries());
  ["salePrice", "quantity", "cost", "shippingCost", "handlingDays", "deliveryDays", "usdToGbp", "feePercent", "feeFixed", "targetMarginPercent", "targetProfitGbp", "promotedAdRatePercent", "otherCostsGbp"].forEach((key) => {
    body[key] = body[key] === "" ? null : Number(body[key]);
  });
  ["ebayCategorySearch", "ebayCategoryId", "ebayCategoryName"].forEach((key) => {
    if (body[key] != null) body[key] = String(body[key]).trim();
  });
  body.multiVariation = formData.has("multiVariation");
  body.sharedShippingConfirmed = formData.has("sharedShippingConfirmed");
  body.variationAxes = String(body.variationAxes || "Colour,Size").split(",").map((item) => item.trim()).filter(Boolean);
  try {
    body.listingVariants = JSON.parse(body.listingVariantsJson || "[]");
  } catch {
    body.listingVariants = [];
  }
  delete body.listingVariantsJson;
  try {
    body.ebayCategorySchema = body.ebayCategorySchemaJson ? JSON.parse(body.ebayCategorySchemaJson) : null;
  } catch {
    body.ebayCategorySchema = null;
  }
  delete body.ebayCategorySchemaJson;
  body.itemSpecifics = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("specific.")) {
      const name = key.slice("specific.".length);
      if (String(value).trim()) body.itemSpecifics[name] = String(value).trim();
      delete body[key];
    }
  }
  body.pricingReviewed = formData.has("pricingReviewed");
  body.autoPrice = formData.has("autoPrice");
  body.promotedListingEnabled = formData.has("promotedListingEnabled");
  body.priceTargetType = body.priceTargetType === "percent" ? "percent" : "fixed";
  return body;
}

async function saveDraftFromForm(id) {
  const body = draftFormValues($("#draftEditor"));
  await saveDraftSilently(id, body);
  renderDrafts();
}

async function saveDraftSilently(id, body = draftFormValues($("#draftEditor"))) {
  const result = await api(`/api/drafts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  const index = state.drafts.findIndex((draft) => draft.id === id);
  if (index >= 0) state.drafts[index] = result.draft;
  return result;
}

function estimateFees(price) {
  return Number((price * 0.128 + 0.3).toFixed(2));
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
        // Continue with regex extraction.
      }
    }
    const matches = trimmed.match(/https:\/\/[^"',\]\s]+/g);
    if (matches) matches.forEach((url) => urls.push(url));
    return;
  }
  if (typeof value === "object") {
    ["url", "image", "img", "bigImg", "bigImage", "imageUrl", "productImage", "productImageUrl", "productImageSet", "productImageUrls", "variantImage"].forEach((key) =>
      collectImageUrls(urls, value[key])
    );
  }
}

function validateClient(draft) {
  if (draft.ebayCategorySchema?.categoryId === draft.ebayCategoryId) draft = alignVariationAxesToSchema(draft, draft.ebayCategorySchema);
  draft = collapseSingleVariation(draft);
  if (draft.multiVariation) {
    const rows = listingRows(draft);
    const failures = [...variationErrors(draft)];
    if (draft.ebayCategorySchema?.categoryId === draft.ebayCategoryId) failures.push(...categoryErrors(draft, draft.ebayCategorySchema));
    const checks = rows.map((row) => validateClient(row));
    failures.push(...checks.flatMap((check, index) => check.failures.map((failure) => `${rows[index]?.label || rows[index]?.sku || `Variation ${index + 1}`}: ${failure}`)));
    if (!/^\d+$/.test(draft.ebayCategoryId || "")) failures.push("Choose an eBay category.");
    const margins = checks.map((check) => check.marginPercent).filter((value) => value != null);
    const summary = checks[mainListingRowIndex(draft, rows)] || {};
    return {
      passed: failures.length === 0,
      failures: [...new Set(failures)],
      warnings: [...new Set(checks.flatMap((check) => check.warnings))],
      landedCost: summary.landedCost ?? null,
      estimatedFees: summary.estimatedFees ?? null,
      margin: summary.margin ?? null,
      marginPercent: margins.length ? Math.min(...margins) : null
    };
  }

  const pricing = draftPricing(draft);
  const { landedCost: landed, estimatedFees: fees, margin, marginPercent } = pricing;
  const failures = [...pricing.failures];
  if (draft.autoPrice === true) {
    const target = targetSalePrice(draft);
    if (target.error) failures.push(target.error);
  }
  const warnings = [];
  if (!draft.title || draft.title.length < 12) failures.push("Title needs more detail.");
  if (draft.title?.length > 80) failures.push("eBay titles should stay within 80 characters.");
  if (!draft.description || draft.description.length < 40) failures.push("Description is too thin.");
  if (!draft.category) failures.push("Category is required.");
  if (!/^\d+$/.test(draft.ebayCategoryId || "")) failures.push("Choose an eBay category.");
  if (draft.ebayCategorySchema?.categoryId === draft.ebayCategoryId) failures.push(...categoryErrors(draft, draft.ebayCategorySchema));
  if (draft.source === "cj" && !String(draft.cjProductId || "").startsWith("CJ-") && !draft.cjVariantId) failures.push("Select a CJ variant.");
  if (draft.quantity < 1) failures.push("Quantity must be at least 1.");
  if (draft.quantity > draft.stock) failures.push("Quantity is higher than CJ stock.");
  if (!draft.image) failures.push("At least one image is required.");
  if (!imageUrlList(draft.supplierImages, draft.supplierImage, draft.image).length) failures.push("A real supplier image URL is required for eBay publishing.");
  if (draft.priceTargetType === "percent" && marginPercent < Number(draft.targetMarginPercent ?? 15)) warnings.push("Margin is below the target.");
  if ((draft.priceTargetType || "fixed") !== "percent" && margin < Number(draft.targetProfitGbp ?? 5)) warnings.push("Profit is below the target.");
  if (draft.deliveryDays > 10) warnings.push("Delivery estimate is slow for eBay buyers.");
  return { passed: failures.length === 0, failures: [...new Set(failures)], warnings, landedCost: landed, estimatedFees: fees, margin, marginPercent };
}

function renderPublished() {
  const list = $("#publishedList");
  const detail = $("#publishedDetail");
  if (!state.published.length) {
    list.innerHTML = '<div class="empty-state">Published listings will appear here after drafts pass checks.</div>';
    detail.innerHTML = '<div class="empty-state">Select a published listing to inspect pricing, sales, and eBay status.</div>';
    return;
  }

  if (!state.published.some((item) => item.id === state.selectedPublishedId)) {
    state.selectedPublishedId = state.published[0].id;
  }

  list.innerHTML = state.published.map((item) => {
    const row = mainPublishedRow(item);
    const pricing = draftPricing(row);
    const listingId = String(item.ebayListingId || "");
    const listingUrl = ebayListingUrl(item);
    return `
      <button type="button" class="published-item ${item.id === state.selectedPublishedId ? "active" : ""}" data-published-id="${escapeAttr(item.id)}">
        ${productVisual(item)}
        <span>
          <strong>${escapeHtml(item.title)}</strong>
          <span class="meta">${escapeHtml(row.sku || item.sku)} / ${money(row.salePrice)} / ${money(pricing.margin)} margin</span>
          <span class="meta">eBay listing: ${escapeHtml(listingId || "Not returned")}${listingUrl ? ` / Open in detail` : ""}</span>
        </span>
        <span class="badge ${item.status === "withdrawn" ? "badge-muted" : ""}">${publishedModeLabel(item)}</span>
      </button>
    `;
  }).join("");

  list.querySelectorAll("[data-published-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPublishedId = button.dataset.publishedId;
      renderPublished();
    });
  });

  renderPublishedDetail(state.published.find((item) => item.id === state.selectedPublishedId));
}

function mainPublishedRow(item) {
  const rows = listingRows(item);
  const index = mainListingRowIndex(item, rows);
  return rows[index] || item;
}

function ebayListingUrl(item) {
  const listingId = String(item.ebayListingId || "");
  if (!/^\d+$/.test(listingId)) return "";
  const base = item.publishedMode === "sandbox" ? "https://sandbox.ebay.com/itm/" : "https://www.ebay.co.uk/itm/";
  return `${base}${encodeURIComponent(listingId)}`;
}

function publishedModeLabel(item) {
  if (item.status === "withdrawn") return "Withdrawn";
  if (item.publishedMode === "simulated") return "Simulated";
  if (item.publishedMode === "sandbox") return "Sandbox";
  return "Live";
}

function renderPublishedDetail(item) {
  const detail = $("#publishedDetail");
  if (!item) {
    detail.innerHTML = '<div class="empty-state">Select a published listing to inspect pricing, sales, and eBay status.</div>';
    return;
  }

  const row = mainPublishedRow(item);
  const pricing = draftPricing(row);
  const rows = listingRows(item);
  const listingUrl = ebayListingUrl(item);
  const history = Array.isArray(item.priceHistory) ? item.priceHistory.slice(-10).reverse() : [];
  const sales = publishedSalesFor(item);
  const latestSaleDate = sales.orders[0]?.createdAt ? new Date(sales.orders[0].createdAt).toLocaleDateString() : "No sales found";

  detail.innerHTML = `
    <article class="published-detail-panel">
      <div class="published-detail-header">
        <div>
          <p class="eyebrow">${escapeHtml(publishedModeLabel(item))} listing</p>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="meta">${escapeHtml(row.sku || item.sku)}${item.ebayListingId ? ` / eBay ${escapeHtml(item.ebayListingId)}` : ""}</p>
        </div>
        ${listingUrl ? `<a class="detail-link" href="${escapeAttr(listingUrl)}" target="_blank" rel="noreferrer">Open on eBay</a>` : ""}
      </div>

      <section class="detail-section">
        <h4>Pricing breakdown</h4>
        <div class="detail-metrics">
          <div class="metric"><span>Sale price</span><strong>${money(row.salePrice)}</strong></div>
          <div class="metric"><span>Landed cost</span><strong>${money(pricing.landedCost)}</strong></div>
          <div class="metric"><span>Estimated eBay fees</span><strong>${money(pricing.estimatedFees)}</strong></div>
          <div class="metric"><span>Promoted ad fee</span><strong>${money(pricing.promotedAdFee)}</strong></div>
          <div class="metric"><span>Margin</span><strong>${money(pricing.margin)}</strong></div>
          <div class="metric"><span>Margin percent</span><strong>${pricing.marginPercent == null ? "Not calculated" : `${pricing.marginPercent}%`}</strong></div>
          <div class="metric"><span>Target</span><strong>${item.priceTargetType === "percent" ? `${item.targetMarginPercent ?? "Not set"}%` : `${money(item.targetProfitGbp ?? 5)} profit`}</strong></div>
        </div>
        <div class="detail-table-wrap">
          <table class="detail-table">
            <tbody>
              <tr><th>Item cost</th><td>${money(row.cost, row.costCurrency || "USD")}</td></tr>
              <tr><th>CJ shipping</th><td>${money(row.shippingCost, row.costCurrency || "USD")}</td></tr>
              <tr><th>Conversion</th><td>${row.costCurrency === "GBP" ? "GBP costs" : `${row.usdToGbp || "Not set"} GBP per USD`}</td></tr>
              <tr><th>Other costs</th><td>${money(row.otherCostsGbp || 0)}</td></tr>
              <tr><th>Promoted listing</th><td>${row.promotedListingEnabled ? `${row.promotedAdRatePercent || 0}% ad rate included in pricing` : "Not included"}</td></tr>
              <tr><th>Stock listed</th><td>${escapeHtml(row.quantity ?? item.quantity ?? "Not set")}</td></tr>
              <tr><th>Published</th><td>${item.publishedAt ? new Date(item.publishedAt).toLocaleString() : "Unknown"}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      ${rows.length > 1 ? renderPublishedVariants(rows) : ""}

      <section class="detail-section">
        <h4>Promotion pricing</h4>
        <form id="publishedPromotionForm" class="promotion-form">
          <label class="pricing-confirmation"><input name="promotedListingEnabled" type="checkbox" ${item.promotedListingEnabled === true ? "checked" : ""} /> Include promoted listing fee in profit calculations</label>
          <label>Ad rate (%) <input name="promotedAdRatePercent" type="number" min="0" max="99" step="0.1" value="${item.promotedAdRatePercent ?? 0}" /></label>
          <button type="submit">Save promotion pricing</button>
          <p class="inline-status" id="promotionPricingStatus">This does not start an eBay promoted listing campaign yet.</p>
        </form>
      </section>

      <section class="detail-section">
        <h4>Sales</h4>
        <div class="detail-metrics">
          <div class="metric"><span>Units sold</span><strong>${sales.units}</strong></div>
          <div class="metric"><span>Revenue</span><strong>${money(sales.revenue)}</strong></div>
          <div class="metric"><span>Orders matched</span><strong>${sales.orders.length}</strong></div>
          <div class="metric"><span>Latest sale</span><strong>${escapeHtml(latestSaleDate)}</strong></div>
        </div>
        ${state.publishedSalesError ? `<p class="inline-status">${escapeHtml(state.publishedSalesError)}</p>` : renderSalesGraph(sales.days)}
      </section>

      <section class="detail-section">
        <h4>Price history</h4>
        ${
          history.length
            ? `<div class="detail-table-wrap"><table class="detail-table"><thead><tr><th>Date</th><th>Sale price</th><th>Landed</th><th>Margin</th><th>Note</th></tr></thead><tbody>${history.map((entry) => `<tr><td>${entry.checkedAt ? new Date(entry.checkedAt).toLocaleString() : ""}</td><td>${money(entry.salePrice)}</td><td>${money(entry.landedCost)}</td><td>${money(entry.margin)}</td><td>${escapeHtml(entry.reason || entry.status || "")}</td></tr>`).join("")}</tbody></table></div>`
            : '<p class="meta">No price tracking history has been recorded yet.</p>'
        }
      </section>

      <section class="detail-section published-actions">
        <div>
          <h4>eBay action</h4>
          <p class="meta">Withdraw ends the live eBay listing but keeps this local record for tracking.</p>
        </div>
        <button type="button" class="danger-action" id="withdrawListingButton" ${item.status === "withdrawn" ? "disabled" : ""}>${item.status === "withdrawn" ? "Already withdrawn" : "Withdraw from eBay"}</button>
        <p class="inline-status" id="withdrawListingStatus"></p>
      </section>
    </article>
  `;

  const withdrawButton = $("#withdrawListingButton");
  if (withdrawButton && item.status !== "withdrawn") {
    withdrawButton.addEventListener("click", () => withdrawPublishedListing(item.id));
  }
  const promotionForm = $("#publishedPromotionForm");
  if (promotionForm) promotionForm.addEventListener("submit", (event) => savePublishedPromotion(event, item.id));
}

function renderPublishedVariants(rows) {
  return `
    <section class="detail-section">
      <h4>Variants</h4>
      <div class="detail-table-wrap">
        <table class="detail-table">
          <thead><tr><th>Variant</th><th>SKU</th><th>Sale</th><th>Landed</th><th>Margin</th><th>Qty</th></tr></thead>
          <tbody>
            ${rows.map((row) => {
              const pricing = draftPricing(row);
              return `<tr><td>${escapeHtml(row.label || row.cjVariantName || row.cjVariantId || "Variant")}</td><td>${escapeHtml(row.sku)}</td><td>${money(row.salePrice)}</td><td>${money(pricing.landedCost)}</td><td>${money(pricing.margin)}</td><td>${escapeHtml(row.quantity ?? "")}</td></tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function publishedSalesFor(item) {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    const key = date.toISOString().slice(0, 10);
    return { key, label: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), units: 0, revenue: 0 };
  });
  const byDate = new Map(days.map((day) => [day.key, day]));
  const orders = [];
  const listingId = String(item.ebayListingId || "");
  for (const order of state.publishedSales?.orders || []) {
    const matches = (order.items || []).filter((line) => String(line.listingId || "") === listingId);
    if (!matches.length) continue;
    orders.push(order);
    const key = String(order.createdAt || "").slice(0, 10);
    const bucket = byDate.get(key);
    for (const line of matches) {
      const quantity = Number(line.quantity || 0);
      const value = Number(line.total?.value || 0);
      if (bucket) {
        bucket.units += quantity;
        bucket.revenue += value;
      }
    }
  }
  return {
    days,
    orders,
    units: days.reduce((sum, day) => sum + day.units, 0),
    revenue: Number(days.reduce((sum, day) => sum + day.revenue, 0).toFixed(2))
  };
}

function renderSalesGraph(days) {
  const max = Math.max(1, ...days.map((day) => day.units));
  if (!days.some((day) => day.units > 0)) return '<p class="meta">No matched eBay sales found in the last 14 days.</p>';
  return `
    <div class="sales-bars" aria-label="Units sold over the last 14 days">
      ${days.map((day) => `<div class="sales-bar"><span style="height: ${Math.max(8, Math.round(day.units / max * 100))}%"></span><small>${escapeHtml(day.label)}</small></div>`).join("")}
    </div>
  `;
}

async function loadPublishedSales() {
  try {
    const result = await api("/api/orders?days=90&offset=0");
    state.publishedSales = result;
    state.publishedSalesError = "";
  } catch (error) {
    state.publishedSales = { orders: [] };
    state.publishedSalesError = `Sales unavailable: ${error.message}`;
  }
  if ($("#publishedView").classList.contains("active")) renderPublished();
}

async function withdrawPublishedListing(id) {
  if (!window.confirm("Withdraw this listing from eBay? This ends the active listing but keeps the record in this app.")) return;
  const button = $("#withdrawListingButton");
  const status = $("#withdrawListingStatus");
  button.disabled = true;
  status.textContent = "Withdrawing listing...";
  try {
    const result = await api(`/api/published/${encodeURIComponent(id)}/withdraw`, { method: "POST", body: "{}" });
    const index = state.published.findIndex((item) => item.id === id);
    if (index >= 0) state.published[index] = result.published;
    renderPublished();
  } catch (error) {
    status.textContent = error.message;
    button.disabled = false;
  }
}

async function savePublishedPromotion(event, id) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = $("#promotionPricingStatus");
  const submit = form.querySelector("button[type=submit]");
  const body = {
    promotedListingEnabled: new FormData(form).has("promotedListingEnabled"),
    promotedAdRatePercent: Number(form.elements.promotedAdRatePercent.value || 0)
  };
  submit.disabled = true;
  status.textContent = "Saving promotion pricing...";
  try {
    const result = await api(`/api/published/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
    const index = state.published.findIndex((item) => item.id === id);
    if (index >= 0) state.published[index] = result.published;
    renderPublished();
  } catch (error) {
    status.textContent = error.message;
    submit.disabled = false;
  }
}

function renderSettings() {
  const status = $("#settingsStatus");
  const settings = state.settings || {};
  const oauth = settings.ebayOauth || {};
  const ebayToken = settings.ebayToken || {};
  const ebayProfile = settings.ebayProfile || {};
  const publishingSetup = settings.ebayPublishingSetup;
  const publishingStatus = publishingSetup
    ? !publishingSetup.connectionReady ? "Connect eBay for this environment"
      : publishingSetup.missing.length ? "Missing publishing selections: " + publishingSetup.missing.join(", ")
      : "Configured"
    : settings.ebayReady ? "Configured" : "Publishing selections not confirmed";
  const environmentLabel = oauth.environment === "production" ? "Production" : "Sandbox";
  const cjToken = settings.cjToken || {};
  const tokenSaved = ebayToken.savedAt ? new Date(ebayToken.savedAt).toLocaleString() : "Not connected yet";
  const cjExpires = cjToken.expiresAt ? new Date(cjToken.expiresAt).toLocaleString() : "Not connected yet";
  $("#modeText").textContent = settings.ebayLivePublish
    ? oauth.environment === "sandbox"
      ? "Sandbox eBay publishing enabled"
      : "Live eBay mode enabled"
    : settings.hostedDemo
      ? "Phone demo: local sample data and simulated publishing"
      : `${settings.cjLive ? "Live CJ import" : "CJ samples"}; eBay publishing disabled`;
  status.innerHTML = `
    <div class="status-line"><strong>CJ live product import</strong><span>${settings.cjLive ? "Ready" : "Sample mode"}</span></div>
    <div class="status-line"><strong>CJ API key</strong><span>${cjToken.apiKeyReady ? "Set locally" : "Add CJ_API_KEY to .env"}</span></div>
    <div class="status-line"><strong>CJ access token</strong><span>${cjToken.connected ? `Connected ${cjExpires}` : "Not connected yet"}</span></div>
    <div class="status-line"><strong>eBay OAuth app</strong><span>${oauth.clientIdReady && oauth.runameReady ? "Configured" : "Needs App ID/RuName"}</span></div>
    <div class="status-line"><strong>Client Secret</strong><span>${oauth.clientSecretReady ? "Set locally" : "Paste Cert ID in .env"}</span></div>
    <div class="status-line"><strong>eBay ${environmentLabel} account</strong><span>${ebayToken.connected ? `Connected ${tokenSaved}` : "Not connected yet"}</span></div>
    <div class="status-line"><strong>Linked eBay account</strong><span id="linkedEbayAccount">${escapeHtml(ebayProfile.username || ebayProfile.message || (ebayToken.connected ? "Account name unavailable. Refresh to retry." : "Not connected yet"))}</span></div>
    <div class="status-line"><strong>Publishing setup</strong><span>${escapeHtml(publishingStatus)}</span></div>
    ${(publishingSetup?.selections || []).map(item => `<div class="status-line"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.value || "Not selected in hosted app")}</span></div>`).join("")}
    <div class="status-line"><strong>eBay ${oauth.environment === "sandbox" ? "sandbox" : "live"} publishing</strong><span>${settings.ebayLivePublish ? "Enabled" : "Disabled"}</span></div>
    ${
      oauth.environment === "production"
        ? `<div class="status-line"><strong>Production confirmation</strong><span>${settings.ebayProductionConfirmed ? "Armed" : "Blocked"}</span></div>`
        : ""
    }
    <div class="oauth-panel">
      <p><strong>CJ API</strong><br />Use this to switch from sample products to real CJ products and product-specific galleries.</p>
      <button type="button" id="connectCjButton">Connect CJ API</button>
      <p id="cjConnectStatus" class="inline-status"></p>
    </div>
    <div class="oauth-panel">
      <p><strong>${environmentLabel} RuName</strong><br />${escapeHtml(oauth.runame || "Not set")}</p>
      <p><strong>Auth Accepted URL</strong><br /><code>http://localhost:5173/auth/ebay/callback</code></p>
      <p><strong>Auth Declined URL</strong><br /><code>http://localhost:5173/auth/ebay/declined</code></p>
      <p><strong>Privacy Policy URL</strong><br /><code>https://YOUR-GITHUB-USERNAME.github.io/cj-ebay-listing-control/privacy.html</code></p>
      <button type="button" id="connectEbayButton">${ebayToken.connected ? "Reconnect" : "Connect"} eBay ${environmentLabel}</button>
      <button type="button" id="checkEbaySetupButton">Check eBay setup</button>
      <button type="button" id="optInPoliciesButton">Opt into eBay business policies</button>
      <div class="manual-oauth">
        <p><strong>CJ dispatch location</strong><br />Jinhua, Zhejiang, China</p>
        <button type="button" id="registerCjLocationButton">Register Jinhua location</button>
        <p id="cjLocationStatus" class="inline-status"></p>
      </div>
      <div id="ebaySetupResults" class="setup-results"></div>
      <div class="manual-oauth">
        <label for="manualEbayCode">If eBay does not redirect back, paste the final eBay URL or authorization code here</label>
        <textarea id="manualEbayCode" rows="3" spellcheck="false"></textarea>
        <button type="button" id="exchangeEbayCodeButton">Save eBay connection</button>
        <p id="manualEbayCodeStatus" class="inline-status"></p>
      </div>
    </div>
  `;
  $("#connectCjButton").addEventListener("click", connectCjApi);
  $("#connectEbayButton").addEventListener("click", connectEbaySandbox);
  $("#checkEbaySetupButton").addEventListener("click", checkEbaySetup);
  $("#optInPoliciesButton").addEventListener("click", optIntoPolicies);
  $("#registerCjLocationButton").addEventListener("click", registerCjLocation);
  $("#exchangeEbayCodeButton").addEventListener("click", exchangeEbayCodeManually);
  renderEbaySetupResults();
}

async function registerCjLocation() {
  const button = $("#registerCjLocationButton");
  const status = $("#cjLocationStatus");
  button.disabled = true;
  status.textContent = "Registering location...";
  try {
    const response = await fetch("/api/ebay/locations/cj-jinhua", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Location registration failed.");
    status.textContent = `Registered in ${result.environment}. Set EBAY_MERCHANT_LOCATION_KEY to ${result.merchantLocationKey} in Render, then save and deploy.`;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function connectCjApi() {
  const status = $("#cjConnectStatus");
  status.textContent = "Connecting CJ API...";
  try {
    await api("/api/cj/connect", { method: "POST", body: JSON.stringify({}) });
    state.settings = await api("/api/settings");
    status.textContent = "Connected. Refreshing settings...";
    renderSettings();
  } catch (error) {
    status.textContent = error.message;
  }
}

async function connectEbaySandbox() {
  try {
    const result = await api("/api/ebay/auth-url");
    window.location.href = result.url;
  } catch (error) {
    alert(error.message);
  }
}

async function checkEbaySetup() {
  const results = $("#ebaySetupResults");
  results.innerHTML = '<p class="inline-status">Checking eBay account setup...</p>';
  try {
    state.ebayAccountSetup = await api("/api/ebay/account-setup");
    renderEbaySetupResults();
  } catch (error) {
    results.innerHTML = `<p class="inline-status">${escapeHtml(error.message)}</p>`;
  }
}

async function optIntoPolicies() {
  const results = $("#ebaySetupResults");
  results.innerHTML = '<p class="inline-status">Opting seller into business policies...</p>';
  try {
    await api("/api/ebay/opt-in-selling-policies", { method: "POST" });
  } catch (error) {
    results.innerHTML = `<p class="inline-status">Business policy opt-in failed: ${escapeHtml(error.message)}</p>`;
    return;
  }
  results.innerHTML = '<p class="inline-status">Opted in. Checking eBay setup again...</p>';
  try {
    state.ebayAccountSetup = await api("/api/ebay/account-setup");
    renderEbaySetupResults();
  } catch (error) {
    results.innerHTML = `<p class="inline-status">Business policy opt-in succeeded, but the account setup check failed: ${escapeHtml(error.message)}</p>`;
  }
}

function renderEbaySetupResults() {
  const results = $("#ebaySetupResults");
  if (!results) return;
  const setup = state.ebayAccountSetup;
  if (!setup) {
    results.innerHTML = "";
    return;
  }

  const groups = [
    ["Merchant location", setup.locations, (item) => item.merchantLocationKey || item.name || "Unknown location"],
    ["Payment policy", setup.paymentPolicies, (item) => item.paymentPolicyId || item.name || "Unknown payment policy"],
    ["Return policy", setup.returnPolicies, (item) => item.returnPolicyId || item.name || "Unknown return policy"],
    ["Fulfilment policy", setup.fulfillmentPolicies, (item) => item.fulfillmentPolicyId || item.name || "Unknown fulfilment policy"]
  ];

  results.innerHTML = `
    <div class="setup-results-grid">
      ${groups
        .map(([label, items, pickId]) => {
          const list = Array.isArray(items) && items.length ? items : [];
          return `
            <section>
              <h4>${label}</h4>
              ${
                list.length
                  ? list
                      .map((item) => `<code>${escapeHtml(pickId(item))}</code><span>${escapeHtml(item.name || item.location?.address?.city || "")}</span>`)
                      .join("")
                  : '<p class="inline-status">None found in sandbox</p>'
              }
            </section>
          `;
        })
        .join("")}
    </div>
  `;
}

async function exchangeEbayCodeManually() {
  const input = $("#manualEbayCode");
  const status = $("#manualEbayCodeStatus");
  const value = input.value.trim();
  if (!value) {
    status.textContent = "Paste the eBay URL or code first.";
    return;
  }

  status.textContent = "Checking eBay code...";
  try {
    await api("/api/ebay/exchange-code", {
      method: "POST",
      body: JSON.stringify({ callbackUrl: value })
    });
    input.value = "";
    status.textContent = "Connected. Refreshing settings...";
    state.settings = await api("/api/settings");
    renderSettings();
  } catch (error) {
    status.textContent = error.message;
  }
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

function demoGalleryForProduct(product) {
  const group = primaryProductGroup(product);
  return imageUrlList(product.image, demoImageGalleries[group], demoImageGalleries.trending);
}

function supplierImagesForProduct(product) {
  return imageUrlList(product.supplierImages, product.images, product.galleryImages, product.image, product.productImageSet, product.imageUrls);
}

function productInitials(product) {
  return String(product.title || product.productNameEn || "CJ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function productVisual(product) {
  const title = product.title || product.productNameEn || "CJ product";
  if (product.image && !String(product.image).startsWith("demo:") && !isSampleProduct(product)) {
    return `<img src="${escapeAttr(product.image)}" alt="${escapeAttr(title)}" />`;
  }
  const group = primaryProductGroup(product);
  return `
    <div class="product-visual visual-${group}" role="img" aria-label="${escapeAttr(title)}">
      <span>${escapeHtml(productInitials(product))}</span>
      <small>${escapeHtml(group)}</small>
    </div>
  `;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value = "") {
  return escapeHtml(value).replaceAll("'", "&#039;");
}

async function loadProducts() {
  const keyword = encodeURIComponent($("#keywordInput").value);
  const category = encodeURIComponent($("#categoryInput").value);
  const warehouse = encodeURIComponent($("#warehouseInput").value);
  const result = await api(`/api/products?keyword=${keyword}&category=${category}&warehouse=${warehouse}`);
  state.products = result.products;
  renderProducts();
}

async function loadAll() {
  const [settings, drafts] = await Promise.all([api("/api/settings"), api("/api/drafts")]);
  state.settings = settings;
  state.drafts = drafts.drafts;
  state.published = drafts.published;
  renderSettings();
  renderCounts();
  renderDrafts();
  renderPublished();
  await loadProducts();
}

document.querySelectorAll(".nav-tab").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

$("#searchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await loadProducts();
});

$("#researchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await loadResearch();
});

$("#categoryInput").addEventListener("change", async () => {
  syncCategoryChips();
  await loadProducts();
});

document.querySelectorAll(".category-chip").forEach((button) => {
  button.addEventListener("click", async () => {
    $("#categoryInput").value = button.dataset.category;
    syncCategoryChips();
    await loadProducts();
  });
});

function syncCategoryChips() {
  const category = $("#categoryInput").value;
  document.querySelectorAll(".category-chip").forEach((button) => {
    button.classList.toggle("active", button.dataset.category === category);
  });
}

$("#refreshButton").addEventListener("click", () => $("#ordersView").classList.contains("active") ? ordersView.load() : $("#repricingView").classList.contains("active") ? repricingView.load() : $("#researchView").classList.contains("active") ? loadResearch() : loadAll());

loadAll().catch((error) => {
  $("#productGrid").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
