import test from "node:test";
import assert from "node:assert/strict";
import { compareDraftToMarket, marketSearchTerm } from "./public/market.js";

const draft = {
  title: "USB C Fast Charger Plug",
  description: "Basic charger.",
  category: "Phone Accessories",
  itemSpecifics: { Brand: "Unbranded", Type: "Charger" },
  image: "https://example.com/charger.jpg",
  supplierImages: [],
  salePrice: 39.99,
  cost: 5,
  shippingCost: 4,
  costCurrency: "GBP",
  feePercent: 12.8,
  feeFixed: 0.3,
  priceTargetType: "fixed",
  targetProfitGbp: 5,
  pricingReviewed: true,
  deliveryDays: 14
};

test("market search term uses useful draft words", () => {
  assert.equal(marketSearchTerm(draft), "usb fast charger plug phone accessories");
});

test("market comparison flags an overpriced thin listing", () => {
  const result = compareDraftToMarket(draft, [
    { title: "USB C Fast Charger Plug 20W UK Adapter", price: 12.99, currency: "GBP" },
    { title: "USB Type C Charger Fast Plug For Phone", price: 14.49, currency: "GBP" },
    { title: "Fast USB-C Phone Charger Adapter", price: 15.99, currency: "GBP" }
  ]);
  assert.equal(result.pricePosition, "High");
  assert.ok(result.score < 50);
  assert.ok(result.recommendations.some((item) => item.includes("20% above")));
  assert.ok(result.recommendations.some((item) => item.includes("at least 3 clear product images")));
});
