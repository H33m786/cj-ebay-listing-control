import test from "node:test";
import assert from "node:assert/strict";
import { buildDraftDescription, buildEbayListingDescription } from "./public/description.js";

test("draft descriptions include buyer-facing details, specs and variants", () => {
  const description = buildDraftDescription({
    title: "USB Desk Lamp",
    descriptionEn: "<p>Adjustable desk lamp with USB charging port from CJ supplier warehouse.</p>",
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
  assert.match(description, /Key features/);
  assert.doesNotMatch(description, /\bCJ\b|supplier|warehouse/i);
});

test("eBay listing descriptions include edited specifics and enabled variations without private sourcing terms", () => {
  const description = buildEbayListingDescription({
    title: "Men's Soft Shell Jacket",
    description: "Warm outdoor jacket with soft shell finish. Supplier dispatch from CJ warehouse.",
    itemSpecifics: { Brand: "Unbranded", Department: "Men", "Outer Shell Material": "Polyester" },
    multiVariation: true,
    listingVariants: [
      { enabled: true, label: "Black-M", aspects: { Colour: "Black", Size: "M" } },
      { enabled: false, label: "Grey-L", aspects: { Colour: "Grey", Size: "L" } }
    ]
  }, 4);
  assert.match(description, /<h2/);
  assert.match(description, /Overview/);
  assert.match(description, /Highlights/);
  assert.match(description, /Item Specifics/);
  assert.match(description, /Department/);
  assert.match(description, /Men/);
  assert.match(description, /Outer Shell Material/);
  assert.match(description, /Polyester/);
  assert.match(description, /Available Options/);
  assert.match(description, /Black-M/);
  assert.match(description, /Colour: Black, Size: M/);
  assert.doesNotMatch(description, /Grey-L/);
  assert.match(description, /4 product images are included/);
  assert.match(description, /Delivery/);
  assert.doesNotMatch(description, /\bCJ\b|supplier|warehouse/i);
});
