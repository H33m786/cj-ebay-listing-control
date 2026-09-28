import { fetchOrders } from "./orders.mjs";

const metrics = ["LISTING_VIEWS_TOTAL", "TOTAL_IMPRESSION_TOTAL", "TRANSACTION"];
const trafficChunkSize = 15;
const pastTrafficTtlMs = 24 * 60 * 60 * 1000;
const todayTrafficTtlMs = 2 * 60 * 60 * 1000;
const trafficLimitCooldownMs = 6 * 60 * 60 * 1000;

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function compactDate(key) {
  return key.replaceAll("-", "");
}

function listingDimensionKeys(value = "") {
  const raw = String(value || "").trim();
  const keys = new Set();
  if (raw) keys.add(raw);
  for (const match of raw.matchAll(/\d{6,}/g)) keys.add(match[0]);
  return keys;
}

function mergeMetricValues(target, patch = {}) {
  for (const [key, value] of Object.entries(patch)) target[key] = (target[key] || 0) + (Number(value) || 0);
  return target;
}

function mergeIntoMetricMap(map, key, values) {
  const target = map.get(key) || {};
  map.set(key, mergeMetricValues(target, values));
}

function metricMap(report = {}) {
  const keys = (report.header?.metrics || []).map((item) => item.key);
  const output = new Map();
  for (const record of report.records || []) {
    const dimension = record.dimensionValues?.[0]?.value || "";
    const values = {};
    keys.forEach((key, index) => {
      const raw = record.metricValues?.[index]?.value;
      const number = Number(raw);
      values[key] = Number.isFinite(number) ? number : 0;
    });
    for (const key of listingDimensionKeys(dimension)) mergeIntoMetricMap(output, key, values);
  }
  return output;
}

function listingRows(published = [], environment = "production") {
  return published
    .filter((item) => item.publishedMode === environment && item.status !== "withdrawn" && item.ebayListingId)
    .map((item) => ({ id: String(item.id), listingId: String(item.ebayListingId), title: item.title || "Untitled listing", sku: item.sku || "", publishedAt: item.publishedAt || item.createdAt || null }));
}

function amountValue(amount) {
  const value = Number(amount?.value ?? amount);
  return Number.isFinite(value) ? value : 0;
}

function isConfirmedSale(order) {
  return order.payment === "PAID" && (!order.cancellation || order.cancellation === "NONE_REQUESTED");
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

function isTrafficRateLimit(error) {
  return /\b2001\b|request limit has been reached|rate limit/i.test(String(error?.message || ""));
}

function todayKey(now) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  return dayKey(today);
}

function trafficCacheEntry(cache, environment, marketplaceId, day) {
  cache.days ||= {};
  const key = `${environment}|${marketplaceId}|${day.date}`;
  cache.days[key] ||= { date: day.date, environment, marketplaceId, listings: {}, fetchedAt: null, trafficUpdatedAt: null };
  return cache.days[key];
}

function cachedTrafficIsFresh(entry, day, now) {
  if (!entry?.fetchedAt) return false;
  const fetchedAt = Date.parse(entry.fetchedAt);
  if (!Number.isFinite(fetchedAt)) return false;
  const ttl = day.date === todayKey(now) ? todayTrafficTtlMs : pastTrafficTtlMs;
  return now.getTime() - fetchedAt < ttl;
}

function cachedTrafficMap(entry, listings) {
  const output = new Map();
  for (const listing of listings) {
    const values = entry?.listings?.[listing.listingId];
    if (!values) continue;
    output.set(listing.listingId, {
      LISTING_VIEWS_TOTAL: Number(values.views || 0),
      TOTAL_IMPRESSION_TOTAL: Number(values.impressions || 0)
    });
  }
  return output;
}

function storeTraffic(day, listings, traffic, entry, now) {
  entry.listings ||= {};
  for (const listing of listings) {
    const values = traffic.get(listing.listingId);
    entry.listings[listing.listingId] = {
      views: values?.LISTING_VIEWS_TOTAL || 0,
      impressions: values?.TOTAL_IMPRESSION_TOTAL || values?.LISTING_IMPRESSION_TOTAL || 0
    };
  }
  entry.fetchedAt = new Date(now).toISOString();
  entry.trafficUpdatedAt = day.trafficUpdatedAt || entry.trafficUpdatedAt || null;
}

function applyTrafficToDay(day, listings, traffic, totals) {
  day.views = 0;
  day.impressions = 0;
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

function buildDays(days, now) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - (days - 1 - index));
    const key = dayKey(date);
    return { date: key, label: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), views: 0, impressions: 0, units: 0, revenue: 0, items: [] };
  });
}

function firstPublishedDate(listings = [], now = new Date()) {
  const timestamps = listings.map((item) => Date.parse(item.publishedAt)).filter(Number.isFinite);
  if (!timestamps.length) return null;
  const date = new Date(Math.min(...timestamps));
  date.setUTCHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  return date > today ? today : date;
}

function daysSince(start, now = new Date()) {
  if (!start) return 14;
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((today - start) / 86400000) + 1);
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
  const output = new Map();
  const failures = [];
  for (let index = 0; index < listings.length; index += trafficChunkSize) {
    const chunk = listings.slice(index, index + trafficChunkSize);
    const listingIds = chunk.map((item) => item.listingId).join("|");
    const params = new URLSearchParams({
      dimension: "LISTING",
      filter: `listing_ids:{${listingIds}},marketplace_ids:{${marketplaceId}},date_range:[${compactDate(day.date)}..${compactDate(day.date)}]`,
      metric: metrics.join(","),
      sort: "LISTING_VIEWS_TOTAL"
    });
    try {
      const report = await request(`/sell/analytics/v1/traffic_report?${params}`);
      day.trafficUpdatedAt = report.lastUpdatedDate || day.trafficUpdatedAt || null;
      for (const [listingId, values] of metricMap(report)) mergeIntoMetricMap(output, listingId, values);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length && !output.size) throw failures[0];
  if (failures.length) day.trafficPartial = true;
  return output;
}

export async function buildStats(params, request, published = [], environment = "production", marketplaceId = "EBAY_GB", now = new Date(), trafficCache = {}) {
  const listings = listingRows(published, environment);
  const requestedRange = String(params.get("days") || "14").toLowerCase();
  const since = requestedRange === "all";
  const firstDate = firstPublishedDate(listings, now);
  const rawDays = since ? daysSince(firstDate, now) : Number(requestedRange);
  if (!Number.isInteger(rawDays) || rawDays < 1 || (!since && rawDays > 365)) throw new Error("Choose a stats range of 7, 14, 30, 90, or since first published.");
  const daysRequested = Math.min(rawDays, 365);
  const dailyTrafficDays = Math.min(daysRequested, 30);
  const days = buildDays(daysRequested, now);
  const dayByKey = new Map(days.map((day) => [day.date, day]));
  const listingById = new Map(listings.map((listing) => [listing.listingId, listing]));
  const totals = { views: 0, impressions: 0, units: 0, revenue: 0, orders: 0 };
  const warnings = [];
  const warningKeys = new Set();
  const warnOnce = (key, message) => {
    if (warningKeys.has(key)) return;
    warningKeys.add(key);
    warnings.push(message);
  };
  if (since && rawDays > 365) warnings.push("Stats are capped at the latest 365 days to keep eBay requests bounded.");

  try {
    const orders = await allOrders(daysRequested, request, published, environment, now);
    const confirmedOrders = orders.filter(isConfirmedSale);
    totals.orders = confirmedOrders.length;
    for (const order of confirmedOrders) {
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
    const trafficDays = days.slice(-dailyTrafficDays);
    for (const day of days.slice(0, -dailyTrafficDays)) {
      day.views = null;
      day.impressions = null;
    }
    for (const day of trafficDays) {
      const entry = trafficCacheEntry(trafficCache, environment, marketplaceId, day);
      const cachedTraffic = cachedTrafficMap(entry, listings);
      const hasAllCachedListings = listings.every((listing) => cachedTraffic.has(listing.listingId));
      if (hasAllCachedListings && cachedTrafficIsFresh(entry, day, now)) {
        day.trafficUpdatedAt = entry.trafficUpdatedAt || null;
        day.trafficCached = true;
        applyTrafficToDay(day, listings, cachedTraffic, totals);
        continue;
      }
      const cooldownUntil = Date.parse(trafficCache.cooldownUntil || "");
      if (Number.isFinite(cooldownUntil) && cooldownUntil > now.getTime()) {
        if (hasAllCachedListings) {
          day.trafficUpdatedAt = entry.trafficUpdatedAt || null;
          day.trafficCached = true;
          day.trafficStale = true;
          applyTrafficToDay(day, listings, cachedTraffic, totals);
        } else {
          day.views = null;
          day.impressions = null;
        }
        warnOnce("traffic-limit", `Views are temporarily paused because eBay reached the Analytics request limit. Cached view data is shown where available until ${new Date(cooldownUntil).toLocaleString("en-GB")}.`);
        continue;
      }
      try {
        const traffic = await trafficForDay(day, listings, request, marketplaceId);
        storeTraffic(day, listings, traffic, entry, now);
        if (day.trafficPartial) warnings.push(`Views partially unavailable for ${day.date}: eBay returned data for some listings only.`);
        applyTrafficToDay(day, listings, traffic, totals);
      } catch (error) {
        if (isTrafficRateLimit(error)) {
          trafficCache.cooldownUntil = new Date(now.getTime() + trafficLimitCooldownMs).toISOString();
          if (hasAllCachedListings) {
            day.trafficUpdatedAt = entry.trafficUpdatedAt || null;
            day.trafficCached = true;
            day.trafficStale = true;
            applyTrafficToDay(day, listings, cachedTraffic, totals);
          } else {
            day.views = null;
            day.impressions = null;
          }
          warnOnce("traffic-limit", `eBay reached the Analytics request limit. View refreshes are paused for a few hours and cached view data is shown where available.`);
          continue;
        }
        day.views = null;
        day.impressions = null;
        warnings.push(`Views unavailable for ${day.date}: ${error.message}`);
      }
    }
    if (dailyTrafficDays < daysRequested) warnings.push("Listing view breakdown is limited to the latest 30 days to stay within eBay Analytics limits.");
  }

  return {
    days,
    totals,
    listings,
    environment,
    marketplaceId,
    trafficDays: dailyTrafficDays,
    trafficComplete: days.every((day) => day.views != null && !day.trafficPartial),
    range: since ? "all" : String(daysRequested),
    sinceFirstPublished: since,
    firstPublishedAt: firstDate ? firstDate.toISOString() : null,
    fetchedAt: new Date().toISOString(),
    warnings
  };
}
