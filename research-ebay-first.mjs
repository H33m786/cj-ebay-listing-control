import { marketSearchTerm } from "./public/market.js";
import { researchMedian } from "./research-import.mjs";

export function discoverySettings(params) {
  const targetProfitGbp = Number(params.get("profit") ?? 1);
  if (!Number.isFinite(targetProfitGbp) || targetProfitGbp < 1 || targetProfitGbp > 1000) throw new Error("Choose a minimum profit between GBP 1 and GBP 1,000.");
  return { targetProfitGbp, handlingDays: 5, maxDeliveryDays: 15 };
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
  let alreadyAdded = 0;
  let quoted = 0;
  for (const niche of terms.slice(0, 3)) {
    try {
      const ebayItems = (await searchEbay(niche)).filter(delivered);
      for (const source of ebayItems.slice(0, 2)) {
        const term = marketSearchTerm({ title: source.title });
        if (searches.has(term)) continue;
        searches.add(term);
        const peers = ebayItems.filter((item) => match(term, item.title) >= 0.6);
        const medianPrice = researchMedian(peers);
        const group = { term, medianPrice, ebayItems: peers.slice(0, 3), cjCount: 0, viableCount: 0, rejectedByPrice: 0 };
        groups.push(group);
        if (peers.length < 3 || !(medianPrice > 0)) { group.note = "Too few similar eBay listings with known UK delivery prices."; continue; }
        const products = await searchCj(term);
        group.cjCount = products.length;
        for (const product of products.slice(0, 5)) {
          const id = String(product.pid || product.cjProductId || "");
          if (!id || seen.has(id)) continue;
          if (known.has(id)) { alreadyAdded += 1; seen.add(id); continue; }
          if (match(term, product.title) < 0.6) { group.rejectedByPrice += 1; continue; }
          if (quoted >= 6) { group.note = "Shipping-check limit reached for this scan."; break; }
          seen.add(id);
          quoted += 1;
          try {
            const costs = await quote(product, medianPrice, settings);
            if (!(costs.minimumSalePrice > 0) || costs.minimumSalePrice > medianPrice) {
              group.rejectedByPrice += 1;
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
          } catch (error) { warnings.push(`${product.title}: ${error.message}`); }
        }
      }
    } catch (error) { warnings.push(`${niche}: ${error.message}`); }
  }
  recommendations.sort((a, b) => b.priceHeadroom - a.priceHeadroom);
  return { mode: "ebay-first", groups, recommendations, warnings, alreadyAdded, quoted,
    minimumProfitGbp: settings.targetProfitGbp, medianAllowancePercent: 0, generatedAt: new Date().toISOString() };
}
