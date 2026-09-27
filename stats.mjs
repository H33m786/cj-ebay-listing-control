import { fetchOrders } from "./orders.mjs";

const metrics = ["LISTING_VIEWS_TOTAL", "TOTAL_IMPRESSION_TOTAL", "TRANSACTION"];

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function compactDate(key) {
  return key.replaceAll("-", "");
}

function metricMap(report = {}) {
  const keys = (report.header?.metrics || []).map((item) => item.key);
  return new Map((report.records || []).map((record) => {
    const dimension = record.dimensionValues?.[0]?.value || "";
    const values = {};
    keys.forEach((key, index) => {
      const raw = record.metricValues?.[index]?.value;
      const number = Number(raw);
      values[key] = Number.isFinite(number) ? number : 0;
    });
    return [String(dimension), values];
  }));
}

function listingRows(published = [], environment = "production") {
  return published
    .filter((item) => item.publishedMode === environment && item.status !== "withdrawn" && item.ebayListingId)
    .map((item) => ({ id: String(item.id), listingId: String(item.ebayListingId), title: item.title || "Untitled listing", sku: item.sku || "" }));
}

function amountValue(amount) {
  const value = Number(amount?.value ?? amount);
  return Number.isFinite(value) ? value : 0;
}

function addItem(day, listing, patch) {
  let item = day.items.find((entry) => entry.listingId === listing.listingId);
  if (!item) {
    item = { listingId: listing.listingId, title: listing.title, sku: listing.sku, views: 0, impressions: 0, units: 0, revenue: 0 };
    day.items.push(item);
  }
  item.views += patch.views || 0;
  item.impressions += patch.impressions || 0;
  item.units += patch.units || 0;
  item.revenue = Number((item.revenue + (patch.revenue || 0)).toFixed(2));
}

function buildDays(days, now) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (days - 1 - index));
    const key = dayKey(date);
    return { date: key, label: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), views: 0, impressions: 0, units: 0, revenue: 0, items: [] };
  });
}

async function allOrders(days, request, published, environment, now) {
  const orders = [];
  let offset = 0;
  for (let page = 0; page < 20; page += 1) {
    const result = await fetchOrders(new URLSearchParams({ days: String(days), offset: String(offset) }), request, published, environment, now);
    orders.push(...result.orders);
    if (result.nextOffset == null) break;
    offset = result.nextOffset;
  }
  return orders;
}

async function trafficForDay(day, listings, request, marketplaceId) {
  if (!listings.length) return new Map();
  const listingIds = listings.map((item) => item.listingId).join("|");
  const params = new URLSearchParams({
    dimension: "LISTING",
    filter: `listing_ids:{${listingIds}},marketplace_ids:{${marketplaceId}},date_range:[${compactDate(day.date)}..${compactDate(day.date)}]`,
    metric: metrics.join(","),
    sort: "LISTING_VIEWS_TOTAL"
  });
  return metricMap(await request(`/sell/analytics/v1/traffic_report?${params}`));
}

export async function buildStats(params, request, published = [], environment = "production", marketplaceId = "EBAY_GB", now = new Date()) {
  const daysRequested = Number(params.get("days") || 14);
  if (![7, 14, 30, 90].includes(daysRequested)) throw new Error("Choose a stats range of 7, 14, 30, or 90 days.");
  const dailyTrafficDays = Math.min(daysRequested, 30);
  const days = buildDays(daysRequested, now);
  const dayByKey = new Map(days.map((day) => [day.date, day]));
  const listings = listingRows(published, environment);
  const listingById = new Map(listings.map((listing) => [listing.listingId, listing]));
  const totals = { views: 0, impressions: 0, units: 0, revenue: 0, orders: 0 };
  const warnings = [];

  try {
    const orders = await allOrders(daysRequested, request, published, environment, now);
    totals.orders = orders.length;
    for (const order of orders) {
      const day = dayByKey.get(String(order.createdAt || "").slice(0, 10));
      if (!day) continue;
      for (const line of order.items || []) {
        const listing = listingById.get(String(line.listingId || ""));
        if (!listing) continue;
        const units = Number(line.quantity || 0);
        const revenue = amountValue(line.total);
        day.units += units;
        day.revenue = Number((day.revenue + revenue).toFixed(2));
        totals.units += units;
        totals.revenue = Number((totals.revenue + revenue).toFixed(2));
        addItem(day, listing, { units, revenue });
      }
    }
  } catch (error) {
    warnings.push(`Sales unavailable: ${error.message}`);
  }

  if (!listings.length) {
    warnings.push("No active published listings found for this eBay environment.");
  } else {
    try {
      const trafficDays = days.slice(-dailyTrafficDays);
      for (const day of trafficDays) {
        const traffic = await trafficForDay(day, listings, request, marketplaceId);
        for (const listing of listings) {
          const values = traffic.get(listing.listingId);
          if (!values) continue;
          const views = values.LISTING_VIEWS_TOTAL || 0;
          const impressions = values.TOTAL_IMPRESSION_TOTAL || values.LISTING_IMPRESSION_TOTAL || 0;
          day.views += views;
          day.impressions += impressions;
          totals.views += views;
          totals.impressions += impressions;
          addItem(day, listing, { views, impressions });
        }
      }
      if (dailyTrafficDays < daysRequested) warnings.push("Listing view breakdown is limited to the latest 30 days to stay within eBay Analytics limits.");
    } catch (error) {
      warnings.push(`Views unavailable: ${error.message}. Reconnect eBay if Analytics access was not approved.`);
    }
  }

  return {
    days,
    totals,
    listings,
    environment,
    marketplaceId,
    trafficDays: dailyTrafficDays,
    fetchedAt: new Date().toISOString(),
    warnings
  };
}
