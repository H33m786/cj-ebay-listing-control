import { parse } from "csv-parse/sync";
import { randomUUID } from "node:crypto";

export function previewResearchCsv(csv) {
  if (typeof csv !== "string" || Buffer.byteLength(csv) > 1_000_000) throw new Error("Choose a CSV file smaller than 1 MB.");
  const records = parse(csv, { bom: true, skip_empty_lines: true, trim: true, max_record_size: 20000 });
  if (records.length < 2) throw new Error("The CSV needs column headings and at least one product.");
  const [headers, ...rows] = records;
  if (headers.length > 80 || rows.length > 200) throw new Error("Import up to 200 products and 80 columns at a time.");
  return { headers, rows };
}

function optionalNumber(value, name, integer = false) {
  if (value == null || String(value).trim() === "") return null;
  const text = String(value).trim().replace(/^\u00a3\s*/, "");
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text)) throw new Error(`${name} must be a non-negative number${integer ? " without decimals" : " in GBP"}.`);
  const number = Number(text.replaceAll(",", ""));
  if (!Number.isFinite(number) || number > 1e9 || (integer && !Number.isInteger(number))) throw new Error(`${name} is invalid.`);
  return number;
}

export function normalizeResearchIdea(input, now = new Date().toISOString()) {
  const title = String(input.title || "").trim();
  if (!title || title.length > 300) throw new Error("Each product needs a title of 1 to 300 characters.");
  let url = "";
  if (input.url) {
    const parsed = new URL(String(input.url).trim());
    if (parsed.protocol !== "https:" || !/^(?:www\.)?ebay\.(?:co\.uk|com)$/.test(parsed.hostname) || parsed.username || parsed.password) throw new Error("Use an https eBay UK or eBay.com listing link.");
    url = parsed.href;
  }
  const sales = optionalNumber(input.sales, "Sales", true);
  const days = optionalNumber(input.days, "Sales period", true);
  if (sales !== null && (!days || days > 365)) throw new Error("Enter a sales period between 1 and 365 days when supplying sales figures.");
  const sellThrough = optionalNumber(input.sellThrough, "Sell-through percentage");
  if (sellThrough !== null && sellThrough > 100) throw new Error("Sell-through must be between 0 and 100%.");
  const settings = {};
  for (const [key, fallback] of Object.entries({ targetProfitGbp: 1, feePercent: 12.8, feeFixed: 0.3, adPercent: 0, otherCostsGbp: 0, maxDeliveryDays: 15, handlingDays: 5 })) {
    settings[key] = optionalNumber(input[key], key, ["maxDeliveryDays", "handlingDays"].includes(key)) ?? fallback;
  }
  if (settings.targetProfitGbp <= 0 || settings.feePercent + settings.adPercent >= 100 || settings.maxDeliveryDays < 1 || settings.maxDeliveryDays > 90 || settings.handlingDays > 30) throw new Error("Check the profit, fees and delivery limits.");
  return {
    id: randomUUID(), title, url,
    price: optionalNumber(input.price, "Reference delivered price"),
    sales, days: sales === null ? null : days,
    source: ["zik", "ebay"].includes(input.source) ? input.source : "manual",
    sellThrough,
    sellers: optionalNumber(input.sellers, "Number of sellers", true),
    ...settings,
    importedAt: now,
    evidence: "user-supplied"
  };
}

export function mergeResearchIdeas(existing, incoming) {
  const key = (item) => item.url || item.title.toLowerCase();
  const seen = new Set(existing.map(key));
  const added = incoming.filter((item) => {
    if (seen.has(key(item))) return false;
    seen.add(key(item));
    return true;
  });
  if (existing.length + added.length > 500) throw new Error("The shortlist holds 500 products. Remove older entries before importing more.");
  return { ideas: [...added, ...existing], added: added.length, skipped: incoming.length - added.length };
}

export function researchMedian(items) {
  const prices = items.filter((item) => item.currency === "GBP" && item.shippingCurrency === "GBP" && Number.isFinite(item.shippingCost) && item.shippingCost >= 0 && item.price > 0)
    .map((item) => item.price + item.shippingCost).sort((a, b) => a - b);
  if (!prices.length) return null;
  const middle = Math.floor(prices.length / 2);
  return prices.length % 2 ? prices[middle] : (prices[middle - 1] + prices[middle]) / 2;
}
