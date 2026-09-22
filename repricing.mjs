import { targetSalePrice, draftPricing } from "./public/pricing.js";
import { listingRows } from "./public/listing.js";

export function dailyDue(settings, now = new Date()) {
  return settings?.enabled === true && now.toISOString().slice(11, 16) >= "07:17" && settings.lastScheduledDate !== now.toISOString().slice(0, 10);
}

export function trackingSettings(input, published, connection) {
  const limit = Number(input.maxChangePercent);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 25) throw new Error("Maximum automatic price change must be between 0 and 25%.");
  const rules = {};
  for (const listing of published) {
    const rule = input.rules?.[listing.id];
    if (!rule?.enabled) continue;
    if (listing.publishedMode !== connection.environment) throw new Error("Select listings from the connected eBay environment only.");
    const margin = Number(rule.targetMarginPercent);
    const rate = Number(rule.usdToGbp);
    if (!Number.isFinite(margin) || margin <= 0 || margin >= 100 || !Number.isFinite(rate) || rate <= 0) throw new Error("Each tracked listing needs a target margin and a positive GBP-per-USD rate.");
    rules[listing.id] = { enabled: true, targetMarginPercent: margin, usdToGbp: rate, cjShippingService: String(rule.cjShippingService || "").trim() };
  }
  if (input.autoApply === true && !connection.connectionId) throw new Error("Reconnect eBay before enabling automatic price updates.");
  return { enabled: input.enabled === true, autoApply: input.autoApply === true, maxChangePercent: limit, rules,
    environment: connection.environment, connectionId: connection.connectionId || null };
}

export function priceProposal(row, rule, quote, offer, maxChangePercent) {
  if (!Number.isFinite(maxChangePercent) || maxChangePercent <= 0 || maxChangePercent > 25) throw new Error("Save a valid automatic change limit first.");
  if (!row.cjVariantId || quote.variantId !== row.cjVariantId || quote.currency !== "USD") throw new Error("CJ returned the wrong variant or currency.");
  if (quote.cost == null || quote.cost === "" || !Number.isFinite(Number(quote.cost)) || Number(quote.cost) <= 0) throw new Error("CJ item cost is unavailable.");
  const service = rule.cjShippingService || row.cjShippingService;
  const options = (quote.quotes || []).filter((item) => item.name === service);
  if (!service || options.length !== 1) throw new Error("The selected CJ shipping service is unavailable or ambiguous. Review shipping before repricing.");
  const shipping = options[0];
  if (shipping.currency !== "USD" || shipping.price == null || shipping.price === "" || !Number.isFinite(Number(shipping.price)) || Number(shipping.price) < 0) throw new Error("CJ shipping cost is unavailable.");
  const oldPrice = Number(offer.pricingSummary?.price?.value);
  if (offer.pricingSummary?.price?.currency !== "GBP" || !Number.isFinite(oldPrice) || oldPrice <= 0) throw new Error("The eBay offer is not a valid GBP price.");
  const candidate = { ...row, ...rule, priceTargetType: "percent", cost: Number(quote.cost), shippingCost: Number(shipping.price), costCurrency: "USD", pricingReviewed: true };
  const result = targetSalePrice(candidate);
  if (!result.price) throw new Error(result.error);
  const metrics = draftPricing({ ...candidate, salePrice: result.price });
  if (metrics.failures.length) throw new Error(metrics.failures.join(" "));
  const changePercent = Math.abs(result.price - oldPrice) / oldPrice * 100;
  return { oldPrice, price: result.price, cost: candidate.cost, shippingCost: candidate.shippingCost, service, transit: shipping.transit,
    marginPercent: metrics.marginPercent, changePercent,
    held: changePercent > maxChangePercent + 1e-8, changed: Math.round(oldPrice * 100) !== Math.round(result.price * 100) };
}

export async function findLiveOffer(request, listing, row) {
  // Resolve the SKU freshly rather than trusting positional offer IDs for variations.
  const data = await request(`/sell/inventory/v1/offer?${new URLSearchParams({ sku: row.sku, marketplace_id: "EBAY_GB", format: "FIXED_PRICE", limit: "100" })}`);
  const matches = (data.offers || []).filter((offer) => offer.sku === row.sku && offer.marketplaceId === "EBAY_GB" && offer.status === "PUBLISHED" && offer.listing?.listingId === listing.ebayListingId);
  if (matches.length !== 1 || !matches[0].offerId) throw new Error("No unique active UK eBay offer matches this listing and SKU.");
  return matches[0];
}

export async function updatePrice(request, row, offer, price) {
  const result = await request("/sell/inventory/v1/bulk_update_price_quantity", { method: "POST", body: { requests: [{ sku: row.sku, offers: [{ offerId: offer.offerId, price: { currency: "GBP", value: price.toFixed(2) } }] }] } });
  const response = result.responses?.find((entry) => entry.sku === row.sku && entry.offerId === offer.offerId);
  if (!response || !Number.isInteger(response.statusCode) || response.statusCode < 200 || response.statusCode >= 300 || response.errors?.length) throw new Error("eBay did not confirm the price update. Check the listing before retrying.");
}

export function assertTrackingConnection(settings, connection, preview) {
  if (settings.environment !== connection.environment || (settings.connectionId && settings.connectionId !== connection.connectionId)) throw new Error("eBay connection changed. Save tracking settings again before running.");
  if (!preview && (!settings.autoApply || !settings.connectionId)) throw new Error("Automatic updates have not been approved for this connection.");
  if (!preview && (!connection.liveEnabled || (connection.environment === "production" && !connection.productionConfirmed))) throw new Error("Live eBay changes are disabled by the server safety settings.");
}

export async function checkFreePostage(request, offer) {
  const id = offer.listingPolicies?.fulfillmentPolicyId;
  if (!id) throw new Error("The offer has no verifiable postage policy.");
  const policy = await request(`/sell/account/v1/fulfillment_policy/${encodeURIComponent(id)}`);
  const services = (policy.shippingOptions || []).flatMap((option) => option.shippingServices || []);
  const zero = (amount) => amount?.currency === "GBP" && amount.value != null && String(amount.value).trim() !== "" && Number(amount.value) === 0;
  if (!services.length || services.some((service) =>
    (service.freeShipping !== true && !zero(service.shippingCost)) ||
    (service.shippingCost && !zero(service.shippingCost)) ||
    (service.additionalShippingCost && !zero(service.additionalShippingCost)))) throw new Error("Automatic pricing currently requires free postage. Review the eBay postage policy.");
}

export async function repriceListing(listing, rule, settings, adapters) {
  const rows = listingRows(listing);
  if (!rows.length) throw new Error("Listing has no selected variants.");
  for (const row of rows) {
    const event = { at: new Date().toISOString(), sku: row.sku, variantId: row.cjVariantId || "", status: "checking" };
    try {
      if (!row.cjProductId || !row.cjVariantId || !row.sku) throw new Error("Saved CJ product, variant or eBay SKU is missing.");
      const quote = await adapters.quote(row);
      const offer = await findLiveOffer(adapters.request, listing, row);
      await checkFreePostage(adapters.request, offer);
      Object.assign(event, priceProposal(row, rule, quote, offer, settings.maxChangePercent));
      event.status = !event.changed ? "unchanged" : event.held ? "held" : !settings.autoApply ? "preview" : "updating";
      if (event.held) event.message = "Change exceeds the automatic limit. Review CJ costs and the eBay price manually.";
      if (event.status === "updating") {
        // Persist intent before the remote write; a fresh offer read reconciles uncertain retries.
        await adapters.record(event);
        await updatePrice(adapters.request, row, offer, event.price);
        const confirmed = await findLiveOffer(adapters.request, listing, row);
        if (confirmed.pricingSummary?.price?.currency !== "GBP" || Number(confirmed.pricingSummary?.price?.value) !== event.price) throw new Error("Updated price is not yet confirmed on eBay. Check the listing.");
        event.status = "updated";
      }
      if (event.status === "updated" || event.status === "unchanged") {
        const target = listing.multiVariation ? listing.listingVariants.find((item) => item.cjVariantId === row.cjVariantId) : listing;
        Object.assign(target, { salePrice: event.price, cost: event.cost, shippingCost: event.shippingCost, costCurrency: "USD", usdToGbp: rule.usdToGbp, targetMarginPercent: rule.targetMarginPercent });
        if (listing.multiVariation) listing.salePrice = Math.min(...listing.listingVariants.filter((item) => item.enabled).map((item) => Number(item.salePrice) || Infinity));
      }
    } catch (error) { event.status = event.status === "updating" ? "uncertain" : "failed"; event.message = error.message; }
    await adapters.record(event);
  }
}

export async function runTracking({ readStore, saveStore, connect, quote }, { scheduled = false, preview = true } = {}) {
  const store = await readStore();
  const settings = store.repricing || {};
  const now = new Date();
  if (scheduled && !dailyDue(settings, now)) return;
  settings.run = { status: "running", startedAt: now.toISOString(), preview: preview || !settings.autoApply };
  if (scheduled) settings.lastScheduledDate = now.toISOString().slice(0, 10);
  store.repricing = settings;
  await saveStore(store);
  try {
    const adapter = await connect(settings, settings.run.preview);
    const deadline = Date.now() + 15 * 60 * 1000;
    let problems = 0;
    let checked = 0;
    for (const listing of store.published || []) {
      const rule = settings.rules?.[listing.id];
      if (!rule?.enabled) continue;
      if (listing.publishedMode !== settings.environment) continue;
      await repriceListing(listing, rule, { ...settings, autoApply: !settings.run.preview }, {
        request: adapter.request, quote: async (row) => {
          if (Date.now() > deadline) throw new Error("Price check time limit reached. Remaining items require another check.");
          return quote(row);
        },
        async record(event) {
          if (event.status !== "updating") checked++;
          if (["failed", "held", "uncertain"].includes(event.status)) problems++;
          listing.priceHistory = [{ ...event }, ...(listing.priceHistory || [])].slice(0, 200);
          await saveStore(store);
        }
      });
    }
    Object.assign(settings.run, { status: problems ? "needs-review" : "complete", checked, problems });
  } catch (error) { Object.assign(settings.run, { status: "failed", message: error.message }); }
  settings.run.finishedAt = new Date().toISOString();
  await saveStore(store);
}
