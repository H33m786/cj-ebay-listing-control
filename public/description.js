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
  ["Category", ["category", "categoryName", "threeCategoryName", "productType"]]
];

export function buildDraftDescription(product = {}) {
  const title = cleanBuyerText(product.title || product.productNameEn || product.productName || "Product details");
  const body = cleanBuyerText(firstText(product, descriptionKeys));
  const specs = productSpecEntries(product);
  const variants = variantLabels(product.variants || product.variantList || []);
  const highlights = descriptionHighlights({ title, body, specs, variants });
  const lines = [
    title,
    "",
    body || `${title} in new condition, prepared with the available product information and listing details.`,
    "",
    highlights.length ? "Key features:" : "",
    ...highlights.map((value) => `- ${value}`),
    "",
    specs.length ? "Item details:" : "",
    ...specs.map(([name, value]) => `- ${name}: ${value}`),
    variants.length ? "" : "",
    variants.length ? "Available options:" : "",
    ...variants.slice(0, 30).map((value) => `- ${value}`),
    variants.length > 30 ? `- Plus ${variants.length - 30} more options` : "",
    "",
    "Condition: New.",
    "Please check the selected option, photos, measurements and delivery estimate before ordering."
  ];
  return compactLines(lines).join("\n").slice(0, 4000);
}

export function buildEbayListingDescription(draft = {}, imageCount = 0) {
  const rows = draft.multiVariation ? (draft.listingVariants || []).filter((row) => row.enabled) : [];
  const variantRows = rows.map((row) => {
    const aspects = Object.entries(row.aspects || {}).filter(([, value]) => String(value || "").trim());
    const detail = aspects.map(([name, value]) => `${name}: ${value}`).join(", ");
    return { label: cleanBuyerText(row.label || row.cjVariantId || "Option"), detail: cleanBuyerText(detail) };
  });
  const specifics = Object.entries(draft.itemSpecifics || {})
    .filter(([name, value]) => !["Condition", "Brand"].includes(name) && String(value || "").trim())
    .map(([name, value]) => [cleanBuyerText(name), cleanBuyerText(Array.isArray(value) ? value.join(", ") : value)]);
  const intro = descriptionParagraphs(draft.description);
  const title = cleanBuyerText(draft.title || "Product details");
  const condition = cleanBuyerText(draft.itemSpecifics?.Condition || "New");
  const brand = cleanBuyerText(draft.itemSpecifics?.Brand || "Unbranded");
  const featureBullets = listingHighlights(draft, specifics, variantRows);
  const galleryNote = imageCount > 1 ? `${imageCount} product images are included in the gallery.` : "";
  const html = `
    <div style="font-family: Arial, sans-serif; color: #1f2933; line-height: 1.6; font-size: 15px; max-width: 860px;">
      <h2 style="font-size: 24px; margin: 0 0 10px; color: #111827;">${escapeHtml(title)}</h2>
      <p style="margin: 0 0 16px; color: #4b5563;">New item. Please review the selected option, photos and item specifics before ordering.</p>

      <h3 style="font-size: 18px; margin: 20px 0 8px; color: #111827;">Overview</h3>
      ${intro.map((paragraph) => `<p style="margin: 0 0 12px;">${escapeHtml(paragraph)}</p>`).join("")}

      ${featureBullets.length ? `
        <h3 style="font-size: 18px; margin: 20px 0 8px; color: #111827;">Highlights</h3>
        <ul style="margin: 0 0 16px 18px; padding: 0;">
          ${featureBullets.map((item) => `<li style="margin: 0 0 6px;">${escapeHtml(item)}</li>`).join("")}
        </ul>
      ` : ""}

      <h3 style="font-size: 18px; margin: 20px 0 8px; color: #111827;">Item Specifics</h3>
      <table style="border-collapse: collapse; width: 100%; max-width: 760px;">
        <tbody>
          <tr><th style="${tableHeadStyle()}">Condition</th><td style="${tableCellStyle()}">${escapeHtml(condition)}</td></tr>
          <tr><th style="${tableHeadStyle()}">Brand</th><td style="${tableCellStyle()}">${escapeHtml(brand)}</td></tr>
          ${specifics.slice(0, 24).map(([name, value]) => `<tr><th style="${tableHeadStyle()}">${escapeHtml(name)}</th><td style="${tableCellStyle()}">${escapeHtml(value)}</td></tr>`).join("")}
        </tbody>
      </table>
      ${specifics.length > 24 ? `<p style="margin: 10px 0 0;">Additional item information may be shown in the eBay item specifics section.</p>` : ""}
      ${variantRows.length ? `
        <h3 style="font-size: 18px; margin: 20px 0 8px; color: #111827;">Available Options</h3>
        <ul style="margin: 0 0 16px 18px; padding: 0;">
          ${variantRows.slice(0, 40).map((row) => `<li style="margin: 0 0 6px;"><strong>${escapeHtml(row.label)}</strong>${row.detail ? ` - ${escapeHtml(row.detail)}` : ""}</li>`).join("")}
          ${variantRows.length > 40 ? `<li>Plus ${variantRows.length - 40} more options.</li>` : ""}
        </ul>
      ` : ""}
      <h3 style="font-size: 18px; margin: 20px 0 8px; color: #111827;">Delivery</h3>
      <p style="margin: 0 0 12px;">Handling time and delivery estimates are shown in the postage section of this listing. Please allow for the full estimated delivery window before contacting us.</p>
      ${galleryNote ? `<p style="margin: 0 0 12px;">${escapeHtml(galleryNote)}</p>` : ""}
      <h3 style="font-size: 18px; margin: 20px 0 8px; color: #111827;">Before You Order</h3>
      <p style="margin: 0;">If the listing has selectable options, please choose the correct colour, size, model or style before checkout.</p>
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
  return [...new Set((variants || []).map((variant) => cleanBuyerText(variant.variantKey || variant.variantNameEn || variant.variantSku || variant.sku || variant.vid)).filter(Boolean))];
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

function cleanBuyerText(value) {
  return removePrivateFulfilmentTerms(plainText(value));
}

function removePrivateFulfilmentTerms(value) {
  return String(value || "")
    .replace(/\bsupplier\s+dispatch\s+from\s+CJ\s+warehouse\b/gi, "")
    .replace(/\bfrom\s+CJ\s+supplier\s+warehouse\b/gi, "")
    .replace(/\bfrom\s+CJ\s+warehouse\b/gi, "")
    .replace(/\bfrom\s+supplier\s+warehouse\b/gi, "")
    .replace(/\bCJ\s*Dropshipping\b/gi, "")
    .replace(/\bCJDropshipping\b/gi, "")
    .replace(/\bCJ\b/gi, "")
    .replace(/\bsupplier[-\s]*sourced\b/gi, "")
    .replace(/\bsupplier\s+(dispatch|fulfilled|fulfilment|fulfillment|option|warehouse)\b/gi, "")
    .replace(/\bsupplier\b/gi, "")
    .replace(/\bwarehouse\b/gi, "")
    .replace(/\bfrom\s*([.;,])/gi, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function descriptionParagraphs(value) {
  const source = plainText(value);
  const sentences = source
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => !/\b(CJ|supplier|warehouse|dropshipping)\b/i.test(item))
    .map(removePrivateFulfilmentTerms)
    .filter(Boolean);
  if (!sentences.length) return ["A practical item prepared with the available product information, selected options and listing details."];
  if (sentences.length <= 2) return [sentences.join(" ")];
  const paragraphs = [];
  for (let index = 0; index < sentences.length; index += 2) paragraphs.push(sentences.slice(index, index + 2).join(" "));
  return paragraphs.slice(0, 4);
}

function descriptionHighlights({ title, body, specs, variants }) {
  const highlights = [];
  const text = `${title} ${body}`.toLowerCase();
  const add = (value) => {
    if (value && !highlights.includes(value)) highlights.push(value);
  };
  if (/waterproof|water resistant/i.test(text)) add("Water-resistant design for everyday use.");
  if (/usb|charger|charging|power|watt|voltage/i.test(text)) add("Check compatibility, power rating and connector type before purchase.");
  if (/jacket|coat|clothing|shirt|trouser|shoe|size/i.test(text)) add("Select the correct size and colour from the available options.");
  if (/car|vehicle|auto|interior/i.test(text)) add("Designed for vehicle interior use; check fitment details before ordering.");
  if (variants.length) add("Multiple options may be available, including different colours, sizes, models or styles.");
  for (const [name, value] of specs.slice(0, 3)) add(`${name}: ${value}.`);
  return highlights.slice(0, 6).map(cleanBuyerText);
}

function listingHighlights(draft, specifics, variantRows) {
  const highlights = [];
  const add = (value) => {
    const clean = cleanBuyerText(value);
    if (clean && !highlights.includes(clean)) highlights.push(clean);
  };
  if (variantRows.length) add("Choose from the available options shown in the variation selector.");
  for (const [name, value] of specifics.slice(0, 4)) add(`${name}: ${value}.`);
  const titleText = `${draft.title || ""} ${draft.category || ""} ${draft.ebayCategoryName || ""}`.toLowerCase();
  if (/charger|usb|cable|adapter|power/i.test(titleText)) add("Check connector type and device compatibility before ordering.");
  if (/case|cover|protector/i.test(titleText)) add("Check model compatibility and finish before ordering.");
  if (/jacket|coat|clothing|shirt|trouser|shoe/i.test(titleText)) add("Please compare the selected size with your usual fit before purchase.");
  return highlights.slice(0, 7);
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
    .map(([name, value]) => [cleanBuyerText(titleCase(name)), cleanBuyerText(value)])
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
