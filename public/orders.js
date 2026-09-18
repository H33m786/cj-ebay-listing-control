const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const label = (value) => String(value || "Unknown").replaceAll("_", " ").toLowerCase();
const date = (value) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString("en-GB") : "Not provided";
const amount = (value) => value ? `${escape(value.currency)} ${escape(value.value)}` : "Not provided";

export function createOrdersView(root) {
  let controller;
  let page = 0;
  let next = null;
  root.innerHTML = `<form class="toolbar" id="ordersFilters"><label>Order date<select name="days"><option value="7">Last 7 days</option><option value="30" selected>Last 30 days</option><option value="90">Last 90 days</option></select></label><button type="submit">Refresh orders</button></form><p id="ordersStatus" role="status"></p><div id="ordersResults"></div><div class="orders-pagination"><button type="button" id="ordersPrevious">Previous</button><button type="button" id="ordersNext">Next</button></div>`;
  const status = root.querySelector("#ordersStatus");
  const results = root.querySelector("#ordersResults");
  const previous = root.querySelector("#ordersPrevious");
  const more = root.querySelector("#ordersNext");
  async function load(offset = 0) {
    controller?.abort();
    controller = new AbortController();
    const current = controller;
    results.replaceChildren();
    previous.disabled = more.disabled = true;
    status.textContent = "Loading eBay orders...";
    try {
      const response = await fetch(`/api/orders?days=${root.querySelector("select").value}&offset=${offset}`, { cache: "no-store", signal: current.signal });
      if (!(response.headers.get("content-type") || "").includes("application/json")) throw new Error("Orders require the connected server app, not the static demo.");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load orders.");
      if (current !== controller) return;
      page = offset;
      next = data.nextOffset;
      status.textContent = `${data.environment === "sandbox" ? "Sandbox test orders" : "eBay orders"}: ${data.total}. Updated ${date(data.fetchedAt)}.${data.total ? ` Showing ${offset + 1}-${offset + data.orders.length}.` : " No orders in this date range."}`;
      results.innerHTML = data.orders.map((order, index) => `<article class="order-entry"><header class="order-heading"><div><h3>Order ${escape(order.id)}</h3><p>${escape(date(order.createdAt))}</p></div><strong>${amount(order.total)}</strong></header><p class="order-status">Payment: ${escape(label(order.payment))} &middot; Fulfilment: ${escape(label(order.fulfilment))} &middot; Cancellation: ${escape(label(order.cancellation))}</p>${order.warnings.map((warning) => `<p class="order-warning">${escape(warning)}</p>`).join("")}<div class="order-columns"><section><h4>Items</h4>${order.items.map((item) => `<div class="order-item"><h3>${escape(item.title)}</h3><p>Quantity: <strong>${escape(item.quantity)}</strong> &middot; ${amount(item.total)}</p><p>${item.aspects.length ? item.aspects.map((aspect) => `${escape(aspect.name)}: <strong>${escape(aspect.value)}</strong>`).join(" &middot; ") : "No variation specifications supplied by eBay."}</p><p>SKU: ${escape(item.sku || "Not supplied")}<br>Ship by: ${escape(date(item.shipBy))}<br>Item status: ${escape(label(item.fulfilment))}</p>${item.cj ? `<a href="${escape(item.cj.url)}" target="_blank" rel="noopener noreferrer">Open CJ product</a><p>CJ variant: ${escape(item.cj.variantId)} ${escape(item.cj.label)}</p>` : '<p class="order-warning">CJ product not matched. Verify the product and variation before ordering.</p>'}</div>`).join("")}</section><section><h4>Delivery</h4>${order.deliveries.map((delivery, deliveryIndex) => `<address>${escape(delivery.name)}<br>${delivery.address.map(escape).join("<br>")}${delivery.phone ? `<br>Phone: ${escape(delivery.phone)}` : ""}</address><p>${escape(delivery.carrier)} ${escape(delivery.service)}</p>${delivery.address.length ? `<button type="button" data-copy="${index}:${deliveryIndex}">Copy delivery address</button>` : "<p>Address unavailable. Check eBay.</p>"}`).join("") || "<p>No delivery address supplied. Check eBay.</p>"}${order.note ? `<h4>Buyer note</h4><p>${escape(order.note)}</p>` : ""}</section></div></article>`).join("");
      results.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
        const [i, j] = button.dataset.copy.split(":").map(Number);
        const delivery = data.orders[i].deliveries[j];
        try { await navigator.clipboard.writeText([delivery.name, ...delivery.address].filter(Boolean).join("\n")); button.textContent = "Address copied"; }
        catch { button.textContent = "Copy unavailable; select the address"; }
      }));
      previous.disabled = page === 0;
      more.disabled = next == null;
    } catch (error) {
      if (error.name !== "AbortError" && current === controller) status.textContent = error.message;
    }
  }
  root.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); load(); });
  root.querySelector("select").addEventListener("change", () => load());
  previous.addEventListener("click", () => load(Math.max(0, page - 50)));
  more.addEventListener("click", () => { if (next != null) load(next); });
  return { load, clear() { controller?.abort(); controller = null; results.replaceChildren(); status.textContent = ""; } };
}
