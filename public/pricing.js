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
  const landedCost = complete ? round((Number(draft.cost) + Number(draft.shippingCost)) * rate) : null;
  const estimatedFees = Number.isFinite(sale) && Number.isFinite(percent) && Number.isFinite(fixed) ? round(sale * percent / 100 + fixed) : null;
  const margin = landedCost != null && estimatedFees != null ? round(sale - landedCost - estimatedFees) : null;
  if (margin != null && margin <= 0) failures.push("Listing is not profitable after estimated fees.");
  return { failures, landedCost, estimatedFees, margin, marginPercent: margin != null && sale > 0 ? round(margin / sale * 100) : null };
}
