import test from "node:test";
import assert from "node:assert/strict";
import { draftPricing } from "./public/pricing.js";

const jacket = { source: "cj", cjProductId: "2412280910051604000", cost: 9.95, shippingCost: 11.25, costCurrency: "USD", usdToGbp: 0.75, salePrice: 25, feePercent: 12.8, feeFixed: 0.3, pricingReviewed: true };
test("converts both item and freight to GBP before calculating margin", () => {
  const result = draftPricing(jacket);
  assert.equal(result.landedCost, 15.9);
  assert.equal(result.estimatedFees, 3.5);
  assert.equal(result.margin, 5.6);
  assert.deepEqual(result.failures, []);
});
test("legacy live drafts cannot publish with unreviewed mixed currencies", () => {
  const result = draftPricing({ source: "cj", cjProductId: "123", cost: 9.95, shippingCost: 0, salePrice: 17.69 });
  assert.equal(result.landedCost, null);
  assert.ok(result.failures.length >= 2);
});
test("missing freight blocks pricing; explicit free freight remains valid", () => {
  assert.ok(draftPricing({ ...jacket, shippingCost: null }).failures.length);
  assert.deepEqual(draftPricing({ ...jacket, shippingCost: 0 }).failures, []);
});
test("GBP supplier costs need no conversion, and losses block publication", () => {
  assert.equal(draftPricing({ ...jacket, costCurrency: "GBP", usdToGbp: null }).landedCost, 21.2);
  assert.ok(draftPricing({ ...jacket, salePrice: 10 }).failures.some((item) => item.includes("not profitable")));
});
