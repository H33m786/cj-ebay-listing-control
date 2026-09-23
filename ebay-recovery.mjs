export function recoveredListingCandidates(rows = [], { environment = "production", marketplaceId = "EBAY_GB", existingPublished = [] } = {}) {
  const existingKeys = new Set(existingPublished.flatMap((item) => [
    item.ebayListingId && `listing:${item.ebayListingId}`,
    item.ebayOfferId && `offer:${item.ebayOfferId}`,
    ...(item.ebayOfferIds || []).map((offerId) => `offer:${offerId}`),
    item.sku && `sku:${item.sku}`
  ].filter(Boolean)));

  const groups = new Map();
  for (const row of rows) {
    const offer = row.offer || {};
    if (String(offer.status || "").toUpperCase() !== "PUBLISHED") continue;
    const originalSku = String(offer.sku || row.sku || "").trim();
    const listingId = String(offer.listing?.listingId || offer.listingId || "").trim();
    const offerId = String(offer.offerId || "").trim();
    const sku = safeRecoveredSku(originalSku || offerId || listingId);
    const key = listingId || offerId || sku;
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...row, sku, originalSku, listingId, offerId });
  }

  return [...groups.entries()].map(([key, group]) => {
    const first = group[0] || {};
    const offer = first.offer || {};
    const inventory = first.inventory || {};
    const product = inventory.product || {};
    const images = unique(group.flatMap((row) => row.inventory?.product?.imageUrls || []));
    const variants = group.map((row) => offerRow(row, environment, marketplaceId));
    const prices = variants.map((row) => Number(row.salePrice)).filter(Number.isFinite);
    const listingId = first.listingId || "";
    const offerIds = unique(group.map((row) => row.offerId).filter(Boolean));
    const title = product.title || offer.listing?.title || offer.listingDescription || offer.sku || "Recovered eBay listing";
    const fallbackImage = offer.listing?.imageUrl || offer.listing?.image?.imageUrl || "";
    const candidate = {
      id: recoveryCandidateId(environment, key),
      title,
      sku: variants[0]?.sku || first.sku || "",
      originalSku: variants[0]?.ebayOriginalSku || first.originalSku || "",
      listingId,
      offerIds,
      marketplaceId,
      environment,
      salePrice: prices.length ? Math.min(...prices) : null,
      quantity: variants.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
      image: images[0] || fallbackImage,
      images: unique([...images, fallbackImage]),
      categoryId: offer.categoryId || "",
      categoryName: offer.categoryId ? `eBay category ${offer.categoryId}` : "Recovered from eBay",
      variants,
      multiVariation: variants.length > 1,
      alreadyImported: Boolean((listingId && existingKeys.has(`listing:${listingId}`)) || offerIds.some((offerId) => existingKeys.has(`offer:${offerId}`)) || variants.some((row) => existingKeys.has(`sku:${row.sku}`)))
    };
    return candidate;
  }).sort((a, b) => Number(a.alreadyImported) - Number(b.alreadyImported) || String(a.title).localeCompare(String(b.title)));
}

export function browseListingCandidates(items = [], { environment = "production", marketplaceId = "EBAY_GB", existingPublished = [] } = {}) {
  const rows = items.map((item) => {
    const listingId = browseListingId(item);
    const image = item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || item.additionalImages?.[0]?.imageUrl || "";
    return {
      offer: {
        offerId: "",
        sku: listingId || item.itemId || item.title,
        status: "PUBLISHED",
        categoryId: item.categories?.[0]?.categoryId || "",
        listing: { listingId, title: item.title, imageUrl: image },
        pricingSummary: { price: item.price || item.currentBidPrice || {} }
      },
      inventory: {
        product: {
          title: item.title,
          imageUrls: unique([image, ...(item.additionalImages || []).map((entry) => entry.imageUrl)]),
          aspects: {}
        },
        availability: { shipToLocationAvailability: { quantity: 1 } }
      },
      sku: listingId || item.itemId || item.title,
      browseItemId: item.itemId
    };
  });
  return recoveredListingCandidates(rows, { environment, marketplaceId, existingPublished }).map((candidate) => ({
    ...candidate,
    recoverySource: "ebay-browse",
    recoveryNote: "Recovered from eBay public seller search. eBay offer IDs and CJ details may need linking before withdraw or automated CJ repricing."
  }));
}

export function recoveredPublishedRecord(candidate, existing = null, now = new Date().toISOString()) {
  const variants = candidate.variants || [];
  const base = {
    id: existing?.id || candidate.id,
    source: existing?.source || "ebay-recovered",
    recoverySource: candidate.recoverySource || "ebay",
    recoveryImportedAt: existing?.recoveryImportedAt || now,
    title: candidate.title,
    sku: candidate.sku,
    category: candidate.categoryName || "Recovered from eBay",
    description: existing?.description || "Recovered from the connected eBay account. Link CJ product and shipping details before enabling automated CJ repricing.",
    ebayCategoryId: candidate.categoryId || existing?.ebayCategoryId || "",
    ebayCategoryName: candidate.categoryName || existing?.ebayCategoryName || "",
    image: candidate.image || existing?.image || "",
    supplierImage: candidate.image || existing?.supplierImage || "",
    supplierImages: candidate.images || existing?.supplierImages || [],
    quantity: candidate.quantity || 1,
    cost: existing?.cost ?? 0,
    shippingCost: existing?.shippingCost ?? 0,
    costCurrency: existing?.costCurrency || "GBP",
    salePrice: candidate.salePrice,
    feePercent: existing?.feePercent ?? 12.8,
    feeFixed: existing?.feeFixed ?? 0.3,
    otherCostsGbp: existing?.otherCostsGbp ?? 0,
    priceTargetType: existing?.priceTargetType || "fixed",
    targetProfitGbp: existing?.targetProfitGbp ?? 5,
    targetMarginPercent: existing?.targetMarginPercent ?? 25,
    promotedListingEnabled: existing?.promotedListingEnabled === true,
    promotedAdRatePercent: existing?.promotedAdRatePercent ?? 0,
    pricingReviewed: false,
    status: existing?.status || "published",
    ebayListingId: candidate.listingId || existing?.ebayListingId || null,
    ebayOfferId: candidate.offerIds?.[0] || existing?.ebayOfferId || null,
    ebayOfferIds: candidate.offerIds || existing?.ebayOfferIds || [],
    ebayPublishVerified: true,
    ebayOriginalSku: candidate.originalSku || existing?.ebayOriginalSku || "",
    ebayPublishDetails: variants.map((row) => ({ sku: row.sku, originalSku: row.ebayOriginalSku, status: "PUBLISHED", offerId: row.ebayOfferId, listingId: candidate.listingId })),
    publishedMode: candidate.environment,
    publishedAt: existing?.publishedAt || now,
    updatedAt: now,
    recoveredNeedsCjLink: true,
    recoveryNote: candidate.recoveryNote || "Recovered from eBay. CJ product/variant and supplier costs may need to be reattached for automatic daily CJ price tracking.",
    priceHistory: existing?.priceHistory || []
  };
  if (variants.length > 1) {
    base.multiVariation = true;
    base.variationAxes = existing?.variationAxes || ["Option"];
    base.sharedShippingConfirmed = existing?.sharedShippingConfirmed || false;
    base.listingVariants = variants.map((row) => ({
      ...row,
      enabled: true,
      ebayOriginalSku: row.ebayOriginalSku || "",
      label: row.label || row.sku,
      aspects: row.aspects || { Option: row.label || row.sku },
      cost: existing?.cost ?? 0,
      shippingCost: existing?.shippingCost ?? 0,
      costCurrency: existing?.costCurrency || "GBP",
      feePercent: base.feePercent,
      feeFixed: base.feeFixed,
      otherCostsGbp: base.otherCostsGbp,
      priceTargetType: base.priceTargetType,
      targetProfitGbp: base.targetProfitGbp,
      targetMarginPercent: base.targetMarginPercent
    }));
  }
  return base;
}

export function mergeRecoveredListings(existingPublished = [], selectedCandidates = [], now = new Date().toISOString()) {
  const byKey = new Map();
  for (const listing of existingPublished) {
    byKey.set(recordKey(listing), listing);
  }
  for (const candidate of selectedCandidates) {
    const key = candidate.listingId ? `listing:${candidate.listingId}` : candidate.offerIds?.[0] ? `offer:${candidate.offerIds[0]}` : `sku:${candidate.sku}`;
    const existing = byKey.get(key) || existingPublished.find((item) => item.id === candidate.id);
    byKey.set(key, recoveredPublishedRecord(candidate, existing, now));
  }
  return [...byKey.values()].sort((a, b) => String(b.publishedAt || b.updatedAt || "").localeCompare(String(a.publishedAt || a.updatedAt || "")));
}

function offerRow(row, environment, marketplaceId) {
  const offer = row.offer || {};
  const inventory = row.inventory || {};
  const product = inventory.product || {};
  const price = Number(offer.pricingSummary?.price?.value);
  const quantity = Number(inventory.availability?.shipToLocationAvailability?.quantity ?? offer.availableQuantity ?? 1);
  const label = product.aspects ? Object.values(product.aspects).flat().filter(Boolean).slice(0, 2).join(" / ") : "";
  return {
    sku: row.sku || safeRecoveredSku(offer.sku || offer.offerId || row.listingId || "RECOVERED"),
    ebayOriginalSku: row.originalSku || offer.sku || "",
    label: label || row.originalSku || offer.sku || row.sku || "eBay SKU",
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    salePrice: Number.isFinite(price) ? price : null,
    image: product.imageUrls?.[0] || offer.listing?.imageUrl || offer.listing?.image?.imageUrl || "",
    ebayOfferId: row.offerId || offer.offerId || null,
    ebayListingId: row.listingId || offer.listing?.listingId || null,
    marketplaceId,
    publishedMode: environment,
    aspects: normalizeAspects(product.aspects)
  };
}

function normalizeAspects(aspects = {}) {
  const entries = Object.entries(aspects || {}).map(([name, value]) => [name, Array.isArray(value) ? value[0] : value]).filter(([, value]) => value);
  return Object.fromEntries(entries.length ? entries : [["Option", "Default"]]);
}

function recoveryCandidateId(environment, key) {
  return `recovered-${environment}-${String(key).replace(/[^a-z0-9]/gi, "").slice(0, 60)}`;
}

function browseListingId(item = {}) {
  if (item.legacyItemId) return String(item.legacyItemId);
  const parts = String(item.itemId || "").split("|");
  return parts.length >= 2 && /^\d+$/.test(parts[1]) ? parts[1] : "";
}

function safeRecoveredSku(value) {
  const cleaned = String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  return (cleaned || "RECOVERED").slice(0, 50);
}

function recordKey(listing = {}) {
  if (listing.ebayListingId) return `listing:${listing.ebayListingId}`;
  if (listing.ebayOfferId) return `offer:${listing.ebayOfferId}`;
  return `sku:${listing.sku || listing.id}`;
}

function unique(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}
