import { marketSearchTerm } from "./public/market.js";
import { researchMedian } from "./research-import.mjs";

function matchingText(title) {
  return String(title || "").toLowerCase()
    .replace(/\b(?:usb[ -]?c|type[ -]?c)\b/g, "usbc")
    .replace(/\b(\d+)\s*(?:watts?|w)\b/g, "$1w")
    .replace(/\b(?:power adapter|charging adapter|charging head|charging plug|wall adapter)\b/g, "charger")
    .replace(/\bchargers\b/g, "charger");
}

export function discoveryMatch(source, candidate, fallback) {
  const left = matchingText(source);
  const right = matchingText(candidate);
  if (/\bcharger\b/.test(left)) {
    const cableOnly = (text) => /\bcables?\b/.test(text) && !/\b(?:wall|plug|adapter|head|wireless)\b/.test(text);
    if (cableOnly(left) || cableOnly(right)) return { score: 0, reason: "Cable or ambiguous cable bundle: not a confirmed charger comparison." };
    if (/\bpower\s*bank\b/.test(left) !== /\bpower\s*bank\b/.test(right)) return { score: 0, reason: "Power bank and mains charger are different products." };
    if (!/\bcharger\b/.test(right)) return { score: 0, reason: "Product type differs: looking for a charger, not a cable or accessory." };
    const kind = (text) => /\b(?:wireless|qi|magsafe)\b/.test(text) ? "wireless" : /\bcar\b/.test(text) ? "car" : "wired";
    if (kind(left) !== kind(right)) return { score: 0, reason: "Different charger type (wired, wireless or car)." };
    if (/\bcar\b/.test(left) !== /\bcar\b/.test(right)) return { score: 0, reason: "Car and non-car chargers are not comparable." };
    const power = (text) => [...text.matchAll(/\b(\d+)w\b/g)].map((value) => value[1]);
    const a = power(left);
    const b = power(right);
    if (a.length && b.length && !a.some((value) => b.includes(value))) return { score: 0, reason: `Different stated power: ${a.join("/")}W versus ${b.join("/")}W.` };
    // Product type is a discovery signal, not confirmation of compatibility or safety.
    return { score: 0.7, reason: "Potential charger match; verify connector, plug, power, certification and pack quantity." };
  }
  const score = fallback(discoveryTerm(left), discoveryTerm(right));
  return { score, reason: "Needs review: product wording does not establish a comparable item." };
}

export function chargerSearchMatches(query, title) {
  const wanted = matchingText(query);
  const actual = matchingText(title);
  if (!/\bcharger\b/.test(actual)) return false;
  if (/\bcables?\b/.test(actual) && !/\b(?:wall|plug|adapter|head|wireless)\b/.test(actual)) return false;
  const qualifiers = ["wireless", "car", "wall", "usbc", "magsafe"];
  if (qualifiers.some((word) => new RegExp(`\\b${word}\\b`).test(wanted) && !new RegExp(`\\b${word}\\b`).test(actual))) return false;
  if (/\bwired\b/.test(wanted) && /\bwireless\b/.test(actual)) return false;
  const powers = [...wanted.matchAll(/\b\d+w\b/g)].map((item) => item[0]);
  return powers.every((power) => new RegExp(`\\b${power}\\b`).test(actual));
}

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
  const comparisonCache = new Map();
  let alreadyAdded = 0;
  let quoted = 0;
  for (const niche of terms.slice(0, 3)) {
    try {
      const rawItems = await searchEbay(niche);
      const ebayItems = rawItems.filter(delivered);
      const chargerSearch = /\bcharger\b/.test(matchingText(niche));
      if (!ebayItems.length) warnings.push(`${niche}: ${rawItems.length} eBay results, but none with a usable GBP price and known postage.`);
      for (const source of ebayItems.slice(0, 8)) {
        const term = chargerSearch ? niche.toLowerCase().trim() : discoveryTerm(source.title);
        if (searches.has(term)) continue;
        if (searches.size >= 6) break;
        searches.add(term);
        let peers = ebayItems.filter((item) => discoveryMatch(source.title, item.title, match).score >= 0.6);
        if (!chargerSearch && peers.length < 3 && term !== niche.toLowerCase().trim()) {
          const focused = await searchEbay(term);
          peers = focused.filter((item) => delivered(item) && discoveryMatch(source.title, item.title, match).score >= 0.6);
        }
        const medianPrice = researchMedian(peers);
        const group = { term, medianPrice, ebayItems: peers.slice(0, 3), cjCount: 0, viableCount: 0, rejectedByPrice: 0 };
        groups.push(group);
        if (!chargerSearch && (peers.length < 3 || !(medianPrice > 0))) { group.note = "Too few similar eBay listings with known UK delivery prices."; continue; }
        if (chargerSearch) { group.medianPrice = null; group.note = "Broad charger search; each candidate has its own comparable-price check."; }
        const products = await searchCj(term);
        group.cjCount = Math.min(products.length, 20);
        if (!products.length) group.note = "CJ returned no products for this eBay product title.";
        for (const product of products.slice(0, 20)) {
          const id = String(product.pid || product.cjProductId || "");
          if (!id || seen.has(id)) continue;
          if (known.has(id)) { alreadyAdded += 1; seen.add(id); continue; }
          const similarity = chargerSearch ? { score: chargerSearchMatches(niche, product.title) ? 1 : 0, reason: "Does not match the charger requirements in your search." } : discoveryMatch(source.title, product.title, match);
          if (similarity.score < 0.6) {
            group.rejectedByPrice += 1;
            excluded.push({ title: product.title, term, reason: similarity.reason });
            continue;
          }
          if (quoted >= 12) { group.note = "12 shipping checks completed. More candidates need checking."; break; }
          let candidatePeers = peers;
          if (chargerSearch) {
            candidatePeers = ebayItems.filter((item) => discoveryMatch(product.title, item.title, match).score >= 0.6);
            if (candidatePeers.length < 3) {
              const comparisonTerm = discoveryTerm(product.title);
              if (!comparisonCache.has(comparisonTerm) && comparisonCache.size < 6) {
                comparisonCache.set(comparisonTerm, []);
                comparisonCache.set(comparisonTerm, await searchEbay(comparisonTerm));
              }
              candidatePeers = (comparisonCache.get(comparisonTerm) || []).filter((item) => delivered(item) && discoveryMatch(product.title, item.title, match).score >= 0.6);
            }
          }
          const candidateMedian = researchMedian(candidatePeers);
          if (candidatePeers.length < 3 || !(candidateMedian > 0)) {
            excluded.push({ title: product.title, term, reason: "Charger found; not enough similar eBay prices to assess profit yet." });
            continue;
          }
          seen.add(id);
          quoted += 1;
          try {
            const costs = await quote(product, candidateMedian, settings);
            if (!(costs.minimumSalePrice > 0) || costs.minimumSalePrice > candidateMedian) {
              group.rejectedByPrice += 1;
              excluded.push({ title: product.title, term, minimumSalePrice: costs.minimumSalePrice, medianPrice: candidateMedian,
                reason: costs.minimumSalePrice > 0 ? "Too expensive at the selected profit target." : costs.caution || "Cost or eligible shipping quote unavailable." });
              if (costs.caution) warnings.push(`${product.title}: ${costs.caution}`);
              continue;
            }
            group.viableCount += 1;
            recommendations.push({ ...costs, product, term, sourceEbay: candidatePeers[0] || source,
              ebayMedianPrice: candidateMedian, ebayExampleCount: candidatePeers.length,
              minimumProfitGbp: settings.targetProfitGbp, handlingDays: settings.handlingDays,
              comparisonBasis: "Similar active listings: delivered median",
              priceHeadroom: Number((candidateMedian - costs.minimumSalePrice).toFixed(2)),
              medianGapPercent: Number(((costs.minimumSalePrice / candidateMedian - 1) * 100).toFixed(1)),
              caution: "Potential match, not verified sales demand. Check specifications, plug, power, certification, pack quantity and variant before publishing."
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
