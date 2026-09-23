import test from "node:test";
import assert from "node:assert/strict";
import { recoveredListingCandidates, mergeRecoveredListings } from "./ebay-recovery.mjs";

test("recoveredListingCandidates groups published variation offers by listing id", () => {
  const candidates = recoveredListingCandidates([
    {
      offer: { offerId: "offer-1", sku: "SKU-BLACK", status: "PUBLISHED", listing: { listingId: "123" }, pricingSummary: { price: { value: "19.99", currency: "GBP" } } },
      inventory: { product: { title: "Phone Case", imageUrls: ["https://example.com/a.jpg"], aspects: { Colour: ["Black"] } }, availability: { shipToLocationAvailability: { quantity: 2 } } }
    },
    {
      offer: { offerId: "offer-2", sku: "SKU-BLUE", status: "PUBLISHED", listing: { listingId: "123" }, pricingSummary: { price: { value: "21.99", currency: "GBP" } } },
      inventory: { product: { title: "Phone Case", imageUrls: ["https://example.com/b.jpg"], aspects: { Colour: ["Blue"] } }, availability: { shipToLocationAvailability: { quantity: 3 } } }
    },
    {
      offer: { offerId: "draft-offer", sku: "SKU-DRAFT", status: "UNPUBLISHED" },
      inventory: {}
    }
  ], { environment: "production", marketplaceId: "EBAY_GB" });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].listingId, "123");
  assert.equal(candidates[0].multiVariation, true);
  assert.equal(candidates[0].variants.length, 2);
  assert.equal(candidates[0].quantity, 5);
  assert.equal(candidates[0].salePrice, 19.99);
});

test("mergeRecoveredListings imports selected candidates without duplicating existing listings", () => {
  const candidates = recoveredListingCandidates([
    {
      offer: { offerId: "offer-1", sku: "SKU-1", status: "PUBLISHED", listing: { listingId: "123" }, pricingSummary: { price: { value: "15", currency: "GBP" } } },
      inventory: { product: { title: "Recovered Cable", imageUrls: [], aspects: {} }, availability: { shipToLocationAvailability: { quantity: 1 } } }
    }
  ], { environment: "production", marketplaceId: "EBAY_GB", existingPublished: [{ id: "old", ebayListingId: "123", sku: "SKU-1", publishedAt: "2026-01-01T00:00:00.000Z" }] });

  assert.equal(candidates[0].alreadyImported, true);
  const merged = mergeRecoveredListings([{ id: "old", ebayListingId: "123", sku: "SKU-1", publishedAt: "2026-01-01T00:00:00.000Z" }], candidates, "2026-09-23T00:00:00.000Z");

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "old");
  assert.equal(merged[0].source, "ebay-recovered");
  assert.equal(merged[0].ebayOfferId, "offer-1");
});
