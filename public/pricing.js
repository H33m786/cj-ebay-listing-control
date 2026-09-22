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
  const promotedEnabled = draft.promotedListingEnabled === true;
  const promotedAdRate = promotedEnabled ? Number(draft.promotedAdRatePercent ?? 0) : 0;
  if (!Number.isFinite(percent) || percent < 0 || percent >= 100 || !Number.isFinite(fixed) || fixed < 0) failures.push("Enter valid estimated selling fees.");
  if (!Number.isFinite(promotedAdRate) || promotedAdRate < 0 || promotedAdRate >= 100) failures.push("Enter a valid promoted listing ad rate.");
  const sale = Number(draft.salePrice);
  if (!Number.isFinite(sale) || sale <= 0) failures.push("Enter a positive GBP sale price.");
  const round = (value) => Number(value.toFixed(2));
  const complete = Number.isFinite(rate) && rate > 0 && [draft.cost, draft.shippingCost].every((value) => value !== "" && value != null && Number.isFinite(Number(value)) && Number(value) >= 0);
  const otherCosts = Number(draft.otherCostsGbp ?? 0);
  if (!Number.isFinite(otherCosts) || otherCosts < 0) failures.push("Enter valid other costs in GBP.");
  const itemCostGbp = complete ? round(Number(draft.cost) * rate) : null;
  const shippingCostGbp = complete ? round(Number(draft.shippingCost) * rate) : null;
  const landedCost = complete && Number.isFinite(otherCosts) && otherCosts >= 0 ? round(itemCostGbp + shippingCostGbp + otherCosts) : null;
  const estimatedFees = Number.isFinite(sale) && Number.isFinite(percent) && Number.isFinite(fixed) ? round(sale * percent / 100 + fixed) : null;
  const promotedAdFee = promotedEnabled && Number.isFinite(sale) && Number.isFinite(promotedAdRate) ? round(sale * promotedAdRate / 100) : 0;
  const totalEstimatedFees = estimatedFees != null && Number.isFinite(promotedAdFee) ? round(estimatedFees + promotedAdFee) : null;
  const margin = landedCost != null && totalEstimatedFees != null ? round(sale - landedCost - totalEstimatedFees) : null;
  if (margin != null && margin <= 0) failures.push("Listing is not profitable after estimated fees.");
  return {
    failures,
    landedCost,
    estimatedFees,
    promotedAdFee,
    totalEstimatedFees,
    margin,
    marginPercent: margin != null && sale > 0 ? round(margin / sale * 100) : null,
    breakdown: {
      itemCostGbp,
      shippingCostGbp,
      otherCostsGbp: Number.isFinite(otherCosts) && otherCosts >= 0 ? round(otherCosts) : null,
      currency,
      rate: Number.isFinite(rate) && rate > 0 ? rate : null,
      feePercent: Number.isFinite(percent) ? percent : null,
      feeFixed: Number.isFinite(fixed) ? fixed : null,
      promotedListingEnabled: promotedEnabled,
      promotedAdRatePercent: Number.isFinite(promotedAdRate) ? promotedAdRate : null,
      promotedAdFee: Number.isFinite(promotedAdFee) ? promotedAdFee : null,
      salePrice: Number.isFinite(sale) && sale > 0 ? round(sale) : null
    }
  };
}

export function targetSalePrice(draft) {
  const { landedCost } = draftPricing(draft);
  const targetType = draft.priceTargetType === "percent" ? "percent" : "fixed";
  const rawTarget = targetType === "percent" ? draft.targetMarginPercent : draft.targetProfitGbp ?? 5;
  const target = Number(rawTarget);
  const fee = Number(draft.feePercent ?? 12.8);
  const fixed = Number(draft.feeFixed ?? 0.3);
  const promotedAdRate = draft.promotedListingEnabled === true ? Number(draft.promotedAdRatePercent ?? 0) : 0;
  if (targetType === "percent" && (draft.targetMarginPercent == null || draft.targetMarginPercent === "" || !Number.isFinite(target) || target <= 0 || target >= 100)) {
    return { price: null, error: "Enter a target margin greater than 0% and below 100%." };
  }
  if (targetType === "fixed" && (rawTarget === "" || !Number.isFinite(target) || target <= 0)) {
    return { price: null, error: "Enter a target profit greater than GBP 0." };
  }
  if (!Number.isFinite(promotedAdRate) || promotedAdRate < 0 || promotedAdRate >= 100) {
    return { price: null, error: "Enter a valid promoted listing ad rate below 100%." };
  }
  const totalPercentageFees = fee + promotedAdRate;
  if (!Number.isFinite(fee) || fee < 0 || !Number.isFinite(fixed) || fixed < 0 || (targetType === "percent" && target + totalPercentageFees >= 100) || totalPercentageFees >= 100) {
    return { price: null, error: "Percentage fees must be below 100%; fees cannot be negative." };
  }
  if (landedCost == null) return { price: null, error: "Complete supplier costs, shipping and currency conversion to calculate the sale price." };
  // Price must cover costs, fees charged on the sale, and the requested profit.
  const denominator = 1 - (totalPercentageFees + (targetType === "percent" ? target : 0)) / 100;
  const numerator = landedCost + fixed + (targetType === "fixed" ? target : 0);
  let pennies = Math.max(1, Math.ceil(numerator / denominator * 100 - 1e-8));
  if (!Number.isSafeInteger(pennies)) return { price: null, error: "The requested price exceeds the supported range." };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const price = pennies / 100;
    const result = draftPricing({ ...draft, salePrice: price });
    const targetMet = targetType === "percent" ? result.margin / price * 100 + 1e-9 >= target : result.margin + 1e-9 >= target;
    if (targetMet) return { price, error: null };
    pennies = Math.max(pennies + 1, Math.ceil((numerator + 0.005) / denominator * 100));
    if (!Number.isSafeInteger(pennies)) break;
  }
  return { price: null, error: "The requested price cannot be calculated reliably. Reduce the target profit." };
}

export function applyTargetPrice(draft) {
  return draft.autoPrice === true ? { ...draft, salePrice: targetSalePrice(draft).price } : draft;
}
