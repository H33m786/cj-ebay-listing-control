import { draftPricing } from "./pricing.js";

const stopWords = new Set(["and", "the", "for", "with", "from", "new", "mens", "womens", "women", "men", "sale", "uk"]);

function round(value) {
  return Number(value.toFixed(2));
}

function words(value) {
  return String(value || "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !stopWords.has(word));
}

function percentile(values, position) {
  if (!values.length) return null;
  const index = Math.min(values.length - 1, Math.max(0, Math.floor(position * (values.length - 1))));
  return values.slice().sort((a, b) => a - b)[index];
}

export function marketSearchTerm(draft) {
  const titleWords = words(draft.title);
  const categoryWords = words(draft.category || draft.ebayCategorySearch || "");
  return [...new Set([...titleWords.slice(0, 7), ...categoryWords.slice(0, 2)])].slice(0, 8).join(" ") || String(draft.title || draft.category || "product").slice(0, 80);
}

export function titleKeywordScore(draft, competitors = []) {
  const titleWords = new Set(words(draft.title));
  const marketWords = new Set(competitors.flatMap((item) => words(item.title)).slice(0, 80));
  if (!marketWords.size) return 0;
  return round([...titleWords].filter((word) => marketWords.has(word)).length / Math.min(titleWords.size || 1, 8) * 100);
}

export function imageCount(draft) {
  return [...new Set([draft.image, draft.supplierImage, ...(draft.supplierImages || [])].filter(Boolean))].length;
}

export function compareDraftToMarket(draft, competitors = []) {
  const prices = competitors.map((item) => Number(item.price)).filter((price) => Number.isFinite(price) && price > 0).sort((a, b) => a - b);
  const medianPrice = percentile(prices, 0.5);
  const lowPrice = percentile(prices, 0.25);
  const highPrice = percentile(prices, 0.75);
  const pricing = draftPricing(draft);
  const salePrice = Number(draft.salePrice);
  const titleLength = String(draft.title || "").trim().length;
  const specificsCount = Object.values(draft.itemSpecifics || {}).filter((value) => Array.isArray(value) ? value.length : String(value || "").trim()).length;
  const images = imageCount(draft);
  const keywordScore = titleKeywordScore(draft, competitors);
  const recommendations = [];
  let score = competitors.length ? 72 : 50;

  if (!competitors.length) recommendations.push("No close eBay examples were found. Try a broader title or category search before judging demand.");
  if (!Number.isFinite(salePrice) || salePrice <= 0) {
    score -= 25;
    recommendations.push("Set a valid eBay sale price before comparing against the market.");
  } else if (medianPrice && salePrice > medianPrice * 1.2) {
    score -= 24;
    recommendations.push(`Your price is more than 20% above the market median of GBP ${medianPrice.toFixed(2)}. Check whether shipping or profit target is too high.`);
  } else if (medianPrice && salePrice > medianPrice * 1.08) {
    score -= 12;
    recommendations.push(`Your price is slightly above the market median of GBP ${medianPrice.toFixed(2)}. Consider trimming profit or improving images/specifics.`);
  } else if (lowPrice && salePrice <= lowPrice) {
    score += 8;
  }

  if (titleLength < 55) {
    score -= 10;
    recommendations.push("Add more buyer search terms to the title, such as product type, colour, size, material, compatibility or use case.");
  }
  if (keywordScore < 35 && competitors.length) {
    score -= 12;
    recommendations.push("Your title does not share many keywords with similar eBay listings. Reuse natural buyer terms from the examples below.");
  }
  if (images < 3) {
    score -= 12;
    recommendations.push("Use at least 3 clear product images. The first image should show the exact item on a plain background.");
  }
  if (specificsCount < 5) {
    score -= 10;
    recommendations.push("Fill more item specifics. eBay search relies heavily on category specifics and filters.");
  }
  if (Number(draft.deliveryDays) > 10) {
    score -= 10;
    recommendations.push("Delivery is slower than many UK buyers expect. Make the estimate honest, but consider faster CJ services for competitive products.");
  }
  if (pricing.margin != null && pricing.margin < Number(draft.targetProfitGbp ?? 5) && (draft.priceTargetType || "fixed") !== "percent") {
    score -= 6;
    recommendations.push("Expected profit is below your target after fees. Save the draft to refresh the calculated price.");
  }

  if (!recommendations.length) recommendations.push("This listing looks competitive enough to test. Watch impressions and views after publishing.");
  const pricePosition = !medianPrice || !Number.isFinite(salePrice) ? "Unknown" : salePrice <= lowPrice ? "Low" : salePrice <= medianPrice ? "Competitive" : salePrice <= highPrice ? "Above median" : "High";

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    pricePosition,
    query: marketSearchTerm(draft),
    competitorCount: competitors.length,
    medianPrice,
    lowPrice,
    highPrice,
    salePrice: Number.isFinite(salePrice) ? round(salePrice) : null,
    keywordScore,
    imageCount: images,
    specificsCount,
    pricing,
    recommendations: [...new Set(recommendations)],
    competitors: competitors.slice(0, 8)
  };
}
