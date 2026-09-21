import { draftPricing } from "./pricing.js";

const stopWords = new Set(["and", "the", "for", "with", "from", "new", "mens", "womens", "women", "men", "sale", "uk"]);
const usefulTitleWords = new Set(["case", "cover", "shockproof", "clear", "silicone", "magnetic", "magsafe", "iphone", "samsung", "galaxy", "charger", "cable", "usb", "fast", "waterproof", "jacket", "coat", "bag", "holder", "stand", "adapter", "protective"]);

function round(value) {
  return Number(value.toFixed(2));
}

function words(value) {
  return String(value || "").toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !stopWords.has(word));
}

function titleWord(word) {
  const special = { iphone: "iPhone", ipad: "iPad", magsafe: "MagSafe", usb: "USB" };
  return special[word] || word.charAt(0).toUpperCase() + word.slice(1);
}

function trimTitle(wordsForTitle) {
  const selected = [];
  for (const word of wordsForTitle) {
    const next = [...selected, titleWord(word)].join(" ");
    if (next.length > 80) break;
    selected.push(titleWord(word));
  }
  return selected.join(" ");
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

export function suggestedTitle(draft, competitors = []) {
  const sourceWords = [
    ...words(draft.title),
    ...words(draft.category),
    ...words(draft.ebayCategoryName),
    ...Object.values(draft.itemSpecifics || {}).flatMap((value) => words(Array.isArray(value) ? value.join(" ") : value)),
    ...competitors.flatMap((item) => words(item.title)).filter((word) => usefulTitleWords.has(word))
  ];
  const unique = [...new Set(sourceWords)].filter((word) => word.length <= 18);
  const priority = unique.sort((a, b) => {
    const usefulDiff = Number(usefulTitleWords.has(b)) - Number(usefulTitleWords.has(a));
    if (usefulDiff) return usefulDiff;
    return sourceWords.filter((word) => word === b).length - sourceWords.filter((word) => word === a).length;
  });
  return trimTitle(priority.slice(0, 14)) || String(draft.title || "").slice(0, 80);
}

export function prePublishChecklist(draft, competitors = []) {
  const pricing = draftPricing(draft);
  const prices = competitors.map((item) => Number(item.price)).filter((price) => Number.isFinite(price) && price > 0).sort((a, b) => a - b);
  const medianPrice = percentile(prices, 0.5);
  const salePrice = Number(draft.salePrice);
  const titleLength = String(draft.title || "").trim().length;
  const specificsCount = Object.values(draft.itemSpecifics || {}).filter((value) => Array.isArray(value) ? value.length : String(value || "").trim()).length;
  const images = imageCount(draft);
  const keywordScore = titleKeywordScore(draft, competitors);
  const items = [
    {
      name: "Title",
      score: Math.min(100, Math.round(titleLength / 70 * 100)),
      status: titleLength >= 55 ? "pass" : titleLength >= 35 ? "warn" : "fail",
      message: titleLength >= 55 ? "Title has enough searchable detail." : "Add more buyer terms such as product type, model, material, colour or use case."
    },
    {
      name: "Market keywords",
      score: competitors.length ? keywordScore : 50,
      status: !competitors.length ? "warn" : keywordScore >= 50 ? "pass" : keywordScore >= 30 ? "warn" : "fail",
      message: competitors.length ? "Compared title wording with similar eBay listings." : "Run market comparison with a broader search if this looks too thin."
    },
    {
      name: "Images",
      score: Math.min(100, images / 5 * 100),
      status: images >= 3 ? "pass" : images >= 2 ? "warn" : "fail",
      message: `${images} image${images === 1 ? "" : "s"} available. Aim for at least 3 clear product photos.`
    },
    {
      name: "Item specifics",
      score: Math.min(100, specificsCount / 7 * 100),
      status: specificsCount >= 5 ? "pass" : specificsCount >= 3 ? "warn" : "fail",
      message: `${specificsCount} specifics filled. eBay uses these for search filters.`
    },
    {
      name: "Price",
      score: !medianPrice || !Number.isFinite(salePrice) ? 50 : salePrice <= medianPrice * 1.08 ? 100 : salePrice <= medianPrice * 1.2 ? 65 : 25,
      status: !medianPrice ? "warn" : salePrice <= medianPrice * 1.08 ? "pass" : salePrice <= medianPrice * 1.2 ? "warn" : "fail",
      message: medianPrice ? `Your price is ${salePrice <= medianPrice ? "at or below" : "above"} the GBP ${medianPrice.toFixed(2)} market median.` : "No market median available yet."
    },
    {
      name: "Profit",
      score: pricing.margin == null ? 30 : pricing.margin > 0 ? 100 : 0,
      status: pricing.margin == null ? "warn" : pricing.margin > 0 ? "pass" : "fail",
      message: pricing.margin == null ? "Profit is not calculated yet." : `Expected profit after estimated fees is GBP ${pricing.margin.toFixed(2)}.`
    },
    {
      name: "Delivery",
      score: Number(draft.deliveryDays) <= 10 ? 100 : Number(draft.deliveryDays) <= 15 ? 65 : 35,
      status: Number(draft.deliveryDays) <= 10 ? "pass" : Number(draft.deliveryDays) <= 15 ? "warn" : "fail",
      message: Number(draft.deliveryDays) <= 10 ? "Delivery estimate is competitive." : "Long delivery can reduce conversion and visibility."
    }
  ];
  const score = Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length);
  return { score, items, suggestedTitle: suggestedTitle(draft, competitors) };
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
  const checklist = prePublishChecklist(draft, competitors);
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
    checklist,
    suggestedTitle: checklist.suggestedTitle,
    recommendations: [...new Set(recommendations)],
    competitors: competitors.slice(0, 8)
  };
}
