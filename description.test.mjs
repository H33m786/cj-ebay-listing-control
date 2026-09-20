import test from "node:test";
import assert from "node:assert/strict";
import { buildDraftDescription, buildEbayListingDescription } from "./public/description.js";

test("draft descriptions include supplier details, specs and variants", () => {
  const description = buildDraftDescription({
    title: "USB Desk Lamp",
    descriptionEn: "<p>Adjustable desk lamp with USB charging port.</p>",
    material: "ABS",
    power: "5W",
    warehouse: "CN",
    variants: [
      { variantKey: "Black-Warm" },
      { variantKey: "White-Cool" }
    ]
  });
  assert.match(description, /Adjustable desk lamp/);
  assert.match(description, /Material: ABS/);
  assert.match(description, /Power: 5W/);
  assert.match(description, /Black-Warm/);
  assert.match(description, /White-Cool/);
});

test("eBay listing descriptions include edited specifics and enabled variations", () => {
  const description = buildEbayListingDescription({
    description: "Warm outdoor jacket with soft shell finish.",
    itemSpecifics: { Brand: "Unbranded", Department: "Men", "Outer Shell Material": "Polyester" },
    multiVariation: true,
    listingVariants: [
      { enabled: true, label: "Black-M", aspects: { Colour: "Black", Size: "M" } },
      { enabled: false, label: "Grey-L", aspects: { Colour: "Grey", Size: "L" } }
    ]
  }, 4);
  assert.match(description, /Item specifics/);
  assert.match(description, /Department: Men/);
  assert.match(description, /Outer Shell Material: Polyester/);
  assert.match(description, /Black-M \(Colour: Black, Size: M\)/);
  assert.doesNotMatch(description, /Grey-L/);
  assert.match(description, /Gallery: 4 supplier images included/);
});
