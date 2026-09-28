import { marketSearchTerm } from "./public/market.js";
import { researchMedian } from "./research-import.mjs";

export function discoveryTerm(title) {
  const cleaned = String(title || "").replace(/\b(genuine|original|premium|brand new|free delivery|free postage|fast dispatch|best seller|sale|hot)\b/gi, " ");
  return marketSearchTerm({ title: cleaned });
}

export function discoverySettings(params) {
  const targetProfitGbp = Number(params.get("profit") ?? 1);
  const batch = Number(params.get("batch") || 1);
  if (!Number.isInteger(batch) || batch < 1 || batch > 100) throw new Error("Choose a discovery batch from 1 to 100.");
  if (!Number.isFinite(targetProfitGbp) || targetProfitGbp < 1 || targetProfitGbp > 1000) throw new Error("Choose a minimum profit between GBP 1 and GBP 1,000.");
  return { targetProfitGbp, handlingDays: 5, maxDeliveryDays: 15, batch };
}

function delivered(item) {
  return item.currency === "GBP" && item.shippingCurrency === "GBP" && item.price > 0 &&
    item.shippingCost != null && item.shippingCost !== "" && Number.isFinite(Number(item.shippingCost)) && Number(item.shippingCost) >= 0;
}

export async function ebayFirstResearch({ terms, settings, existing = [], searchEbay, searchCj, quote, match }) {
  const known = new Set(existing.map((item) => String(item.cjProductId || item.pid || "")).filter(Boolean));
  const seen = new Set();
  const searches = new Set();
  const recommendations = [];
  const groups = [];
  const warnings = [];
  const excluded = [];
  let alreadyAdded = 0;
  let quoted = 0;
  for (const niche of terms.slice(0, 3)) {
    try {
      const rawItems = await searchEbay(niche);
      const ebayItems = rawItems.filter(delivered);
      if (!ebayItems.length) warnings.push(`${niche}: ${rawItems.length} eBay results, but none with a usable GBP price and known postage.`);
      for (const source of ebayItems.slice(0, 8)) {
        const term = discoveryTerm(source.title);
        if (searches.has(term)) continue;
        if (searches.size >= 6) break;
        searches.add(term);
        let peers = ebayItems.filter((item) => match(term, discoveryTerm(item.title)) >= 0.6);
        if (peers.length < 3 && term !== niche.toLowerCase().trim()) {
          const focused = await searchEbay(term);
          peers = focused.filter((item) => delivered(item) && match(term, discoveryTerm(item.title)) >= 0.6);
        }
        const medianPrice = researchMedian(peers);
        const group = { term, medianPrice, ebayItems: peers.slice(0, 3), cjCount: 0, viableCount: 0, rejectedByPrice: 0 };
        groups.push(group);
        if (peers.length < 3 || !(medianPrice > 0)) { group.note = "Too few similar eBay listings with known UK delivery prices."; continue; }
        const products = await searchCj(term);
        group.cjCount = Math.min(products.length, 20);
        if (!products.length) group.note = "CJ returned no products for this eBay product title.";
        for (const product of products.slice(0, 20)) {
          const id = String(product.pid || product.cjProductId || "");
          if (!id || seen.has(id)) continue;
          if (known.has(id)) { alreadyAdded += 1; seen.add(id); continue; }
          if (match(term, discoveryTerm(product.title)) < 0.6) {
            group.rejectedByPrice += 1;
            excluded.push({ title: product.title, term, reason: "Needs review: title does not match closely enough." });
            continue;
          }
          if (quoted >= 12) { group.note = "12 shipping checks completed. More candidates need checking."; break; }
          seen.add(id);
          quoted += 1;
          try {
            const costs = await quote(product, medianPrice, settings);
            if (!(costs.minimumSalePrice > 0) || costs.minimumSalePrice > medianPrice) {
              group.rejectedByPrice += 1;
              excluded.push({ title: product.title, term, minimumSalePrice: costs.minimumSalePrice, medianPrice,
                reason: costs.minimumSalePrice > 0 ? "Too expensive at the selected profit target." : costs.caution || "Cost or eligible shipping quote unavailable." });
              if (costs.caution) warnings.push(`${product.title}: ${costs.caution}`);
              continue;
            }
            group.viableCount += 1;
            recommendations.push({ ...costs, product, term, sourceEbay: source,
              ebayMedianPrice: medianPrice, ebayExampleCount: peers.length,
              minimumProfitGbp: settings.targetProfitGbp, handlingDays: settings.handlingDays,
              comparisonBasis: "Similar active listings: delivered median",
              priceHeadroom: Number((medianPrice - costs.minimumSalePrice).toFixed(2)),
              medianGapPercent: Number(((costs.minimumSalePrice / medianPrice - 1) * 100).toFixed(1)),
              caution: "Potential match, not verified sales demand. Check specifications, pack quantity and variant before publishing."
            });
          } catch (error) { warnings.push(`${product.title}: ${error.message}`); excluded.push({ title: product.title, term, reason: error.message }); }
        }
      }
    } catch (error) { warnings.push(`${niche}: ${error.message}`); }
  }
  recommendations.sort((a, b) => b.priceHeadroom - a.priceHeadroom);
  return { mode: "ebay-first", batch: settings.batch, groups, recommendations, excluded, warnings, alreadyAdded, quoted,
    minimumProfitGbp: settings.targetProfitGbp, medianAllowancePercent: 0, generatedAt: new Date().toISOString() };
}
