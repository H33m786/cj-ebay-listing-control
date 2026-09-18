import test from "node:test";
import assert from "node:assert/strict";
import { dailyDue, trackingSettings, priceProposal, findLiveOffer, updatePrice, checkFreePostage, repriceListing, runTracking, assertTrackingConnection } from "./repricing.mjs";
import { deletionPlan } from "./deletion.mjs";

const row = { id: "draft", source: "cj", sku: "SKU", cjProductId: "123", cjVariantId: "variant", cjShippingService: "CJPacket", feePercent: 12.8, feeFixed: 0.3, otherCostsGbp: 0, salePrice: 28, publishedMode: "production", ebayListingId: "listing" };
const rule = { enabled: true, targetMarginPercent: 25, usdToGbp: 0.75, cjShippingService: "CJPacket" };
const quote = { variantId: "variant", cost: 10, currency: "USD", quotes: [{ name: "CJPacket", price: 12, currency: "USD", transit: "8-12" }] };
const offer = { sku: "SKU", offerId: "offer", marketplaceId: "EBAY_GB", status: "PUBLISHED", listing: { listingId: "listing" }, pricingSummary: { price: { currency: "GBP", value: "28.00" } }, listingPolicies: { fulfillmentPolicyId: "policy" } };
const settings = { enabled: true, autoApply: true, maxChangePercent: 20, rules: { draft: rule }, environment: "production", connectionId: "connection" };
const freePolicy = { shippingOptions: [{ shippingServices: [{ freeShipping: true }] }] };

test("daily scheduling is once per UTC date, after scheduled time, and opt-in", () => {
  assert.equal(dailyDue(settings, new Date("2026-09-18T07:16:00Z")), false);
  assert.equal(dailyDue(settings, new Date("2026-09-18T07:17:00Z")), true);
  assert.equal(dailyDue({ ...settings, lastScheduledDate: "2026-09-18" }, new Date("2026-09-18T20:00:00Z")), false);
  assert.equal(dailyDue({ enabled: false }, new Date("2026-09-18T20:00:00Z")), false);
});
test("automatic updates fail closed across environments, reconnects and production gates", () => {
  const connection = { environment: "production", connectionId: "connection", liveEnabled: true, productionConfirmed: true };
  assert.doesNotThrow(() => assertTrackingConnection(settings, connection, false));
  for (const changed of [{ environment: "sandbox" }, { connectionId: "other" }, { liveEnabled: false }, { productionConfirmed: false }]) assert.throws(() => assertTrackingConnection(settings, { ...connection, ...changed }, false));
  assert.throws(() => assertTrackingConnection({ ...settings, autoApply: false }, connection, false));
  assert.doesNotThrow(() => assertTrackingConnection(settings, { ...connection, liveEnabled: false }, true));
});
test("tracking settings validate environment, rates, margins, bounds and connection", () => {
  const connection = { environment: "production", connectionId: "connection" };
  assert.equal(trackingSettings(settings, [row], connection).rules.draft.usdToGbp, 0.75);
  assert.throws(() => trackingSettings(settings, [row], { environment: "sandbox" }));
  assert.throws(() => trackingSettings(settings, [row], { environment: "production" }));
  for (const value of [-1, 0, 30, NaN]) assert.throws(() => trackingSettings({ ...settings, maxChangePercent: value }, [row], connection));
  assert.throws(() => trackingSettings({ ...settings, rules: { draft: { ...rule, usdToGbp: 0 } } }, [row], connection));
});
test("price calculation includes supplier shipping, FX and fees to preserve target margin", () => {
  const plan = priceProposal(row, rule, quote, offer, 20);
  assert.equal(plan.cost, 10);
  assert.equal(plan.shippingCost, 12);
  assert.ok(plan.marginPercent >= 25);
  assert.equal(plan.held, false);
  assert.equal(plan.price, 27.02);
});
test("upward and downward fluctuations are held above the change bound", () => {
  for (const value of [10, 60]) {
    assert.equal(priceProposal(row, rule, { ...quote, cost: value }, { ...offer, pricingSummary: { price: { currency: "GBP", value: "10" } } }, 20).held, true);
  }
  assert.equal(priceProposal(row, rule, quote, { ...offer, pricingSummary: { price: { currency: "GBP", value: "100" } } }, 20).held, true);
});
test("missing or wrong supplier data never becomes a free item or alternate service", () => {
  for (const bad of [{ ...quote, cost: null }, { ...quote, cost: "" }, { ...quote, cost: -1 }, { ...quote, variantId: "other" }, { ...quote, currency: "GBP" }, { ...quote, quotes: [] }, { ...quote, quotes: [{ ...quote.quotes[0], name: "Cheap alternate" }] }, { ...quote, quotes: [quote.quotes[0], quote.quotes[0]] }, { ...quote, quotes: [{ ...quote.quotes[0], price: null }] }]) assert.throws(() => priceProposal(row, rule, bad, offer, 20));
  assert.throws(() => priceProposal(row, rule, quote, { ...offer, pricingSummary: { price: { currency: "USD", value: "28" } } }, 20));
});
test("offer matching cannot target ended, other marketplace, other listing or duplicate offers", async () => {
  for (const offers of [[], [offer, offer], [{ ...offer, status: "UNPUBLISHED" }], [{ ...offer, marketplaceId: "EBAY_US" }], [{ ...offer, listing: { listingId: "different" } }]]) await assert.rejects(findLiveOffer(async () => ({ offers }), row, row));
});
test("only the price field is sent; quantity is never reset", async () => {
  await updatePrice(async (path, options) => {
    assert.equal(path, "/sell/inventory/v1/inventory_item/bulk_update_price_quantity");
    assert.deepEqual(options.body, { requests: [{ sku: "SKU", offers: [{ offerId: "offer", price: { currency: "GBP", value: "27.01" } }] }] });
    return { responses: [{ sku: "SKU", offerId: "offer", statusCode: 200 }] };
  }, row, offer, 27.01);
  for (const response of [{}, { responses: [{ sku: "SKU", offerId: "offer", statusCode: 400 }] }]) await assert.rejects(updatePrice(async () => response, row, offer, 27.01));
});
test("paid or unknown postage blocks repricing", async () => {
  await checkFreePostage(async () => freePolicy, offer);
  await assert.rejects(checkFreePostage(async () => ({}), offer));
  await assert.rejects(checkFreePostage(async () => ({ shippingOptions: [{ shippingServices: [{ shippingCost: { currency: "GBP", value: "5" } }] }] }), offer));
  await assert.rejects(checkFreePostage(async () => ({ shippingOptions: [{ shippingServices: [{ shippingCost: { currency: "GBP", value: null } }] }] }), offer));
});

function harness({ autoApply = true, fail = false, unchanged = false } = {}) {
  const listing = structuredClone(row);
  const events = [];
  let price = unchanged ? "27.02" : "28.00";
  let posts = 0;
  const request = async (path, options) => {
    if (options?.method === "POST") {
      posts++;
      if (fail) throw new Error("Connection interrupted");
      price = options.body.requests[0].offers[0].price.value;
      return { responses: [{ sku: "SKU", offerId: "offer", statusCode: 200 }] };
    }
    if (path.includes("fulfillment_policy")) return freePolicy;
    return { offers: [{ ...offer, pricingSummary: { price: { currency: "GBP", value: price } } }] };
  };
  return { listing, events, request, posts: () => posts, run: () => repriceListing(listing, rule, { ...settings, autoApply }, { quote: async () => quote, request, record: async (event) => events.push(structuredClone(event)) }) };
}
test("preview calculates a change without writing eBay or changing stored listing prices", async () => {
  const check = harness({ autoApply: false }); await check.run();
  assert.equal(check.posts(), 0); assert.equal(check.listing.salePrice, 28); assert.equal(check.events[0].status, "preview");
});
test("successful change records intent, verifies price and updates local costs", async () => {
  const check = harness(); await check.run();
  assert.equal(check.posts(), 1); assert.equal(check.listing.salePrice, 27.02);
  assert.deepEqual(check.events.map((event) => event.status), ["updating", "updated"]);
  await check.run(); assert.equal(check.posts(), 1); assert.equal(check.events.at(-1).status, "unchanged");
});
test("uncertain network write retains old local price and explicit review state", async () => {
  const check = harness({ fail: true }); await check.run();
  assert.equal(check.listing.salePrice, 28); assert.equal(check.events.at(-1).status, "uncertain");
});
test("variation prices are calculated independently and partial failures remain visible", async () => {
  const listing = { ...row, multiVariation: true, listingVariants: [{ enabled: true, cjVariantId: "red", salePrice: 28 }, { enabled: true, cjVariantId: "blue", salePrice: 30 }] };
  const events = [];
  let posts = 0;
  await repriceListing(listing, rule, settings, {
    quote: async (variant) => { if (variant.cjVariantId === "blue") throw new Error("No quote"); return { ...quote, variantId: "red" }; },
    request: async (path, options) => {
      if (options?.method === "POST") { posts++; return { responses: [{ sku: "SKU-red", offerId: "offer", statusCode: 200 }] }; }
      if (path.includes("fulfillment_policy")) return freePolicy;
      return { offers: [{ ...offer, sku: "SKU-red", pricingSummary: { price: { currency: "GBP", value: posts ? "27.02" : "28" } } }] };
    }, record: async (event) => events.push({ ...event })
  });
  assert.equal(listing.listingVariants[0].salePrice, 27.02);
  assert.equal(listing.listingVariants[1].salePrice, 30);
  assert.equal(events.at(-1).status, "failed");
});
test("scheduled job persists failures, respects preview and isolates failed items", async () => {
  const store = { published: [structuredClone(row)], repricing: { ...settings, autoApply: false } };
  let saves = 0;
  const check = harness();
  await runTracking({ readStore: async () => store, saveStore: async () => { saves++; }, connect: async (_settings, preview) => { assert.equal(preview, true); return { request: check.request }; }, quote: async () => { throw new Error("CJ unavailable"); } }, { preview: false });
  assert.equal(store.repricing.run.status, "needs-review"); assert.equal(check.posts(), 0); assert.ok(saves >= 3);
  assert.equal(store.published[0].priceHistory[0].status, "failed");
});
test("disabled or already-attempted daily jobs do not contact suppliers or eBay", async () => {
  for (const config of [{ ...settings, enabled: false }, { ...settings, lastScheduledDate: new Date().toISOString().slice(0, 10) }]) {
    await runTracking({ readStore: async () => ({ repricing: config }), saveStore: async () => assert.fail("unexpected write"), connect: async () => assert.fail("unexpected API call") }, { scheduled: true });
  }
});
test("deletion removes seller tracking settings and price history", () => {
  const result = deletionPlan({ repricing: settings, published: [row], drafts: [] }, { userId: "user" }, { userId: "user" }, "user");
  assert.deepEqual(result.store.repricing, {}); assert.deepEqual(result.store.published, []);
});
