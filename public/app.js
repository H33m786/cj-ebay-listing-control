import { draftPricing, targetSalePrice, applyTargetPrice } from "./pricing.js";
import { createOrdersView } from "./orders.js";
const ordersView = createOrdersView(document.querySelector("#ordersView"));
import { createRepricingView } from "./repricing.js";
const repricingView = createRepricingView(document.querySelector("#repricingView"));

const state = {
  products: [],
  drafts: [],
  published: [],
  selectedDraftId: null,
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
  return {
    id: crypto.randomUUID(),
    source: "cj",
    cjProductId: product.pid,
    sku: `${product.sku}-${Date.now().toString().slice(-5)}`,
    title: product.title,
    description: `${product.title}. Shipped by supplier from ${product.warehouse} warehouse. Confirm shipping estimates before publishing.`,
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

  const draftMatch = url.pathname.match(/^\/api\/drafts\/([^/]+)(?:\/(validate|publish))?$/);
  if (draftMatch) {
    const [, id, action] = draftMatch;
    const index = store.drafts.findIndex((draft) => draft.id === id);
    if (index === -1) throw originalError;

    if (options.method === "PATCH" && !action) {
      store.drafts[index] = applyTargetPrice({ ...store.drafts[index], ...JSON.parse(options.body), updatedAt: new Date().toISOString() });
      writeHostedStore(store);
      return { draft: store.drafts[index], validation: validateClient(store.drafts[index]) };
    }

    if (options.method === "POST" && action === "validate") {
      return { validation: validateClient(store.drafts[index]) };
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

function renderEditor(draft) {
  const editor = $("#draftEditor");
  if (!draft) {
    editor.innerHTML = '<div class="empty-state">Select a draft to edit.</div>';
    return;
  }

  const validation = validateClient(draft);
  editor.innerHTML = `
    <div class="editor-grid">
      <label class="wide">Title <input name="title" maxlength="80" value="${escapeAttr(draft.title)}" /></label>
      <label>SKU <input name="sku" value="${escapeAttr(draft.sku)}" /></label>
      <label>Category <input name="category" value="${escapeAttr(draft.category)}" /></label>
      ${Array.isArray(draft.variants) && draft.variants.some((item) => item?.vid) ? `
      <label class="wide">CJ size / colour <select name="cjVariantId" id="cjVariantSelect"><option value="">Select variant</option>${draft.variants.filter((item) => item?.vid).map((item) => `<option value="${escapeAttr(item.vid)}" ${draft.cjVariantId === item.vid ? "selected" : ""}>${escapeHtml(item.variantKey || item.variantNameEn || item.variantSku)}</option>`).join("")}</select></label>
      <label>UK destination postcode (optional) <input name="quotePostcode" value="${escapeAttr(draft.quotePostcode || "")}" /></label>
      <label>China to UK shipping (one item) <select name="cjShippingService" id="cjShippingSelect"><option value="${escapeAttr(draft.cjShippingService || "")}">${escapeHtml(draft.cjShippingService || "Select variant first")}</option></select></label>
      <button type="button" id="refreshCjQuoteButton">Refresh CJ prices</button>
      <p class="wide inline-status" id="cjQuoteStatus"></p>` : ""}
      <label class="wide pricing-confirmation"><input name="autoPrice" type="checkbox" ${draft.autoPrice !== false ? "checked" : ""} /> Calculate sale price from target margin</label>
      <label>Target profit margin (%) <input name="targetMarginPercent" type="number" step="0.1" min="0.1" max="99.9" value="${draft.targetMarginPercent ?? 25}" /></label>
      <label>Sale price (GBP) <input name="salePrice" type="number" step="0.01" min="0" value="${draft.salePrice ?? ""}" /></label>
      <p class="wide inline-status" id="targetPriceStatus"></p>
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
      <label class="wide">Image URL <input name="image" value="${escapeAttr(draft.image)}" /></label>
      ${supplierGalleryMarkup(draft)}
    </div>
    ${validationMarkup(validation)}
    <div class="editor-actions">
      <button type="submit">Save draft</button>
      <button type="button" class="secondary" id="validateButton">Run checks</button>
      <button type="button" id="publishButton">Publish to eBay</button>
    </div>
  `;

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
    editor.querySelector(".validation-box").outerHTML = validationMarkup(validateClient(current));
  };
  refreshPricing();
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
      await saveDraftFromForm(draft.id);
      const result = await api(`/api/drafts/${draft.id}/validate`, { method: "POST" });
      editor.querySelector(".validation-box").outerHTML = validationMarkup(result.validation);
    } catch (error) {
      alert(error.message);
    }
  });
  $("#publishButton").addEventListener("click", async () => {
    try {
      await saveDraftFromForm(draft.id);
      const result = await api(`/api/drafts/${draft.id}/publish`, { method: "POST" });
      state.published.unshift(result.published);
      state.drafts = state.drafts.filter((item) => item.id !== draft.id);
      state.selectedDraftId = state.drafts[0]?.id || null;
      renderCounts();
      renderDrafts();
      renderPublished();
      setView("published");
    } catch (error) {
      if (error.body?.validation) {
        editor.querySelector(".validation-box").outerHTML = validationMarkup(error.body.validation);
      } else {
        alert(error.message);
      }
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
  ["salePrice", "quantity", "cost", "shippingCost", "handlingDays", "deliveryDays", "usdToGbp", "feePercent", "feeFixed", "targetMarginPercent", "otherCostsGbp"].forEach((key) => {
    body[key] = body[key] === "" ? null : Number(body[key]);
  });
  body.pricingReviewed = formData.has("pricingReviewed");
  body.autoPrice = formData.has("autoPrice");
  return body;
}

async function saveDraftFromForm(id) {
  const body = draftFormValues($("#draftEditor"));
  const result = await api(`/api/drafts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  const index = state.drafts.findIndex((draft) => draft.id === id);
  state.drafts[index] = result.draft;
  renderDrafts();
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
  if (draft.quantity < 1) failures.push("Quantity must be at least 1.");
  if (draft.quantity > draft.stock) failures.push("Quantity is higher than CJ stock.");
  if (!draft.image) failures.push("At least one image is required.");
  if (!imageUrlList(draft.supplierImages, draft.supplierImage, draft.image).length) failures.push("A real supplier image URL is required for eBay publishing.");
  if (marginPercent < 15) warnings.push("Margin is below the 15% target.");
  if (draft.deliveryDays > 10) warnings.push("Delivery estimate is slow for eBay buyers.");
  return { passed: failures.length === 0, failures, warnings, landedCost: landed, estimatedFees: fees, margin, marginPercent };
}

function renderPublished() {
  const list = $("#publishedList");
  if (!state.published.length) {
    list.innerHTML = '<div class="empty-state">Published listings will appear here after drafts pass checks.</div>';
    return;
  }
  list.innerHTML = state.published
    .map(
      (item) => `
      <article class="published-item">
        ${productVisual(item)}
        <div>
          <h3>${escapeHtml(item.title)}</h3>
          <p class="meta">${item.sku} / ${money(item.salePrice)} / ${item.quantity} units</p>
          <p class="meta">eBay listing: ${item.ebayListingId}</p>
          ${item.ebayOfferId ? `<p class="meta">eBay offer: ${escapeHtml(item.ebayOfferId)}</p>` : ""}
        </div>
        <span class="badge">${item.publishedMode === "simulated" ? "Simulated" : item.publishedMode === "sandbox" ? "Sandbox" : "Live"}</span>
      </article>
    `
    )
    .join("");
}

function renderSettings() {
  const status = $("#settingsStatus");
  const settings = state.settings || {};
  const oauth = settings.ebayOauth || {};
  const ebayToken = settings.ebayToken || {};
  const ebayProfile = settings.ebayProfile || {};
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
    <div class="status-line"><strong>eBay publish requirements</strong><span>${settings.ebayReady ? "Ready" : "Needs OAuth token and policy IDs"}</span></div>
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

$("#refreshButton").addEventListener("click", () => $("#ordersView").classList.contains("active") ? ordersView.load() : $("#repricingView").classList.contains("active") ? repricingView.load() : loadAll());

loadAll().catch((error) => {
  $("#productGrid").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
