import test from "node:test";
import assert from "node:assert/strict";
import { draftPricing, targetSalePrice, applyTargetPrice } from "./public/pricing.js";

const jacket = { source: "cj", cjProductId: "2412280910051604000", cost: 9.95, shippingCost: 11.25, costCurrency: "USD", usdToGbp: 0.75, salePrice: 25, feePercent: 12.8, feeFixed: 0.3, pricingReviewed: true, priceTargetType: "percent" };
test("target price meets profit margin after percentage and fixed fees", () => {
  const draft = { ...jacket, targetMarginPercent: 25, autoPrice: true };
  const result = applyTargetPrice(draft);
  assert.equal(result.salePrice, 26.05);
  const pricing = draftPricing(result);
  assert.ok(pricing.margin / result.salePrice >= 0.25);
});
test("target price can use a fixed GBP profit instead of a percentage margin", () => {
  const draft = { ...jacket, priceTargetType: "fixed", targetProfitGbp: 5, autoPrice: true };
  const result = applyTargetPrice(draft);
  assert.equal(result.salePrice, 24.32);
  const pricing = draftPricing(result);
  assert.ok(pricing.margin >= 5);
  assert.equal(pricing.breakdown.itemCostGbp, 7.46);
  assert.equal(pricing.breakdown.shippingCostGbp, 8.44);
});
test("promoted listing ad rate is included in target pricing", () => {
  const normal = applyTargetPrice({ ...jacket, priceTargetType: "fixed", targetProfitGbp: 5, autoPrice: true });
  const promoted = applyTargetPrice({ ...jacket, priceTargetType: "fixed", targetProfitGbp: 5, autoPrice: true, promotedListingEnabled: true, promotedAdRatePercent: 5 });
  assert.ok(promoted.salePrice > normal.salePrice);
  const pricing = draftPricing(promoted);
  assert.ok(pricing.margin >= 5);
  assert.equal(promoted.salePrice, 25.8);
  assert.equal(pricing.promotedAdFee, 1.29);
  assert.equal(pricing.totalEstimatedFees, 4.89);
});
test("target price recalculates costs and preserves manual mode", () => {
  const draft = { ...jacket, targetMarginPercent: 25, autoPrice: true };
  assert.ok(applyTargetPrice({ ...draft, shippingCost: 20 }).salePrice > applyTargetPrice(draft).salePrice);
  assert.ok(applyTargetPrice({ ...draft, otherCostsGbp: 2 }).salePrice > applyTargetPrice(draft).salePrice);
  assert.equal(applyTargetPrice({ ...draft, autoPrice: false }).salePrice, 25);
});
test("incomplete or impossible targets never produce a publishable price", () => {
  for (const targetMarginPercent of [null, "", -5, 0, 100, 90]) {
    assert.equal(targetSalePrice({ ...jacket, targetMarginPercent }).price, null);
  }
  for (const targetProfitGbp of ["", -5, 0]) {
    assert.equal(targetSalePrice({ ...jacket, priceTargetType: "fixed", targetProfitGbp }).price, null);
  }
  assert.equal(targetSalePrice({ ...jacket, usdToGbp: null, targetMarginPercent: 25 }).price, null);
});
test("rounded prices achieve requested margins across small and large costs", () => {
  for (const cost of [0.01, 0.17, 9.95, 100, 1000]) {
    for (const targetMarginPercent of [5, 15, 25, 50, 80]) {
      const draft = { ...jacket, cost, targetMarginPercent };
      const { price } = targetSalePrice(draft);
      assert.ok(price > 0);
      assert.ok(draftPricing({ ...draft, salePrice: price }).margin / price * 100 + 1e-9 >= targetMarginPercent);
    }
  }
});
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
