import test from "node:test";
import assert from "node:assert/strict";
import { categoryErrors, inventoryGroup, listingRows, mainListingRowIndex, variationErrors } from "./public/listing.js";
import { draftPricing } from "./public/pricing.js";

const draft = {
  id: "draft-1",
  sku: "CJ-JACKET",
  title: "Men's Winter Cotton Jacket",
  description: "A winter jacket with colour and size variants.",
  itemSpecifics: { Brand: "Unbranded", Type: "Jacket" },
  variationAxes: ["Colour", "Size"],
  autoPrice: true,
  targetMarginPercent: 15,
  feePercent: 12.8,
  feeFixed: 0.3,
  usdToGbp: 1,
  pricingReviewed: true,
  listingVariants: [
    { enabled: true, cjVariantId: "v1", label: "Grey-M", quantity: 2, cost: 20, shippingCost: 8, image: "https://example.com/grey.jpg", aspects: { Colour: "Grey", Size: "M" } },
    { enabled: true, cjVariantId: "v2", label: "Black-L", quantity: 3, cost: 21, shippingCost: 9, image: "https://example.com/black.jpg", aspects: { Colour: "Black", Size: "L" } }
  ]
};

test("inventory group declares variant SKUs and colour/size variation axes", () => {
  const rows = listingRows({ ...draft, multiVariation: true });
  const group = inventoryGroup(draft, rows);
  assert.deepEqual(group.variantSKUs, ["CJ-JACKET-v1", "CJ-JACKET-v2"]);
  assert.deepEqual(group.variesBy.aspectsImageVariesBy, ["Colour"]);
  assert.deepEqual(group.variesBy.specifications, [
    { name: "Colour", values: ["Grey", "Black"] },
    { name: "Size", values: ["M", "L"] }
  ]);
});

test("variation validation rejects duplicate attribute combinations", () => {
  const errors = variationErrors({
    ...draft,
    multiVariation: true,
    sharedShippingConfirmed: true,
    listingVariants: [
      draft.listingVariants[0],
      { ...draft.listingVariants[1], aspects: { Colour: "Grey", Size: "M" } }
    ]
  });
  assert.ok(errors.includes("Two variations have the same attribute combination."));
});

test("variant rows calculate sale prices independently from the target margin", () => {
  const rows = listingRows({ ...draft, multiVariation: true });
  assert.equal(rows[0].salePrice, 39.2);
  assert.equal(rows[1].salePrice, 41.97);
  assert.ok(draftPricing(rows[0]).marginPercent >= draft.targetMarginPercent);
  assert.ok(draftPricing(rows[1]).marginPercent >= draft.targetMarginPercent);
});

test("main listing summary uses the selected top-level variant", () => {
  const rows = listingRows({ ...draft, multiVariation: true, cjVariantId: "v2" });
  assert.equal(mainListingRowIndex({ ...draft, cjVariantId: "v2" }, rows), 1);
  assert.equal(mainListingRowIndex({ ...draft, cjVariantId: "missing" }, rows), 0);
});

test("category validation rejects unsupported variation axes before eBay publish", () => {
  const errors = categoryErrors({ ...draft, multiVariation: true, ebayCategoryId: "123" }, {
    categoryId: "123",
    variationsSupported: true,
    aspects: [
      { localizedAspectName: "Colour", aspectConstraint: { aspectEnabledForVariations: true } },
      { localizedAspectName: "Brand", aspectConstraint: {} },
      { localizedAspectName: "Type", aspectConstraint: {} }
    ]
  });
  assert.ok(errors.includes("Size is not a supported variation attribute in this category."));
});
