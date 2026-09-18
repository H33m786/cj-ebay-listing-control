import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { normalizeOrder } from "../orders.mjs";

const require = createRequire(`${process.env.CODEX_NODE_MODULES}/package.json`);
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let mode = "orders";
  const fixture = normalizeOrder({ orderId: "TEST-ORDER", creationDate: "2026-09-18T10:00:00Z", orderPaymentStatus: "PAID", orderFulfillmentStatus: "NOT_STARTED", cancelStatus: { cancelState: "NONE_REQUESTED" },
    pricingSummary: { total: { currency: "GBP", value: "39.99" } },
    fulfillmentStartInstructions: [{ fulfillmentInstructionsType: "SHIP_TO", shippingStep: { shipTo: { fullName: "Test Recipient", contactAddress: { addressLine1: "1 Example Street", city: "London", postalCode: "TEST", countryCode: "GB" } } } }],
    lineItems: [{ title: "Outdoor shell jacket <script>unsafe</script>", sku: "TEST-SKU", quantity: 2, variationAspects: [{ name: "Colour", value: "Army Green" }, { name: "Size", value: "M" }] }] });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body = url.pathname === "/api/drafts" ? { drafts: [], published: [] } : url.pathname === "/api/products" ? { products: [] } : {};
    if (url.pathname === "/api/orders") body = mode === "error" ? { error: "Reconnect eBay" } : { orders: mode === "empty" ? [] : [fixture], environment: "sandbox", total: mode === "empty" ? 0 : 51, nextOffset: url.searchParams.get("offset") === "0" ? 50 : null, fetchedAt: "2026-09-18T12:00:00Z" };
    await route.fulfill({ status: mode === "error" && url.pathname === "/api/orders" ? 400 : 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(process.env.TEST_APP_URL || "http://localhost:5174");
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "Orders", exact: true }).click();
    await page.getByRole("heading", { name: "Order TEST-ORDER" }).waitFor();
    assert.ok(await page.locator("#ordersResults").innerText().then((text) => text.includes("Army Green") && text.includes("Test Recipient")));
    assert.equal(await page.locator("#ordersResults script").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${process.env.TEMP}/cj-orders-${viewport.width}.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#ordersPrevious").disabled === false);
  mode = "empty";
  await page.getByRole("button", { name: "Refresh orders", exact: true }).click();
  await page.getByText(/No orders in this date range/).waitFor();
  mode = "error";
  await page.getByRole("button", { name: "Refresh orders", exact: true }).click();
  await page.getByText("Reconnect eBay", { exact: true }).waitFor();
  assert.equal(await page.locator(".order-entry").count(), 0);
  assert.deepEqual(errors, []);
  console.log("Orders UI passed desktop/mobile, pagination, empty/error states and HTML escaping.");
} finally { await browser.close(); }
