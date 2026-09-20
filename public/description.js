const descriptionKeys = [
  "description",
  "descriptionEn",
  "productDescription",
  "productDescriptionEn",
  "productDesc",
  "productRemark",
  "remark"
];

const specKeys = [
  ["Material", ["material", "productMaterial"]],
  ["Colour", ["color", "colour"]],
  ["Size", ["size", "productSize"]],
  ["Power", ["power", "powerUsage", "ratedPower", "wattage", "voltage"]],
  ["Weight", ["weight", "productWeight"]],
  ["Packing", ["packing", "packingInfo", "packageInfo", "packageSize"]],
  ["Category", ["category", "categoryName", "threeCategoryName", "productType"]],
  ["Warehouse", ["warehouse", "warehouseName"]]
];

export function buildDraftDescription(product = {}) {
  const title = product.title || product.productNameEn || product.productName || "CJ product";
  const body = firstText(product, descriptionKeys);
  const specs = productSpecEntries(product);
  const variants = variantLabels(product.variants || product.variantList || []);
  const lines = [
    title,
    "",
    body || "New supplier-sourced item. Review the specifications below and update any details before publishing.",
    "",
    specs.length ? "Item details:" : "",
    ...specs.map(([name, value]) => `- ${name}: ${value}`),
    variants.length ? "" : "",
    variants.length ? "Available options:" : "",
    ...variants.slice(0, 30).map((value) => `- ${value}`),
    variants.length > 30 ? `- Plus ${variants.length - 30} more options` : "",
    "",
    "Condition: New.",
    "Dispatch: Supplier dispatch from CJ warehouse. Confirm the selected variant, shipping method, handling time, and delivery estimate before publishing."
  ];
  return compactLines(lines).join("\n").slice(0, 4000);
}

export function buildEbayListingDescription(draft = {}, imageCount = 0) {
  const rows = draft.multiVariation ? (draft.listingVariants || []).filter((row) => row.enabled) : [];
  const variantLines = rows.map((row) => {
    const aspects = Object.entries(row.aspects || {}).filter(([, value]) => String(value || "").trim());
    const detail = aspects.map(([name, value]) => `${name}: ${value}`).join(", ");
    return `- ${row.label || row.cjVariantId}${detail ? ` (${detail})` : ""}`;
  });
  const specifics = Object.entries(draft.itemSpecifics || {})
    .filter(([name, value]) => name !== "Condition" && String(value || "").trim())
    .map(([name, value]) => `- ${name}: ${Array.isArray(value) ? value.join(", ") : value}`);
  const lines = [
    draft.description,
    "",
    specifics.length ? "Item specifics:" : "",
    ...specifics,
    variantLines.length ? "" : "",
    variantLines.length ? "Available variations:" : "",
    ...variantLines.slice(0, 40),
    variantLines.length > 40 ? `- Plus ${variantLines.length - 40} more variations` : "",
    "",
    "Condition: New.",
    draft.itemSpecifics?.Brand ? "" : "Brand: Unbranded.",
    imageCount > 1 ? `Gallery: ${imageCount} supplier images included.` : "",
    "Dispatch and delivery estimates are based on supplier data and should be checked before production use."
  ];
  return compactLines(lines).join("\n").slice(0, 5000);
}

export function productSpecEntries(product = {}) {
  const entries = [];
  for (const [label, keys] of specKeys) {
    const value = firstText(product, keys);
    if (value) entries.push([label, value]);
  }
  collectObjectSpecs(entries, product.propertyKey || product.productKey || product.productProperties || product.attributes);
  return uniqueEntries(entries).slice(0, 18);
}

function collectObjectSpecs(entries, value) {
  if (!value) return;
  if (typeof value === "string") {
    const parsed = parseMaybeJson(value);
    if (parsed && parsed !== value) {
      collectObjectSpecs(entries, parsed);
      return;
    }
    for (const part of value.split(/[;\n|]/).map((item) => item.trim()).filter(Boolean)) {
      const [name, detail] = part.split(/[:：]/).map((item) => item?.trim());
      if (name && detail) entries.push([name, detail]);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectObjectSpecs(entries, item);
    return;
  }
  if (typeof value === "object") {
    const name = value.name || value.key || value.attrName || value.propertyName;
    const detail = value.value || value.val || value.attrValue || value.propertyValue;
    if (name && detail) entries.push([name, detail]);
    else {
      for (const [key, detailValue] of Object.entries(value)) {
        if (typeof detailValue !== "object" && String(detailValue || "").trim()) entries.push([titleCase(key), detailValue]);
      }
    }
  }
}

function variantLabels(variants) {
  return [...new Set((variants || []).map((variant) => plainText(variant.variantKey || variant.variantNameEn || variant.variantSku || variant.sku || variant.vid)).filter(Boolean))];
}

function firstText(source, keys) {
  for (const key of keys) {
    const text = plainText(source?.[key]);
    if (text) return text;
  }
  return "";
}

function plainText(value) {
  if (value == null) return "";
  const raw = Array.isArray(value) ? value.join(", ") : String(value);
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMaybeJson(value) {
  const text = String(value || "").trim();
  if (!text || !["[", "{"].includes(text[0])) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function uniqueEntries(entries) {
  const seen = new Set();
  return entries
    .map(([name, value]) => [plainText(titleCase(name)), plainText(value)])
    .filter(([name, value]) => name && value)
    .filter(([name]) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

function titleCase(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
