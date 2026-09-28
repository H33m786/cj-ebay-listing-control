import test from "node:test";
import assert from "node:assert/strict";
import { discoverySettings, ebayFirstResearch } from "./research-ebay-first.mjs";

const peers = Array.from({ length: 3 }, (_, i) => ({ title: "USB desk lamp", itemId: String(i), price: 20, currency: "GBP", shippingCost: 2, shippingCurrency: "GBP" }));
function options(overrides = {}) {
  return { terms: ["electronics"], settings: discoverySettings(new URLSearchParams()),
    searchEbay: async () => peers,
    searchCj: async () => [{ pid: "CJ1", title: "USB desk lamp" }],
    quote: async () => ({ minimumSalePrice: 15, landedEstimate: 10 }),
    match: () => 1, ...overrides };
}
test("eBay source titles drive CJ search, not niche seeds", async () => {
  const calls = [];
  const result = await ebayFirstResearch(options({ searchCj: async (term) => { calls.push(term); return [{ pid: "CJ1", title: "USB desk lamp" }]; } }));
  assert.deepEqual(calls, ["usb desk lamp"]);
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0].ebayMedianPrice, 22);
  assert.equal(result.recommendations[0].sourceEbay.title, "USB desk lamp");
  assert.match(result.recommendations[0].caution, /not verified sales/);
});
test("missing delivery prices, weak matches and too few comparisons cannot qualify", async () => {
  for (const changes of [
    { searchEbay: async () => peers.slice(0, 2) },
    { searchEbay: async () => peers.map((item) => ({ ...item, shippingCost: null })) },
    { match: () => 0.2 }
  ]) {
    const result = await ebayFirstResearch(options({ ...changes, quote: async () => { throw new Error("Should not quote"); } }));
    assert.equal(result.recommendations.length, 0);
    assert.equal(result.quoted, 0);
  }
});
test("existing products, missing costs and overpriced candidates are excluded", async () => {
  for (const changes of [
    { existing: [{ cjProductId: "CJ1" }] },
    { quote: async () => ({ minimumSalePrice: null }) },
    { quote: async () => ({ minimumSalePrice: 23 }) }
  ]) assert.equal((await ebayFirstResearch(options(changes))).recommendations.length, 0);
});
test("errors are visible and do not generate sample opportunities", async () => {
  const result = await ebayFirstResearch(options({ searchEbay: async () => { throw new Error("Rate limited"); } }));
  assert.equal(result.recommendations.length, 0);
  assert.match(result.warnings[0], /Rate limited/);
});
test("profit target is validated and passed to quotation", async () => {
  for (const profit of ["0", "-2", "NaN", "1001"]) assert.throws(() => discoverySettings(new URLSearchParams({ profit })));
  const settings = discoverySettings(new URLSearchParams({ profit: "5" }));
  const result = await ebayFirstResearch(options({ settings, quote: async (product, price, passed) => {
    assert.equal(passed.targetProfitGbp, 5);
    assert.equal(passed.maxDeliveryDays, 15);
    return { minimumSalePrice: 20 };
  } }));
  assert.equal(result.minimumProfitGbp, 5);
});
