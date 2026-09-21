import test from "node:test";
import assert from "node:assert/strict";
import { compareDraftToMarket, marketSearchTerm, prePublishChecklist, suggestedTitle } from "./public/market.js";

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
  const competitors = [
    { title: "USB C Fast Charger Plug 20W UK Adapter", price: 12.99, currency: "GBP" },
    { title: "USB Type C Charger Fast Plug For Phone", price: 14.49, currency: "GBP" },
    { title: "Fast USB-C Phone Charger Adapter", price: 15.99, currency: "GBP" }
  ];
  const result = compareDraftToMarket(draft, competitors);
  assert.equal(result.pricePosition, "High");
  assert.ok(result.score < 50);
  assert.equal(result.checklist.items.length, 7);
  assert.ok(result.suggestedTitle.includes("USB"));
  assert.ok(result.recommendations.some((item) => item.includes("20% above")));
  assert.ok(result.recommendations.some((item) => item.includes("at least 3 clear product images")));
});

test("pre-publish checklist scores strong listing inputs higher", () => {
  const strong = {
    ...draft,
    title: "USB C Fast Charger Plug 20W UK Adapter For iPhone Samsung Phone",
    itemSpecifics: { Brand: "Unbranded", Type: "Charger", Colour: "White", "Compatible Brand": "Universal", "Number of Ports": "1", Connectivity: "USB-C" },
    supplierImages: ["https://example.com/2.jpg", "https://example.com/3.jpg"],
    salePrice: 14.99,
    deliveryDays: 8
  };
  const checklist = prePublishChecklist(strong, [
    { title: "USB C Fast Charger Plug 20W UK Adapter", price: 12.99, currency: "GBP" },
    { title: "USB Type C Charger Fast Plug For Phone", price: 14.49, currency: "GBP" }
  ]);
  assert.ok(checklist.score > 75);
  assert.equal(checklist.items.find((item) => item.name === "Images").status, "pass");
  assert.ok(suggestedTitle(strong, []).length <= 80);
});
