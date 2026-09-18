export function draftPricing(draft) {
  const live = draft.source === "cj" && !String(draft.cjProductId || "").startsWith("CJ-");
  const currency = draft.costCurrency || (live ? "USD" : "GBP");
  const rate = currency === "GBP" ? 1 : Number(draft.usdToGbp);
  const failures = [];
  if (!["USD", "GBP"].includes(currency)) failures.push("Select USD or GBP for supplier costs.");
  if (!Number.isFinite(rate) || rate <= 0) failures.push("Enter the GBP amount charged per USD, including conversion charges.");
  for (const key of ["cost", "shippingCost"]) {
    if (draft[key] === "" || draft[key] == null || !Number.isFinite(Number(draft[key])) || Number(draft[key]) < 0) failures.push("Enter confirmed item and shipping costs.");
  }
  if (live && draft.pricingReviewed !== true) failures.push("Confirm the selected variant, shipping quote and currency conversion.");
  const percent = Number(draft.feePercent ?? 12.8);
  const fixed = Number(draft.feeFixed ?? 0.3);
  if (!Number.isFinite(percent) || percent < 0 || percent >= 100 || !Number.isFinite(fixed) || fixed < 0) failures.push("Enter valid estimated selling fees.");
  const sale = Number(draft.salePrice);
  if (!Number.isFinite(sale) || sale <= 0) failures.push("Enter a positive GBP sale price.");
  const round = (value) => Number(value.toFixed(2));
  const complete = Number.isFinite(rate) && rate > 0 && [draft.cost, draft.shippingCost].every((value) => value !== "" && value != null && Number.isFinite(Number(value)) && Number(value) >= 0);
  const otherCosts = Number(draft.otherCostsGbp ?? 0);
  if (!Number.isFinite(otherCosts) || otherCosts < 0) failures.push("Enter valid other costs in GBP.");
  const landedCost = complete && Number.isFinite(otherCosts) && otherCosts >= 0 ? round((Number(draft.cost) + Number(draft.shippingCost)) * rate + otherCosts) : null;
  const estimatedFees = Number.isFinite(sale) && Number.isFinite(percent) && Number.isFinite(fixed) ? round(sale * percent / 100 + fixed) : null;
  const margin = landedCost != null && estimatedFees != null ? round(sale - landedCost - estimatedFees) : null;
  if (margin != null && margin <= 0) failures.push("Listing is not profitable after estimated fees.");
  return { failures, landedCost, estimatedFees, margin, marginPercent: margin != null && sale > 0 ? round(margin / sale * 100) : null };
}

export function targetSalePrice(draft) {
  const { landedCost } = draftPricing(draft);
  const target = Number(draft.targetMarginPercent);
  const fee = Number(draft.feePercent ?? 12.8);
  const fixed = Number(draft.feeFixed ?? 0.3);
  if (draft.targetMarginPercent == null || draft.targetMarginPercent === "" || !Number.isFinite(target) || target <= 0 || target >= 100) {
    return { price: null, error: "Enter a target margin greater than 0% and below 100%." };
  }
  if (!Number.isFinite(fee) || fee < 0 || !Number.isFinite(fixed) || fixed < 0 || target + fee >= 100) {
    return { price: null, error: "Target margin plus percentage fees must be below 100%; fees cannot be negative." };
  }
  if (landedCost == null) return { price: null, error: "Complete supplier costs, shipping and currency conversion to calculate the sale price." };
  // Price must cover costs, fees charged on the sale, and the requested profit share.
  let pennies = Math.max(1, Math.ceil((landedCost + fixed) / (1 - (fee + target) / 100) * 100 - 1e-8));
  if (!Number.isSafeInteger(pennies)) return { price: null, error: "The requested price exceeds the supported range." };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const price = pennies / 100;
    const result = draftPricing({ ...draft, salePrice: price });
    if (result.margin / price * 100 + 1e-9 >= target) return { price, error: null };
    pennies = Math.max(pennies + 1, Math.ceil((landedCost + fixed + 0.005) / (1 - (fee + target) / 100) * 100));
    if (!Number.isSafeInteger(pennies)) break;
  }
  return { price: null, error: "The requested margin cannot be calculated reliably. Reduce the target margin." };
}

export function applyTargetPrice(draft) {
  return draft.autoPrice === true ? { ...draft, salePrice: targetSalePrice(draft).price } : draft;
}
