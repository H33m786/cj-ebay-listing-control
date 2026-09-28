import test from "node:test";
import assert from "node:assert/strict";
import { alignVariationAxesToSchema, categoryErrors, listingRows, inventoryGroup, standardAspectValue, variationErrors } from "./public/listing.js";
const size = { localizedAspectName: "Size", aspectConstraint: { aspectEnabledForVariations: true, aspectMode: "FREE_TEXT" }, aspectValues: ["M", "2XL", "3XL"].map((localizedValue) => ({ localizedValue })) };
const schema = { categoryId: "1", variationsSupported: true, aspects: [size] };
const draft = { ebayCategoryId: "1", multiVariation: true, variationAxes: ["Size"], sharedShippingConfirmed: true, sku: "TEST", itemSpecifics: {}, listingVariants: [
  { enabled: true, cjVariantId: "a", label: "XXL", aspects: { Size: "XXL" } },
  { enabled: true, cjVariantId: "b", label: "XXXL", aspects: { Size: "XXXL" } }
] };
test("standard sizes reach both inventory items and group payloads without changing CJ IDs", () => {
  const aligned = alignVariationAxesToSchema(draft, schema);
  assert.equal(aligned.listingVariants[0].cjVariantId, "a");
  assert.equal(aligned.listingVariants[0].aspects.Size, "2XL");
  const rows = listingRows(aligned);
  assert.deepEqual(rows[0].itemSpecifics.Size, ["2XL"]);
  assert.deepEqual(inventoryGroup(aligned, rows).variesBy.specifications[0].values, ["2XL", "3XL"]);
  assert.equal(draft.listingVariants[0].aspects.Size, "XXL");
});
test("custom sizes fail even when taxonomy marks Size free text", () => {
  const invalid = { ...draft, listingVariants: [{ enabled: true, cjVariantId: "a", label: "Too large", aspects: { Size: "8XL" } }] };
  assert.match(categoryErrors(invalid, schema).join(" "), /Size "8XL".*Choose: M, 2XL, 3XL/);
});
test("size mapping never guesses regional measurements or unavailable equivalents", () => {
  assert.equal(standardAspectValue("XXL", { ...size, aspectValues: [{ localizedValue: "XL" }] }), "XXL");
  assert.equal(standardAspectValue("Asian XXL", size), "Asian XXL");
  assert.equal(standardAspectValue("44", size), "44");
});
test("single listings use standard sizes and category mismatch stays untouched", () => {
  const single = { ...draft, multiVariation: false, itemSpecifics: { Size: ["XXL"] } };
  assert.deepEqual(alignVariationAxesToSchema(single, schema).itemSpecifics.Size, ["2XL"]);
  assert.deepEqual(alignVariationAxesToSchema(single, { ...schema, categoryId: "other" }).itemSpecifics.Size, ["XXL"]);
});
test("canonical size collisions are blocked by variation validation", () => {
  const repeated = { ...draft, listingVariants: [draft.listingVariants[0], { ...draft.listingVariants[1], aspects: { Size: "2XL" } }] };
  assert.ok(variationErrors(alignVariationAxesToSchema(repeated, schema)).includes("Two variations have the same attribute combination."));
});
test("size mapping respects controlling aspect restrictions", () => {
  const conditional = { ...size, aspectValues: [{ localizedValue: "2XL", valueConstraints: [{ applicableForLocalizedAspectName: "Size Type", applicableForLocalizedAspectValues: ["Regular"] }] }] };
  assert.equal(standardAspectValue("XXL", conditional, { "Size Type": "Petite" }), "XXL");
  assert.equal(standardAspectValue("XXL", conditional, { "Size Type": "Regular" }), "2XL");
});
