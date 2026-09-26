const blockedTerms = [
  { term: "nike", pattern: /\bnike\b/gi, replacement: "" },
  { term: "adidas", pattern: /\badidas\b/gi, replacement: "" },
  { term: "apple", pattern: /\bapple\b/gi, replacement: "" },
  { term: "dyson", pattern: /\bdyson\b/gi, replacement: "" },
  { term: "stanley", pattern: /\bstanley\b/gi, replacement: "" },
  { term: "lego", pattern: /\blego\b/gi, replacement: "building block" },
  { term: "disney", pattern: /\bdisney\b/gi, replacement: "" },
  { term: "dupe", pattern: /\bdupe\b/gi, replacement: "alternative" },
  { term: "replica", pattern: /\breplica\b/gi, replacement: "similar style" }
];

const compatibilityRewrites = [
  { pattern: /\bfor\s+apple\s+iphone\b/gi, replacement: "for compatible smartphone" },
  { pattern: /\bfor\s+apple\s+ipad\b/gi, replacement: "for compatible tablet" },
  { pattern: /\bapple\s+iphone\b/gi, replacement: "smartphone" },
  { pattern: /\bapple\s+ipad\b/gi, replacement: "tablet" },
  { pattern: /\biphone\b/gi, replacement: "smartphone" },
  { pattern: /\bipad\b/gi, replacement: "tablet" }
];

function tidyText(value = "") {
  return String(value)
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .trim();
}

export function blockedTermMatches(input = "") {
  const text = String(input || "");
  return blockedTerms.filter(({ pattern }) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  }).map(({ term }) => term);
}

export function riskyTermsForDraft(draft = {}) {
  return [...new Set(blockedTermMatches(`${draft.title || ""} ${draft.description || ""}`))];
}

export function saferRiskWording(draft = {}) {
  const rewrite = (value = "") => {
    let text = String(value || "");
    for (const { pattern, replacement } of compatibilityRewrites) {
      text = text.replace(pattern, replacement);
    }
    for (const { pattern, replacement } of blockedTerms) {
      text = text.replace(pattern, replacement);
    }
    return tidyText(text);
  };
  const title = rewrite(draft.title);
  const description = rewrite(draft.description);
  const terms = riskyTermsForDraft(draft);
  return {
    hasRisk: terms.length > 0,
    terms,
    title,
    description,
    changed: title !== String(draft.title || "").trim() || description !== String(draft.description || "").trim()
  };
}
