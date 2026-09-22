import { suggestedTitle, prePublishChecklist } from "./market.js";

const colorWords = ["Black", "White", "Blue", "Red", "Green", "Grey", "Gray", "Silver", "Gold", "Pink", "Purple", "Brown", "Beige", "Khaki", "Navy", "Orange", "Yellow", "Clear"];
const materialWords = ["Polyester", "Cotton", "Nylon", "Leather", "Faux Leather", "Wool", "Silicone", "TPU", "Plastic", "ABS", "Metal", "Aluminium", "Stainless Steel", "Glass"];
const styleWords = ["Jacket", "Coat", "Hoodie", "Case", "Cover", "Charger", "Cable", "Adapter", "Holder", "Stand", "Bag", "Organizer", "Organiser", "Toy", "Puzzle"];
const connectivityWords = ["USB-C", "USB C", "Lightning", "Micro USB", "Bluetooth", "Wireless", "MagSafe"];

export function optimizeDraft(draft = {}, competitors = []) {
  const next = structuredCloneSafe(draft);
  const changes = [];
  next.itemSpecifics = { ...(next.itemSpecifics || {}) };

  const title = suggestedTitle(next, competitors);
  if (title && title.length >= 35 && title !== next.title && (!next.title || next.title.length < 55 || title.length > next.title.length)) {
    next.title = title.slice(0, 80);
    changes.push("Improved title with stronger buyer search terms.");
  } else if (next.title && next.title.length > 80) {
    next.title = next.title.slice(0, 80);
    changes.push("Trimmed title to eBay's 80 character limit.");
  }

  const schema = next.ebayCategorySchema?.categoryId === next.ebayCategoryId ? next.ebayCategorySchema : null;
  const names = schema
    ? schema.aspects.filter((aspect) => {
      const rule = aspect.aspectConstraint || {};
      return rule.aspectRequired || rule.aspectUsage === "RECOMMENDED";
    }).map((aspect) => aspect.localizedAspectName)
    : ["Brand", "Type"];

  for (const name of names) {
    if (hasSpecific(next.itemSpecifics, name)) continue;
    const aspect = schema?.aspects?.find((item) => item.localizedAspectName === name);
    const value = inferSpecific(name, next, aspect);
    if (!value) continue;
    next.itemSpecifics[name] = value;
    changes.push(`Filled ${name}: ${value}.`);
  }

  const description = richerDescription(next);
  if (description.length > String(next.description || "").trim().length + 80 || String(next.description || "").trim().length < 180) {
    next.description = description;
    changes.push("Expanded the description with item specifics and available options.");
  }

  const checklist = prePublishChecklist(next, competitors);
  next.optimizedAt = new Date().toISOString();
  return { draft: next, changes: [...new Set(changes)], checklist };
}

function inferSpecific(name, draft, aspect) {
  const normalized = name.toLowerCase();
  const text = searchableText(draft);
  const allowed = (aspect?.aspectValues || []).map((item) => item.localizedValue).filter(Boolean);
  const guess = (() => {
    if (normalized === "brand") return brandGuess(text);
    if (normalized === "type") return typeGuess(draft, text);
    if (normalized === "colour" || normalized === "color") return firstWord(text, colorWords);
    if (normalized.includes("material")) return firstWord(text, materialWords);
    if (normalized === "department") return departmentGuess(text);
    if (normalized === "style") return firstWord(text, styleWords) || typeGuess(draft, text);
    if (normalized === "connectivity") return firstWord(text, connectivityWords);
    if (normalized === "compatible brand") return compatibleBrandGuess(text);
    if (normalized === "compatible model") return compatibleModelGuess(text);
    if (normalized === "cable length") return matchText(text, /\b(\d+(?:\.\d+)?)\s*(m|metre|meter|ft|feet)\b/i);
    if (normalized === "number of ports") return matchText(text, /\b(\d+)\s*(?:x\s*)?(?:ports?|usb ports?)\b/i);
    if (normalized.includes("power") || normalized.includes("watt")) return matchText(text, /\b(\d+(?:\.\d+)?)\s*w\b/i);
    if (normalized.includes("voltage")) return matchText(text, /\b(\d+(?:\.\d+)?)\s*v\b/i);
    if (normalized === "size") return matchText(text, /\b(xs|s|m|l|xl|xxl|xxxl|one size)\b/i);
    return "";
  })();
  if (!guess) return "";
  return allowedValue(guess, allowed, aspect) || "";
}

function allowedValue(guess, allowed, aspect) {
  if (!allowed.length) return cleanValue(guess);
  const exact = allowed.find((value) => value.toLowerCase() === String(guess).toLowerCase());
  if (exact) return exact;
  const partial = allowed.find((value) => {
    const left = value.toLowerCase();
    const right = String(guess).toLowerCase();
    return left.includes(right) || right.includes(left);
  });
  if (partial) return partial;
  if (aspect?.aspectConstraint?.aspectMode === "SELECTION_ONLY") return "";
  return cleanValue(guess);
}

function richerDescription(draft) {
  const lines = [];
  const base = String(draft.description || "").trim();
  if (base) lines.push(base);
  else lines.push(`${draft.title || "New supplier item"}.`);

  const specifics = Object.entries(draft.itemSpecifics || {}).filter(([name, value]) => name !== "Condition" && String(value || "").trim());
  if (specifics.length) {
    lines.push("", "Item details:");
    for (const [name, value] of specifics.slice(0, 16)) lines.push(`- ${name}: ${Array.isArray(value) ? value.join(", ") : value}`);
  }

  const variants = draft.multiVariation
    ? (draft.listingVariants || []).filter((row) => row.enabled).map((row) => row.label || Object.values(row.aspects || {}).join(" "))
    : (draft.variants || []).map((variant) => variant.variantKey || variant.variantNameEn || variant.variantSku || variant.sku || variant);
  const variantLabels = [...new Set(variants.map((item) => String(item || "").trim()).filter(Boolean))];
  if (variantLabels.length) {
    lines.push("", "Available options:");
    for (const label of variantLabels.slice(0, 30)) lines.push(`- ${label}`);
  }

  lines.push(
    "",
    "Condition: New.",
    "Dispatch: Supplier fulfilled. Delivery and handling times are based on the selected shipping quote."
  );
  return compactLines(lines).join("\n").slice(0, 4000);
}

function searchableText(draft) {
  const variantText = [
    ...(draft.variants || []).map((variant) => variant.variantKey || variant.variantNameEn || variant.variantSku || variant.sku || variant),
    ...(draft.listingVariants || []).flatMap((row) => [row.label, ...Object.values(row.aspects || {})])
  ].join(" ");
  return `${draft.title || ""} ${draft.category || ""} ${draft.ebayCategoryName || ""} ${draft.description || ""} ${variantText}`.toLowerCase();
}

function hasSpecific(specifics, name) {
  return String(specifics?.[name] || "").trim().length > 0;
}

function brandGuess(text) {
  if (/\biphone|ipad|apple\b/i.test(text)) return "Unbranded";
  if (/\bsamsung|galaxy\b/i.test(text)) return "Unbranded";
  return "Unbranded";
}

function typeGuess(draft, text) {
  const style = firstWord(text, styleWords);
  if (style) return style;
  const category = String(draft.category || draft.ebayCategoryName || "").split(/[>/,-]/)[0].trim();
  return category || "";
}

function departmentGuess(text) {
  if (/\bmen'?s|\bmale\b/.test(text)) return "Men";
  if (/\bwomen'?s|\bfemale\b/.test(text)) return "Women";
  if (/\bboys?\b/.test(text)) return "Boys";
  if (/\bgirls?\b/.test(text)) return "Girls";
  if (/\bkids?|children\b/.test(text)) return "Children";
  if (/\bunisex\b/.test(text)) return "Unisex Adults";
  return "";
}

function compatibleBrandGuess(text) {
  if (/\biphone|ipad|apple\b/i.test(text)) return "For Apple";
  if (/\bsamsung|galaxy\b/i.test(text)) return "For Samsung";
  if (/\buniversal\b/i.test(text)) return "Universal";
  return "";
}

function compatibleModelGuess(text) {
  const model = matchText(text, /\b(?:iphone|galaxy)\s?(?:\d{1,2}|se|pro|max|plus|ultra)(?:\s?(?:pro|max|plus|ultra))?\b/i);
  return model || "";
}

function firstWord(text, words) {
  return words.find((word) => new RegExp(`\\b${escapeRegExp(word).replace(/\\ /g, "\\s*")}\\b`, "i").test(text)) || "";
}

function matchText(text, pattern) {
  const match = String(text || "").match(pattern);
  return match ? cleanValue(match[0]) : "";
}

function cleanValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function compactLines(lines) {
  const output = [];
  for (const line of lines.map((item) => String(item || "").trim())) {
    if (!line && !output.at(-1)) continue;
    output.push(line);
  }
  while (!output.at(-1)) output.pop();
  return output;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value || {}));
}
