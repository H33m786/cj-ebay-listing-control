import { applyTargetPrice } from "./pricing.js";

export function aspectMap(input = {}) {
  return Object.fromEntries(Object.entries(input).filter(([name]) => name !== "Condition").map(([name, values]) => [name, (Array.isArray(values) ? values : [values]).map(String).map((v) => v.trim()).filter(Boolean)]).filter(([, values]) => values.length));
}

export function listingRows(draft) {
  if (!draft.multiVariation) return [draft];
  return (draft.listingVariants || []).filter((row) => row.enabled).map((row) => applyTargetPrice({
    ...draft, ...row, multiVariation: false, listingVariants: undefined,
    costCurrency: "USD", autoPrice: draft.autoPrice, targetMarginPercent: draft.targetMarginPercent,
    feePercent: draft.feePercent, feeFixed: draft.feeFixed, usdToGbp: draft.usdToGbp,
    otherCostsGbp: draft.otherCostsGbp,
    sku: `${draft.sku}-${row.cjVariantId}`,
    itemSpecifics: { ...aspectMap(draft.itemSpecifics), ...aspectMap(row.aspects) },
    supplierImages: [...new Set([row.image, ...(draft.supplierImages || [])].filter(Boolean))],
    pricingReviewed: draft.pricingReviewed
  }));
}

export function mainListingRowIndex(draft, rows = listingRows(draft)) {
  if (!rows.length) return -1;
  const selected = rows.findIndex((row) => row.cjVariantId && row.cjVariantId === draft.cjVariantId);
  return selected >= 0 ? selected : 0;
}

export function prepareListing(draft) {
  if (!draft.multiVariation) return applyTargetPrice(draft);
  const rows = listingRows(draft);
  return { ...draft, salePrice: rows.length ? Math.min(...rows.map((row) => row.salePrice || 0)) : null,
    quantity: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0) };
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
  if (draft.multiVariation && !schema.variationsSupported) errors.push("This eBay category does not support variations.");
  for (const axis of draft.multiVariation ? draft.variationAxes || [] : []) {
    if (!schema.aspects.some((aspect) => aspect.localizedAspectName === axis && aspect.aspectConstraint?.aspectEnabledForVariations)) errors.push(`${axis} is not a supported variation attribute in this category.`);
  }
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
