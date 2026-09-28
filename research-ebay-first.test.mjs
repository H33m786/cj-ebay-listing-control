import test from "node:test";
import assert from "node:assert/strict";
import { discoveryMatch, discoveryTerm, discoverySettings, ebayFirstResearch } from "./research-ebay-first.mjs";

test("charger synonyms and specifications beyond truncated title words can match", () => {
  const match = discoveryMatch("20W USB-C Fast Charger For iPhone Samsung", "European Home Portable Mobile Phone Travel 20 Watts Type C Charging Head", () => 0);
  assert.ok(match.score >= 0.6);
});

test("charger matching rejects incompatible types, cables and stated wattages", () => {
  for (const candidate of ["65W USB-C wall charger", "20W USB-C car charger", "20W wireless charger", "USB charger cable", "USB-C charging cable", "20W power bank charger"]) {
    const match = discoveryMatch("20W USB-C wall charger", candidate, () => 1);
    assert.equal(match.score, 0, candidate);
    assert.ok(match.reason);
  }
});

test("real title matching lets equivalent CJ chargers reach shipping checks", async () => {
  const result = await ebayFirstResearch(options({
    searchEbay: async () => peers.map((item) => ({ ...item, title: "20W USB-C Fast Charger For iPhone Samsung" })),
    searchCj: async () => [{ pid: "charger", title: "Travel Type C 20 Watts Charging Head" }],
    match: () => 0
  }));
  assert.equal(result.quoted, 1);
  assert.equal(result.recommendations.length, 1);
});

test("charger discovery removes advertising without discarding power or product type", () => {
  assert.equal(discoveryTerm("Genuine Original Premium 20W USB Charger Free Delivery"), "20w usb charger");
  assert.match(discoveryTerm("Wireless 15W car charger"), /wireless 15w car charger/);
});
test("broad charger results trigger focused eBay comparisons before CJ search", async () => {
  const calls = [];
  const result = await ebayFirstResearch(options({ terms: ["charger"], searchEbay: async (term) => {
    calls.push(term);
    return term === "charger" ? peers.slice(0, 1) : peers;
  } }));
  assert.deepEqual(calls, ["charger", "usb desk lamp"]);
  assert.equal(result.recommendations.length, 1);
});
test("unprofitable CJ candidates include price comparison and rejection reason", async () => {
  const result = await ebayFirstResearch(options({ quote: async () => ({ minimumSalePrice: 30 }) }));
  assert.equal(result.excluded[0].minimumSalePrice, 30);
  assert.equal(result.excluded[0].medianPrice, 22);
  assert.match(result.excluded[0].reason, /Too expensive/);
});

test("discovery examines CJ candidates beyond the first five", async () => {
  const result = await ebayFirstResearch(options({
    searchCj: async () => Array.from({ length: 20 }, (_, i) => ({ pid: `CJ${i}`, title: i === 9 ? "USB desk lamp" : "unrelated" })),
    match: (term, title) => title === "unrelated" ? 0 : 1
  }));
  assert.equal(result.recommendations[0].product.pid, "CJ9");
  assert.equal(result.groups[0].cjCount, 20);
});

test("shipping checks are bounded at twelve per scan", async () => {
  const result = await ebayFirstResearch(options({ searchCj: async () => Array.from({ length: 20 }, (_, i) => ({ pid: `CJ${i}`, title: "USB desk lamp" })) }));
  assert.equal(result.quoted, 12);
  assert.equal(result.recommendations.length, 12);
  assert.match(result.groups[0].note, /12 shipping checks/);
});

test("batch values are validated and retained", () => {
  assert.equal(discoverySettings(new URLSearchParams({ batch: "3" })).batch, 3);
  for (const batch of ["-1", "0", "1.5", "101", "bad"]) assert.throws(() => discoverySettings(new URLSearchParams({ batch })));
});

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
