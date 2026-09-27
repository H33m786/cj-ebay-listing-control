import test from "node:test";
import assert from "node:assert/strict";
import { buildStats } from "./stats.mjs";

const published = [
  { id: "local-1", publishedMode: "production", ebayListingId: "1001", title: "USB Charger", sku: "USB1", publishedAt: "2026-09-20T09:00:00.000Z" },
  { id: "local-2", publishedMode: "production", ebayListingId: "1002", title: "Phone Case", sku: "CASE1", publishedAt: "2026-09-25T09:00:00.000Z" }
];

const order = {
  orderId: "order-1",
  creationDate: "2026-09-26T10:00:00.000Z",
  orderPaymentStatus: "PAID",
  orderFulfillmentStatus: "NOT_STARTED",
  cancelStatus: { cancelState: "NONE_REQUESTED" },
  pricingSummary: { total: { value: "24.99", currency: "GBP" } },
  fulfillmentStartInstructions: [{ fulfillmentInstructionsType: "SHIP_TO", shippingStep: { shipTo: { fullName: "Buyer", contactAddress: { addressLine1: "1 Street", city: "London", postalCode: "A1", countryCode: "GB" } } } }],
  lineItems: [{ lineItemId: "line-1", legacyItemId: "1001", title: "USB Charger", sku: "USB1", quantity: 2, total: { value: "24.99", currency: "GBP" }, variationAspects: [] }]
};

function traffic(records) {
  return {
    header: { metrics: [{ key: "LISTING_VIEWS_TOTAL" }, { key: "TOTAL_IMPRESSION_TOTAL" }, { key: "TRANSACTION" }] },
    records: records.map(([listingId, views, impressions, transactions]) => ({
      dimensionValues: [{ value: listingId }],
      metricValues: [{ value: views }, { value: impressions }, { value: transactions }]
    }))
  };
}

test("buildStats combines order sales and listing traffic by day", async () => {
  const result = await buildStats(new URLSearchParams({ days: "7" }), async (path) => {
    if (path.startsWith("/sell/fulfillment")) return { orders: [order], total: 1 };
    if (path.includes("20260926")) return traffic([["1001", 5, 50, 1], ["1002", 2, 25, 0]]);
    return traffic([]);
  }, published, "production", "EBAY_GB", new Date("2026-09-27T12:00:00.000Z"));

  const day = result.days.find((item) => item.date === "2026-09-26");
  assert.equal(day.views, 7);
  assert.equal(day.impressions, 75);
  assert.equal(day.units, 2);
  assert.equal(day.revenue, 24.99);
  assert.equal(day.items.find((item) => item.listingId === "1001").views, 5);
  assert.equal(day.items.find((item) => item.listingId === "1001").units, 2);
  assert.equal(result.totals.views, 7);
  assert.equal(result.totals.units, 2);
  assert.deepEqual(result.warnings, []);
});

test("buildStats keeps sales when analytics traffic is unavailable", async () => {
  const result = await buildStats(new URLSearchParams({ days: "7" }), async (path) => {
    if (path.startsWith("/sell/fulfillment")) return { orders: [order], total: 1 };
    throw new Error("analytics denied");
  }, published, "production", "EBAY_GB", new Date("2026-09-27T12:00:00.000Z"));

  assert.equal(result.totals.units, 2);
  assert.equal(result.totals.views, 0);
  assert.match(result.warnings.join(" "), /Views unavailable/);
});

test("buildStats only counts paid non-cancelled orders as sales", async () => {
  const unpaid = { ...order, orderId: "order-unpaid", orderPaymentStatus: "PENDING" };
  const cancelled = { ...order, orderId: "order-cancelled", cancelStatus: { cancelState: "CANCEL_REQUESTED" } };
  const result = await buildStats(new URLSearchParams({ days: "7" }), async (path) => {
    if (path.startsWith("/sell/fulfillment")) return { orders: [unpaid, cancelled], total: 2 };
    return traffic([]);
  }, published, "production", "EBAY_GB", new Date("2026-09-27T12:00:00.000Z"));

  const day = result.days.find((item) => item.date === "2026-09-26");
  assert.equal(day.units, 0);
  assert.equal(day.revenue, 0);
  assert.equal(result.totals.orders, 0);
  assert.equal(result.totals.units, 0);
});

test("buildStats can run since the first published listing", async () => {
  const result = await buildStats(new URLSearchParams({ days: "all" }), async (path) => {
    if (path.startsWith("/sell/fulfillment")) return { orders: [], total: 0 };
    return traffic([]);
  }, published, "production", "EBAY_GB", new Date("2026-09-27T12:00:00.000Z"));

  assert.equal(result.days.length, 8);
  assert.equal(result.days[0].date, "2026-09-20");
  assert.equal(result.sinceFirstPublished, true);
  assert.equal(result.range, "all");
});

test("buildStats caps since-first-published range at 365 days", async () => {
  const oldPublished = [{ ...published[0], publishedAt: "2024-01-01T09:00:00.000Z" }];
  const result = await buildStats(new URLSearchParams({ days: "all" }), async (path) => {
    if (path.startsWith("/sell/fulfillment")) return { orders: [], total: 0 };
    return traffic([]);
  }, oldPublished, "production", "EBAY_GB", new Date("2026-09-27T12:00:00.000Z"));

  assert.equal(result.days.length, 365);
  assert.match(result.warnings.join(" "), /capped/);
});
