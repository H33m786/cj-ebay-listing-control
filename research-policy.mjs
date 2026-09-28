import { draftPricing, targetSalePrice } from "./public/pricing.js";

export function transitDays(value) {
  const match = String(value ?? "").trim().match(/^(\d+)(?:\s*[-~\u2013]\s*(\d+))?(?:\s*(?:working |business )?days?)?$/i);
  if (!match) return null;
  const days = Number(match[2] || match[1]);
  return days > 0 && days >= Number(match[1]) ? days : null;
}

export function eligibleResearchQuote(quotes, settings = {}) {
  return (quotes || []).filter((quote) => {
    const days = transitDays(quote.transit);
    return quote.price != null && Number.isFinite(Number(quote.price)) && Number(quote.price) >= 0 &&
      (!settings.maxDeliveryDays || (days !== null && days + Number(settings.handlingDays ?? 5) <= settings.maxDeliveryDays));
  }).sort((a, b) => Number(a.price) - Number(b.price))[0] || null;
}

export function researchCostEstimate({ cost, shipping, currency, usdToGbp, marketPrice, settings = {} }) {
  const draft = {
    cost, shippingCost: shipping, costCurrency: currency, usdToGbp,
    salePrice: marketPrice, feePercent: settings.feePercent ?? 12.8, feeFixed: settings.feeFixed ?? 0.3,
    promotedListingEnabled: Number(settings.adPercent) > 0, promotedAdRatePercent: settings.adPercent ?? 0,
    otherCostsGbp: settings.otherCostsGbp ?? 0, priceTargetType: "fixed", targetProfitGbp: settings.targetProfitGbp ?? 1
  };
  const pricing = draftPricing(draft);
  const minimum = targetSalePrice(draft);
  const validCosts = [cost, shipping].every((value) => value != null && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0);
  return {
    landedEstimate: validCosts ? pricing.landedCost : null,
    minimumSalePrice: validCosts ? minimum.price : null,
    estimatedFees: pricing.totalEstimatedFees,
    roughMargin: validCosts ? pricing.margin : null,
    breakdown: pricing.breakdown
  };
}
