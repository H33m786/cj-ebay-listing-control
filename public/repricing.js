const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const money = (value) => value == null ? "-" : `GBP ${Number(value).toFixed(2)}`;

export function createRepricingView(root) {
  let timer;
  let active = false;
  let data;
  let generation = 0;
  async function request(path, options = {}) {
    const response = await fetch(path, { cache: "no-store", ...options, headers: { "content-type": "application/json" } });
    if (!(response.headers.get("content-type") || "").includes("application/json")) throw new Error("Price tracking requires the server-backed app.");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Price tracking request failed.");
    return body;
  }
  async function load() {
    active = true;
    const current = ++generation;
    clearTimeout(timer);
    try {
      const result = await request("/api/repricing");
      if (!active || current !== generation) return;
      data = result;
      render();
      if (data.running) timer = setTimeout(load, 3000);
    } catch (error) { if (active && current === generation) root.textContent = error.message; }
  }
  function values(form) {
    const rules = {};
    for (const row of form.querySelectorAll("[data-listing]")) {
      rules[row.dataset.listing] = { enabled: row.querySelector("[name=tracked]").checked, targetMarginPercent: Number(row.querySelector("[name=margin]").value), usdToGbp: Number(row.querySelector("[name=rate]").value), cjShippingService: row.querySelector("[name=service]").value };
    }
    return { enabled: form.elements.daily.checked, autoApply: form.elements.apply.checked, maxChangePercent: Number(form.elements.maximum.value), rules };
  }
  async function save(form) {
    const settings = values(form);
    if (settings.autoApply && !data.settings.autoApply && !window.confirm("Allow this app to change the selected eBay listing prices automatically using these margins and costs?")) return false;
    await request("/api/repricing", { method: "PUT", body: JSON.stringify(settings) });
    return true;
  }
  function render() {
    const settings = data.settings;
    const run = settings.run;
    const events = data.listings.flatMap((listing) => listing.history.map((event) => ({ ...event, title: listing.title }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100);
    root.innerHTML = `<p class="meta">${esc(data.environment)} &middot; Daily schedule: 07:17 UTC &middot; ${settings.autoApply ? "Automatic eBay updates enabled" : "Preview only"}</p><p role="status" id="trackingStatus">${data.running ? "Checking prices..." : run ? `Last check: ${esc(run.status)}${run.finishedAt ? ` (${esc(new Date(run.finishedAt).toLocaleString("en-GB"))})` : ""}${run.message ? `: ${esc(run.message)}` : ""}` : "No price checks yet"}</p><form id="trackingForm"><fieldset ${data.running ? "disabled" : ""}><div class="tracking-controls"><label><input type="checkbox" name="daily" ${settings.enabled ? "checked" : ""}> Daily checks</label><label><input type="checkbox" name="apply" ${settings.autoApply ? "checked" : ""}> Apply prices to eBay automatically</label><label>Maximum change per check (%)<input type="number" name="maximum" value="${esc(settings.maxChangePercent ?? 20)}" min="0.1" max="25" step="0.1" required></label></div><h3>Tracked listings</h3><div class="tracking-list">${data.listings.map((listing) => {
      const rule = settings.rules?.[listing.id] || {};
      return `<section class="tracking-row" data-listing="${esc(listing.id)}"><label><input type="checkbox" name="tracked" ${rule.enabled ? "checked" : ""}> ${esc(listing.title)}</label><p>${esc(listing.sku)} &middot; ${money(listing.salePrice)}${listing.multiVariation ? " &middot; Multiple variations" : ""}</p><div class="tracking-fields"><label>Target margin (%)<input type="number" name="margin" min="0.1" max="99" step="0.1" value="${esc(rule.targetMarginPercent ?? listing.targetMarginPercent ?? 25)}"></label><label>GBP per USD<input type="number" name="rate" min="0.0001" step="0.0001" value="${esc(rule.usdToGbp ?? listing.usdToGbp ?? "")}"></label><label>CJ shipping service<input name="service" value="${esc(rule.cjShippingService ?? listing.cjShippingService ?? "")}" placeholder="Exact CJ service name"></label></div></section>`;
    }).join("") || '<p>No published listings in this eBay environment.</p>'}</div><div class="tracking-actions"><button type="submit">Save settings</button><button type="button" id="previewPrices">Check prices (preview)</button><button type="button" id="applyPrices" ${settings.autoApply ? "" : "disabled"}>Update prices now</button></div></fieldset></form><h3>Price history</h3><div class="tracking-history">${events.length ? `<table><thead><tr><th>Checked</th><th>Product / SKU</th><th>eBay price</th><th>Calculated price</th><th>Result</th></tr></thead><tbody>${events.map((event) => `<tr><td>${esc(new Date(event.at).toLocaleString("en-GB"))}</td><td>${esc(event.title)}<br>${esc(event.sku)}</td><td>${money(event.oldPrice)}</td><td>${money(event.price)}</td><td>${esc(event.status)}${event.message ? `<br>${esc(event.message)}` : ""}</td></tr>`).join("")}</tbody></table>` : '<p>No price history yet.</p>'}</div>`;
    const form = root.querySelector("form");
    const status = root.querySelector("#trackingStatus");
    const action = async (kind) => {
      try {
        if (kind === "apply" && !window.confirm("Update the selected eBay listing prices now?")) return;
        if (!await save(form)) return;
        form.querySelector("fieldset").disabled = true;
        if (kind !== "save") await request("/api/repricing/run", { method: "POST", body: JSON.stringify({ preview: kind !== "apply" }) });
        await load();
      } catch (error) { status.textContent = error.message; form.querySelector("fieldset").disabled = false; }
    };
    form.addEventListener("submit", (event) => { event.preventDefault(); action("save"); });
    root.querySelector("#previewPrices").addEventListener("click", () => action("preview"));
    root.querySelector("#applyPrices").addEventListener("click", () => action("apply"));
  }
  return { load, clear() { active = false; generation++; clearTimeout(timer); } };
}
