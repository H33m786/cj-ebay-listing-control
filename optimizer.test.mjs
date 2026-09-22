import test from "node:test";
import assert from "node:assert/strict";
import { optimizeDraft } from "./public/optimizer.js";

test("optimizeDraft fills obvious required category specifics", () => {
  const draft = {
    title: "Mens winter jacket",
    category: "Outdoor shell jacket",
    description: "Soft shell mens fall winter XL outdoor shell jacket sports polyester windproof coat.",
    ebayCategoryId: "57988",
    ebayCategorySchema: {
      categoryId: "57988",
      aspects: [
        { localizedAspectName: "Brand", aspectConstraint: { aspectRequired: true } },
        { localizedAspectName: "Department", aspectConstraint: { aspectRequired: true }, aspectValues: [{ localizedValue: "Men" }, { localizedValue: "Women" }] },
        { localizedAspectName: "Outer Shell Material", aspectConstraint: { aspectRequired: true }, aspectValues: [{ localizedValue: "Polyester" }, { localizedValue: "Cotton" }] },
        { localizedAspectName: "Style", aspectConstraint: { aspectRequired: true }, aspectValues: [{ localizedValue: "Jacket" }, { localizedValue: "Coat" }] }
      ]
    },
    itemSpecifics: {}
  };

  const result = optimizeDraft(draft);

  assert.equal(result.draft.itemSpecifics.Brand, "Unbranded");
  assert.equal(result.draft.itemSpecifics.Department, "Men");
  assert.equal(result.draft.itemSpecifics["Outer Shell Material"], "Polyester");
  assert.equal(result.draft.itemSpecifics.Style, "Jacket");
  assert.match(result.draft.description, /Item details:/);
  assert.ok(result.changes.length >= 4);
});

test("optimizeDraft does not invent selection-only values it cannot match", () => {
  const draft = {
    title: "Generic desk gadget",
    category: "Desk accessory",
    description: "Simple office desk accessory.",
    ebayCategoryId: "1",
    ebayCategorySchema: {
      categoryId: "1",
      aspects: [
        { localizedAspectName: "Material", aspectConstraint: { aspectRequired: true, aspectMode: "SELECTION_ONLY" }, aspectValues: [{ localizedValue: "Wood" }] }
      ]
    },
    itemSpecifics: {}
  };

  const result = optimizeDraft(draft);

  assert.equal(result.draft.itemSpecifics.Material, undefined);
  assert.ok(!result.changes.some((change) => change.includes("Material")));
});
