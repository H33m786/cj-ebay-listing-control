export function accountRequestUrl(pathname, baseUrl, marketplaceId, method = "GET") {
  const url = new URL(pathname, baseUrl);
  const policyLists = ["/sell/account/v1/payment_policy", "/sell/account/v1/return_policy", "/sell/account/v1/fulfillment_policy"];
  if (method === "GET" && policyLists.includes(url.pathname) && !url.searchParams.has("marketplace_id")) {
    url.searchParams.set("marketplace_id", marketplaceId);
  }
  return url;
}

export function ebayErrorMessage(body, status) {
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  if (errors.length) {
    return errors.map((error) => {
      const message = error.longMessage || error.message || "Request rejected";
      const code = error.errorId != null ? ` (eBay ${error.errorId})` : "";
      const fields = (error.inputRefIds || []).filter(Boolean);
      const parameters = (error.parameters || []).filter((parameter) => parameter?.name && parameter?.value != null);
      const details = parameters.length ? ` Details: ${parameters.map((parameter) => `${parameter.name}=${parameter.value}`).join(", ")}.` : "";
      return `${message}${code}${fields.length ? ` Fields: ${fields.join(", ")}.` : ""}${details}`;
    }).join(" ");
  }
  const raw = body && Object.keys(body).length ? ` Response: ${JSON.stringify(body).slice(0, 600)}` : "";
  return body?.message || body?.error_description || body?.error || `eBay API failed with ${status}.${raw}`;
}
