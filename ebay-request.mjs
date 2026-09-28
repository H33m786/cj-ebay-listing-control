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

export async function requestEbayJson(url, init, { fetchImpl = fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  // Replacing the same inventory SKU is idempotent. Never retry offer creation or publishing here.
  const repeatable = init.method === "PUT" && /^\/sell\/inventory\/v1\/inventory_item\/[^/]+$/.test(new URL(url).pathname);
  const attempts = repeatable ? 3 : 1;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    let body;
    try {
      response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(20000) });
      const text = await response.text();
      try { body = text ? JSON.parse(text) : {}; }
      catch {
        if (response.ok) throw new Error("eBay returned an unreadable success response. The operation could not be confirmed.");
        body = { message: `eBay returned an unreadable response (HTTP ${response.status}).` };
      }
    } catch (error) {
      const transient = ["TypeError", "TimeoutError", "AbortError"].includes(error.name);
      if (!repeatable || !transient) throw error;
      if (attempt === attempts) throw new Error(`Inventory upload could not be confirmed after ${attempts} attempts because the eBay connection failed. No publish request was sent by this upload step. Try again later using the same draft.`);
      await sleep(attempt * 1500);
      continue;
    }
    if (response.ok) return { response, body };
    const errors = Array.isArray(body?.errors) ? body.errors : [];
    const systemError = errors.length > 0 && errors.every((error) => Number(error.errorId) === 25001);
    const serverError = [500, 502, 503, 504].includes(response.status) && (!errors.length || systemError);
    if (repeatable && (systemError || serverError) && attempt < attempts) {
      await sleep(attempt * 1500);
      continue;
    }
    const message = ebayErrorMessage(body, response.status);
    const requestId = response.headers.get("x-ebay-c-request-id") || response.headers.get("rlogid");
    throw new Error(`${message}${repeatable && (systemError || serverError) ? ` Inventory upload still failed after ${attempt} attempts. Try this draft again later; if it persists, contact eBay with this error.` : ""}${requestId ? ` eBay request ID: ${requestId}` : ""}`);
  }
}
