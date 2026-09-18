import test from "node:test";
import assert from "node:assert/strict";
import { fetchOrders, normalizeOrder, orderQuery } from "./orders.mjs";

const order = {
  orderId: "test-order", orderPaymentStatus: "PAID", orderFulfillmentStatus: "NOT_STARTED", cancelStatus: { cancelState: "NONE_REQUESTED" },
  buyer: { buyerRegistrationAddress: { fullName: "Wrong address" } },
  fulfillmentStartInstructions: [{ fulfillmentInstructionsType: "SHIP_TO", shippingStep: { shipTo: { fullName: "Test Recipient", contactAddress: { addressLine1: "1 Test Street", city: "London", postalCode: "TEST", countryCode: "GB" } } } }],
  lineItems: [{ lineItemId: "line", legacyItemId: "listing", sku: "SKU", quantity: 2, variationAspects: [{ name: "Size", value: "M" }] }]
};
const listing = { publishedMode: "production", ebayListingId: "listing", sku: "SKU", cjProductId: "product", cjVariantId: "variant" };

test("orders expose delivery address, quantity and purchased aspects, not registration address", () => {
  const result = normalizeOrder(order, [listing]);
  assert.equal(result.deliveries[0].name, "Test Recipient");
  assert.equal(result.items[0].quantity, 2);
  assert.deepEqual(result.items[0].aspects, [{ name: "Size", value: "M" }]);
  assert.equal(result.items[0].cj.variantId, "variant");
  assert.deepEqual(result.warnings, []);
  assert.equal(result.buyer, undefined);
});
test("CJ matching rejects ambiguous, unknown, wrong listing and cross-environment matches", () => {
  for (const published of [[listing, listing], [{ ...listing, publishedMode: "sandbox" }], [{ ...listing, ebayListingId: "other" }], [{ ...listing, sku: "different" }], []]) {
    assert.equal(normalizeOrder(order, published).items[0].cj, null);
  }
});
test("multi-variation match uses exact sold SKU", () => {
  const grouped = { ...listing, multiVariation: true, listingVariants: [{ enabled: true, cjVariantId: "blue", label: "Blue M" }] };
  const sold = { ...order, lineItems: [{ ...order.lineItems[0], sku: "SKU-blue" }] };
  assert.equal(normalizeOrder(sold, [grouped]).items[0].cj.variantId, "blue");
});
test("unpaid, cancelled, fulfilled and missing delivery are warned", () => {
  const result = normalizeOrder({ ...order, orderPaymentStatus: "PENDING", orderFulfillmentStatus: "FULFILLED", cancelStatus: { cancelState: "CANCEL_REQUESTED" }, fulfillmentStartInstructions: [] });
  assert.equal(result.warnings.length, 4);
  assert.equal(normalizeOrder({}).items.length, 0);
});
test("date windows and pagination are bounded and encoded", () => {
  const query = orderQuery(new URLSearchParams("days=7&offset=50"), new Date("2026-09-18T00:00:00Z"));
  assert.equal(query.get("filter"), "creationdate:[2026-09-11T00:00:00.000Z..]");
  assert.equal(query.get("offset"), "50");
  for (const value of ["days=500", "offset=-1", "offset=0.5", "offset=10001", "offset=NaN"]) assert.throws(() => orderQuery(new URLSearchParams(value)));
});
test("fetch passes fixed eBay path, follows pagination without following upstream URLs", async () => {
  const result = await fetchOrders(new URLSearchParams(), async (path) => {
    assert.ok(path.startsWith("/sell/fulfillment/v1/order?"));
    return { orders: [order], total: 51, next: "https://untrusted.example" };
  }, [listing], "production");
  assert.equal(result.nextOffset, 50);
  assert.equal(result.orders.length, 1);
  await assert.rejects(fetchOrders(new URLSearchParams(), async () => { throw new Error("denied"); }, [], "production"), /denied/);
});
