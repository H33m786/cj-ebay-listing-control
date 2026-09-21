import { applyTargetPrice } from "./pricing.js";

export function aspectMap(input = {}) {
  return Object.fromEntries(Object.entries(input).filter(([name]) => name !== "Condition").map(([name, values]) => [name, (Array.isArray(values) ? values : [values]).map(String).map((v) => v.trim()).filter(Boolean)]).filter(([, values]) => values.length));
}

export function ebaySku(...parts) {
  const fallback = "SKU";
  const value = parts.join("").replace(/[^a-z0-9]/gi, "").toUpperCase() || fallback;
  return value.slice(0, 50);
}

export function listingRows(draft) {
  if (!draft.multiVariation) return [draft];
  return (draft.listingVariants || []).filter((row) => row.enabled).map((row) => applyTargetPrice({
    ...draft, ...row, multiVariation: false, listingVariants: undefined,
    costCurrency: row.costCurrency || draft.costCurrency || "USD", autoPrice: draft.autoPrice, priceTargetType: draft.priceTargetType,
    targetMarginPercent: draft.targetMarginPercent, targetProfitGbp: draft.targetProfitGbp,
    feePercent: draft.feePercent, feeFixed: draft.feeFixed, usdToGbp: draft.usdToGbp,
    otherCostsGbp: draft.otherCostsGbp,
    sku: ebaySku(draft.sku, row.cjVariantId || row.label),
    itemSpecifics: { ...aspectMap(draft.itemSpecifics), ...aspectMap(row.aspects) },
    supplierImages: [...new Set([row.image, ...(draft.supplierImages || [])].filter(Boolean))],
    pricingReviewed: draft.pricingReviewed
  }));
}

export function collapseSingleVariation(draft) {
  if (!draft.multiVariation) return draft;
  const enabled = (draft.listingVariants || []).filter((row) => row.enabled);
  if (enabled.length !== 1) return draft;
  const row = listingRows(draft)[0];
  if (!row) return draft;
  return {
    ...draft,
    ...row,
    multiVariation: false,
    listingVariants: draft.listingVariants,
    variationAxes: draft.variationAxes,
    itemSpecifics: row.itemSpecifics,
    supplierImages: row.supplierImages,
    singleVariationListing: true
  };
}

export function mainListingRowIndex(draft, rows = listingRows(draft)) {
  if (!rows.length) return -1;
  const selected = rows.findIndex((row) => row.cjVariantId && row.cjVariantId === draft.cjVariantId);
  return selected >= 0 ? selected : 0;
}

export function prepareListing(draft) {
  draft = collapseSingleVariation(draft);
  if (!draft.multiVariation) return applyTargetPrice(draft);
  const rows = listingRows(draft);
  return { ...draft, salePrice: rows.length ? Math.min(...rows.map((row) => row.salePrice || 0)) : null,
    quantity: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0) };
}

export function alignVariationAxesToSchema(draft, schema) {
  if (!draft.multiVariation || !schema || schema.categoryId !== draft.ebayCategoryId) return draft;
  const supported = (schema.aspects || []).filter((aspect) => aspect.aspectConstraint?.aspectEnabledForVariations).map((aspect) => aspect.localizedAspectName);
  if (!supported.length) return draft;
  const current = (draft.variationAxes || []).filter(Boolean);
  const nextAxes = [];
  const axisMap = new Map();
  for (const axis of current) {
    const replacement = supported.includes(axis) ? axis : supported.find((candidate) => !nextAxes.includes(candidate));
    if (!replacement) continue;
    nextAxes.push(replacement);
    axisMap.set(axis, replacement);
  }
  if (!nextAxes.length) nextAxes.push(...supported.slice(0, Math.min(2, supported.length)));
  return {
    ...draft,
    variationAxes: [...new Set(nextAxes)].slice(0, 5),
    listingVariants: (draft.listingVariants || []).map((row) => {
      const aspects = {};
      for (const [name, value] of Object.entries(row.aspects || {})) {
        const replacement = axisMap.get(name) || (supported.includes(name) ? name : null);
        if (replacement && value) aspects[replacement] = value;
      }
      return { ...row, aspects };
    })
  };
}

export function variationErrors(draft) {
  if (!draft.multiVariation) return [];
  const rows = (draft.listingVariants || []).filter((row) => row.enabled);
  const axes = (draft.variationAxes || []).filter(Boolean);
  const failures = [];
  if (rows.length < 2 || rows.length > 250) failures.push("Select between 2 and 250 variations.");
  if (!axes.length || axes.length > 5 || new Set(axes).size !== axes.length) failures.push("Choose distinct variation attributes.");
  if (!draft.sharedShippingConfirmed) failures.push("Confirm every selected variation matches the dispatch location and postage policy.");
  const seen = new Set();
  const ids = new Set();
  for (const row of rows) {
    if (!row.cjVariantId || ids.has(row.cjVariantId)) failures.push("Each variation needs a unique CJ variant.");
    ids.add(row.cjVariantId);
    const aspects = aspectMap(row.aspects);
    if (axes.some((axis) => aspects[axis]?.length !== 1)) failures.push(`${row.label || row.cjVariantId}: fill every variation attribute.`);
    const key = JSON.stringify(axes.map((axis) => aspects[axis]?.[0]?.toLowerCase()));
    if (seen.has(key)) failures.push("Two variations have the same attribute combination.");
    seen.add(key);
  }
  return [...new Set(failures)];
}

export function inventoryPayload(draft, images) {
  return { availability: { shipToLocationAvailability: { quantity: Number(draft.quantity) } }, condition: "NEW",
    product: { title: draft.title, description: draft.description, aspects: aspectMap(draft.itemSpecifics), imageUrls: images } };
}

export function inventoryGroup(draft, rows) {
  const aspects = aspectMap(draft.itemSpecifics);
  for (const axis of draft.variationAxes) delete aspects[axis];
  const variesBy = { specifications: draft.variationAxes.map((name) => ({ name, values: [...new Set(rows.map((row) => aspectMap(row.itemSpecifics)[name][0]))] })) };
  if (draft.variationAxes.includes("Colour")) variesBy.aspectsImageVariesBy = ["Colour"];
  return { title: draft.title, description: draft.description, aspects,
    imageUrls: [...new Set([...(draft.supplierImages || []), ...rows.map((row) => row.image)].filter((url) => /^https:\/\//.test(url)))].slice(0, 24),
    variantSKUs: rows.map((row) => row.sku),
    variesBy };
}

export function categoryErrors(draft, schema) {
  const errors = [];
  if (!draft.ebayCategoryId || !schema || schema.categoryId !== draft.ebayCategoryId) return ["Select and load an eBay category."];
  const supportedAxes = (schema.aspects || []).filter((aspect) => aspect.aspectConstraint?.aspectEnabledForVariations).map((aspect) => aspect.localizedAspectName);
  const axes = (draft.multiVariation ? draft.variationAxes || [] : []).filter(Boolean);
  let available = supportedAxes.filter((axis) => !axes.includes(axis));
  for (const axis of axes) {
    if (!supportedAxes.includes(axis)) {
      const replacement = available.shift();
      if (!replacement) errors.push(`${axis} is not a supported variation attribute in this category.`);
    }
  }
  draft = alignVariationAxesToSchema(draft, schema);
  if (draft.multiVariation && !schema.variationsSupported) errors.push("This eBay category does not support variations.");
  for (const row of listingRows(draft)) {
    const values = aspectMap(row.itemSpecifics);
    for (const aspect of schema.aspects) {
      const name = aspect.localizedAspectName;
      const rule = aspect.aspectConstraint || {};
      if (rule.aspectRequired && !values[name]?.length) errors.push(`Required item specific: ${name}.`);
      if (values[name]?.length > 1 && rule.itemToAspectCardinality === "SINGLE") errors.push(`${name} accepts one value.`);
      if (rule.aspectMaxLength && values[name]?.some((value) => value.length > rule.aspectMaxLength)) errors.push(`${name} exceeds eBay's length limit.`);
      if (rule.aspectMode === "SELECTION_ONLY" && values[name]?.some((value) => !(aspect.aspectValues || []).some((option) => option.localizedValue === value))) errors.push(`Choose an eBay-supported value for ${name}.`);
    }
  }
  return [...new Set(errors)];
}
