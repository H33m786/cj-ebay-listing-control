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
    body || "A new supplier-sourced item ready to be reviewed, priced and prepared for sale.",
    "",
    "This listing should be checked against the selected CJ variant before publishing so the size, colour, specification and delivery estimate match the exact item being sold.",
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
  const variantRows = rows.map((row) => {
    const aspects = Object.entries(row.aspects || {}).filter(([, value]) => String(value || "").trim());
    const detail = aspects.map(([name, value]) => `${name}: ${value}`).join(", ");
    return { label: plainText(row.label || row.cjVariantId || "Option"), detail: plainText(detail) };
  });
  const specifics = Object.entries(draft.itemSpecifics || {})
    .filter(([name, value]) => !["Condition", "Brand"].includes(name) && String(value || "").trim())
    .map(([name, value]) => [plainText(name), plainText(Array.isArray(value) ? value.join(", ") : value)]);
  const intro = descriptionParagraphs(draft.description);
  const title = plainText(draft.title || "Product details");
  const condition = plainText(draft.itemSpecifics?.Condition || "New");
  const brand = plainText(draft.itemSpecifics?.Brand || "Unbranded");
  const galleryNote = imageCount > 1 ? `${imageCount} supplier images are included in the gallery.` : "";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.55; font-size: 15px;">
      <h2 style="font-size: 22px; margin: 0 0 12px;">${escapeHtml(title)}</h2>
      ${intro.map((paragraph) => `<p style="margin: 0 0 12px;">${escapeHtml(paragraph)}</p>`).join("")}
      <p style="margin: 0 0 16px;">Please choose the correct option before ordering and check the gallery for the style, colour and finish of the item.</p>
      <h3 style="font-size: 17px; margin: 18px 0 8px;">Key Details</h3>
      <table style="border-collapse: collapse; width: 100%; max-width: 760px;">
        <tbody>
          <tr><th style="${tableHeadStyle()}">Condition</th><td style="${tableCellStyle()}">${escapeHtml(condition)}</td></tr>
          <tr><th style="${tableHeadStyle()}">Brand</th><td style="${tableCellStyle()}">${escapeHtml(brand)}</td></tr>
          ${specifics.slice(0, 24).map(([name, value]) => `<tr><th style="${tableHeadStyle()}">${escapeHtml(name)}</th><td style="${tableCellStyle()}">${escapeHtml(value)}</td></tr>`).join("")}
        </tbody>
      </table>
      ${specifics.length > 24 ? `<p style="margin: 10px 0 0;">Additional item information may be shown in the eBay item specifics section.</p>` : ""}
      ${variantRows.length ? `
        <h3 style="font-size: 17px; margin: 18px 0 8px;">Available Variations</h3>
        <ul style="margin: 0 0 16px 18px; padding: 0;">
          ${variantRows.slice(0, 40).map((row) => `<li style="margin: 0 0 6px;"><strong>${escapeHtml(row.label)}</strong>${row.detail ? ` - ${escapeHtml(row.detail)}` : ""}</li>`).join("")}
          ${variantRows.length > 40 ? `<li>Plus ${variantRows.length - 40} more variations.</li>` : ""}
        </ul>
      ` : ""}
      <h3 style="font-size: 17px; margin: 18px 0 8px;">Dispatch and Delivery</h3>
      <p style="margin: 0 0 12px;">This item is dispatched using supplier fulfilment. Delivery estimates, handling times and shipping services are based on the selected supplier option.</p>
      ${galleryNote ? `<p style="margin: 0 0 12px;">${escapeHtml(galleryNote)}</p>` : ""}
      <h3 style="font-size: 17px; margin: 18px 0 8px;">Before You Order</h3>
      <p style="margin: 0;">Please review the selected variation, item specifics and delivery estimate carefully before purchase.</p>
    </div>
  `;
  return compactHtml(html).slice(0, 5000);
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

function descriptionParagraphs(value) {
  const text = plainText(value);
  if (!text) return ["A practical, supplier-sourced item prepared with the available product information and selected listing details."];
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (sentences.length <= 2) return [text];
  const paragraphs = [];
  for (let index = 0; index < sentences.length; index += 2) paragraphs.push(sentences.slice(index, index + 2).join(" "));
  return paragraphs.slice(0, 4);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tableHeadStyle() {
  return "text-align:left;border:1px solid #d7dde5;background:#f5f7fa;padding:9px 10px;width:34%;font-weight:700;";
}

function tableCellStyle() {
  return "border:1px solid #d7dde5;padding:9px 10px;";
}

function compactHtml(value) {
  return String(value || "")
    .replace(/\n\s*/g, "")
    .replace(/\s{2,}/g, " ")
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
