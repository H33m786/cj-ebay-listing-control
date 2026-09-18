import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(`${process.env.CODEX_NODE_MODULES}/package.json`);
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true, channel: "msedge" });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let settings = { enabled: false, autoApply: false, maxChangePercent: 20, rules: {} };
  let failed = false;
  let runs = 0;
  const listing = { id: "test", title: "Outdoor jacket <script>test</script>", sku: "CJ-TEST-M", salePrice: 30, targetMarginPercent: 25, usdToGbp: 0.75, cjShippingService: "CJPacket", history: [{ at: "2026-09-18T10:00:00Z", sku: "CJ-TEST-M", oldPrice: 30, price: 31.2, status: "preview" }] };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body = path === "/api/drafts" ? { drafts: [], published: [] } : path === "/api/products" ? { products: [] } : {};
    if (path === "/api/repricing") {
      if (route.request().method() === "PUT") settings = route.request().postDataJSON();
      body = failed ? { error: "Connection unavailable" } : { settings, environment: "sandbox", running: false, listings: [listing] };
    }
    if (path === "/api/repricing/run") { assert.equal(route.request().postDataJSON().preview, true); runs++; body = { started: true }; }
    await route.fulfill({ status: failed && path === "/api/repricing" ? 400 : 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(process.env.TEST_APP_URL || "http://localhost:5175");
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.getByRole("button", { name: "Price tracking", exact: true }).click();
    await page.getByRole("heading", { name: "Tracked listings" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Update prices now" }).isDisabled(), true);
    assert.equal(await page.locator("#repricingView script").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${process.env.TEMP}/cj-repricing-${viewport.width}.png`, fullPage: true });
  }
  await page.locator('[name="tracked"]').check();
  await page.locator('[name="daily"]').check();
  await page.getByRole("button", { name: "Check prices (preview)" }).click();
  await page.waitForResponse((response) => response.url().includes("/api/repricing") && response.request().method() === "GET");
  assert.equal(runs, 1);
  assert.equal(settings.rules.test.enabled, true);
  assert.equal(settings.autoApply, false);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator('[name="apply"]').check();
  await page.getByRole("button", { name: "Save settings" }).click();
  assert.equal(settings.autoApply, false);
  failed = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByText("Connection unavailable", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log("Price tracking UI passed desktop/mobile, preview, opt-in rejection and failure state checks.");
} finally { await browser.close(); }
