import test from "node:test";
import assert from "node:assert/strict";
import { eligibleResearchQuote, transitDays, researchCostEstimate } from "./research-policy.mjs";
import { normalizeResearchIdea } from "./research-import.mjs";

test("shipping selection includes processing and excludes unknown or slow options", () => {
  const quotes = [{ price: 1, transit: "unknown" }, { price: 2, transit: "10-20" }, { price: 5, transit: "4-7" }, { price: 9, transit: "3-5" }];
  assert.equal(eligibleResearchQuote(quotes, { maxDeliveryDays: 12, handlingDays: 5 }).price, 5);
  assert.equal(eligibleResearchQuote(quotes, { maxDeliveryDays: 7, handlingDays: 5 }), null);
  assert.equal(transitDays("4-9 business days"), 9);
  assert.equal(transitDays("9-4"), null);
});
test("research profit covers exchange rate, shipping, promotion and other costs", () => {
  const result = researchCostEstimate({ cost: 10, shipping: 5, currency: "USD", usdToGbp: 0.8, marketPrice: 25, settings: { feePercent: 10, feeFixed: 0.3, adPercent: 5, otherCostsGbp: 2, targetProfitGbp: 5 } });
  assert.equal(result.landedEstimate, 14);
  assert.equal(result.estimatedFees, 4.05);
  assert.equal(result.roughMargin, 6.95);
  assert.equal(result.minimumSalePrice, 22.71);
});
test("research never turns missing costs into a viable price", () => {
  for (const cost of [null, "", -1, undefined]) assert.equal(researchCostEstimate({ cost, shipping: 2, currency: "GBP", marketPrice: 20 }).minimumSalePrice, null);
  assert.equal(researchCostEstimate({ cost: 1, shipping: 2, currency: "USD", marketPrice: 20 }).minimumSalePrice, null);
});
test("research validates evidence and combined fee settings", () => {
  assert.throws(() => normalizeResearchIdea({ title: "Lamp", sellThrough: 101 }));
  assert.throws(() => normalizeResearchIdea({ title: "Lamp", feePercent: 80, adPercent: 20 }));
  assert.throws(() => normalizeResearchIdea({ title: "Lamp", maxDeliveryDays: 0 }));
  const idea = normalizeResearchIdea({ title: "Lamp", source: "ebay", sellThrough: 40, sellers: 5, targetProfitGbp: 3 });
  assert.equal(idea.source, "ebay");
  assert.equal(idea.targetProfitGbp, 3);
});
