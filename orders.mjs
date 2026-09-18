export function orderQuery(params, now = new Date()) {
  const days = Number(params.get("days") || 30);
  const offset = Number(params.get("offset") || 0);
  if (![7, 30, 90].includes(days) || !Number.isInteger(offset) || offset < 0 || offset > 10000) throw new Error("Invalid order date range or page.");
  const from = new Date(now.getTime() - days * 86400000).toISOString();
  return new URLSearchParams({ filter: `creationdate:[${from}..]`, limit: "50", offset: String(offset) });
}

function cjMatch(item, published, environment) {
  const matches = [];
  for (const listing of published.filter((entry) => entry.publishedMode === environment)) {
    if (String(listing.ebayListingId) !== String(item.legacyItemId)) continue;
    const rows = listing.multiVariation ? (listing.listingVariants || []).filter((row) => row.enabled).map((row) => ({ ...listing, ...row, sku: `${listing.sku}-${row.cjVariantId}` })) : [listing];
    for (const row of rows) {
      if (item.sku && row.sku === item.sku && row.cjProductId && row.cjVariantId) matches.push(row);
    }
  }
  if (matches.length !== 1) return null;
  const row = matches[0];
  return { productId: row.cjProductId, variantId: row.cjVariantId, label: row.label || row.cjVariantName || "", url: `https://www.cjdropshipping.com/product/p-${encodeURIComponent(row.cjProductId)}.html` };
}

export function normalizeOrder(order, published = [], environment = "production") {
  const instructions = order.fulfillmentStartInstructions || [];
  const deliveries = instructions.map((instruction) => {
    const step = instruction.shippingStep || {};
    const contact = step.shipTo || {};
    const address = contact.contactAddress || {};
    return { type: instruction.fulfillmentInstructionsType || "Unknown", name: contact.fullName || "", phone: contact.primaryPhone?.phoneNumber || "",
      address: [address.addressLine1, address.addressLine2, address.city, address.stateOrProvince, address.postalCode, address.countryCode].filter(Boolean),
      country: address.countryCode || "", service: step.shippingServiceCode || "", carrier: step.shippingCarrierCode || "" };
  });
  const warnings = [];
  if (order.orderPaymentStatus !== "PAID") warnings.push("Payment is not confirmed as paid. Check eBay before ordering.");
  if (order.cancelStatus?.cancelState && order.cancelStatus.cancelState !== "NONE_REQUESTED") warnings.push("Cancellation activity: check eBay before ordering.");
  if (order.orderFulfillmentStatus !== "NOT_STARTED") warnings.push("Fulfilment has already started or finished. Check for duplicate orders.");
  if (deliveries.length !== 1 || deliveries[0]?.type !== "SHIP_TO" || !deliveries[0]?.address.length) warnings.push("Delivery instructions need checking on eBay.");
  if (deliveries.some((delivery) => delivery.country !== "GB")) warnings.push("Delivery is not confirmed as UK-only.");
  return { id: order.orderId, createdAt: order.creationDate, payment: order.orderPaymentStatus, fulfilment: order.orderFulfillmentStatus,
    cancellation: order.cancelStatus?.cancelState || "Unknown", total: order.pricingSummary?.total, note: order.buyerCheckoutNotes || "", deliveries, warnings,
    items: (order.lineItems || []).map((item) => ({ id: item.lineItemId, listingId: item.legacyItemId, title: item.title, sku: item.sku || "", quantity: item.quantity,
      aspects: (item.variationAspects || []).map(({ name, value }) => ({ name, value })), total: item.total, fulfilment: item.lineItemFulfillmentStatus,
      shipBy: item.lineItemFulfillmentInstructions?.shipByDate || "", cj: cjMatch(item, published, environment) })) };
}

export async function fetchOrders(params, request, published, environment, now) {
  const query = orderQuery(params, now);
  const data = await request(`/sell/fulfillment/v1/order?${query}`);
  const offset = Number(query.get("offset"));
  return { orders: (data.orders || []).map((order) => normalizeOrder(order, published, environment)), offset, total: data.total || 0,
    nextOffset: data.next ? offset + 50 : null, environment, fetchedAt: new Date().toISOString() };
}
