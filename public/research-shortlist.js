export function createResearchShortlist(root, { api, findMatches }) {
  const status = root.querySelector("[data-status]");
  const list = root.querySelector("[data-shortlist]");
  const mapping = root.querySelector("[data-mapping]");
  let preview;
  let busy = false;
  const fields = { title: "Product title", url: "eBay listing URL", price: "Delivered price (GBP)", sales: "Units sold" };
  const aliases = {
    title: ["title", "producttitle", "ebaytitle", "productname", "itemtitle"],
    url: ["ebayurl", "ebaylink", "listingurl", "itemurl"],
    price: ["deliveredpricegbp", "deliveredprice"],
    sales: ["unitssold", "sales", "sold", "totalsold", "30daysales", "sales30days"]
  };
  function render(ideas) {
    list.replaceChildren();
    if (!ideas.length) { list.textContent = "No saved research products."; return; }
    for (const idea of ideas) {
      const article = document.createElement("article");
      article.className = "research-idea";
      const title = document.createElement("strong");
      title.textContent = idea.title;
      const details = document.createElement("p");
      details.className = "meta";
      details.textContent = `${idea.source === "ebay" ? "eBay Product Research" : idea.source === "zik" ? "ZIK export" : "Manual research"} | ${idea.sales == null ? "Sales evidence missing" : `${idea.sales} sold over ${idea.days} days (user-supplied)`} | ${idea.price == null ? "Reference price missing" : `GBP ${idea.price.toFixed(2)} delivered`} | Saved ${new Date(idea.importedAt).toLocaleDateString("en-GB")}`;
      article.append(title, details);
      const metrics = document.createElement("p"); metrics.className = "meta";
      metrics.textContent = `Sell-through: ${idea.sellThrough == null ? "unknown" : `${idea.sellThrough}%`} | Sellers: ${idea.sellers ?? "unknown"} | Profit target: GBP ${idea.targetProfitGbp ?? 1} | Delivery limit: ${idea.maxDeliveryDays ?? 15} business days including processing`;
      article.append(metrics);
      if (idea.url) {
        const link = document.createElement("a");
        link.href = idea.url; link.target = "_blank"; link.rel = "noreferrer";
        link.textContent = "eBay reference";
        article.append(link);
      }
      const actions = document.createElement("div");
      actions.className = "research-idea-actions";
      const find = document.createElement("button");
      find.type = "button"; find.textContent = "Find CJ matches";
      find.addEventListener("click", () => run(async () => { await findMatches(idea); }));
      const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit research";
      edit.addEventListener("click", () => {
        const form = root.querySelector("[data-manual]"); form.reset();
        for (const control of form.elements) if (control.name && idea[control.name] != null) control.value = idea[control.name];
        form.closest("details").open = true; form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      const remove = document.createElement("button");
      remove.type = "button"; remove.textContent = "Remove from shortlist";
      remove.addEventListener("click", () => run(async () => {
        const result = await api("/api/research/ideas", { method: "DELETE", body: JSON.stringify({ id: idea.id }) });
        render(result.ideas);
      }));
      actions.append(find, edit, remove); article.append(actions); list.append(article);
    }
  }
  async function run(work) {
    if (busy) return;
    busy = true; status.textContent = "Working...";
    root.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try { await work(); if (status.textContent === "Working...") status.textContent = ""; }
    catch (error) { status.textContent = error.message; }
    finally { busy = false; root.querySelectorAll("button").forEach((button) => { button.disabled = false; }); }
  }
  async function save(ideas, id = "") {
    const result = await api("/api/research/ideas", { method: id ? "PUT" : "POST", body: JSON.stringify({ ideas, id }) });
    render(result.ideas);
    status.textContent = id ? "Research updated." : `${result.added} added; ${result.skipped} duplicates skipped.`;
  }
  root.querySelector("[data-manual]").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    run(async () => { const idea = Object.fromEntries(new FormData(form)); await save([idea], idea.id); form.reset(); });
  });
  root.querySelector("[data-csv]").addEventListener("change", (event) => {
    const file = event.target.files[0];
    preview = null; mapping.hidden = true;
    if (!file) return;
    run(async () => {
      if (file.size > 1_000_000) throw new Error("Choose a CSV smaller than 1 MB.");
      preview = await api("/api/research/import-preview", { method: "POST", body: JSON.stringify({ csv: await file.text() }) });
      const columns = mapping.querySelector("[data-columns]");
      columns.replaceChildren();
      for (const [key, labelText] of Object.entries(fields)) {
        const label = document.createElement("label"); label.textContent = labelText;
        const select = document.createElement("select"); select.name = key;
        select.add(new Option(key === "title" ? "Select title column" : "Not provided", ""));
        preview.headers.forEach((header, index) => select.add(new Option(header, String(index))));
        const match = preview.headers.findIndex((header) => aliases[key].includes(header.toLowerCase().replace(/[^a-z0-9]/g, "")));
        if (match >= 0) select.value = String(match);
        if (key === "title") select.required = true;
        label.append(select); columns.append(label);
      }
      mapping.hidden = false;
      mapping.querySelector("[data-preview]").textContent = `${preview.rows.length} products. First row: ${preview.rows[0].join(" | ")}`;
      status.textContent = "Review the column selections before importing. Prices must include delivery and be in GBP.";
    });
  });
  mapping.addEventListener("submit", (event) => {
    event.preventDefault();
    run(async () => {
      if (!preview) throw new Error("Choose a CSV first.");
      const values = new FormData(mapping);
      const ideas = preview.rows.map((row) => {
        const idea = { source: values.get("source"), days: values.get("days") };
        for (const key of Object.keys(fields)) { const column = values.get(key); idea[key] = column === "" ? "" : row[Number(column)]; }
        return idea;
      });
      await save(ideas); preview = null; mapping.hidden = true; root.querySelector("[data-csv]").value = "";
    });
  });
  return { async load() { await run(async () => { render((await api("/api/research/ideas")).ideas); }); } };
}
