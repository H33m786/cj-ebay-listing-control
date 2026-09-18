import http from "node:http";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { createAccessGuard } from "../access.mjs";

const require = createRequire(`${process.env.CODEX_NODE_MODULES}/package.json`);
const { chromium } = require("playwright");
let guard;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (await guard.handleSession(req, res, url)) return;
  if (!guard(req, res, url)) return;
  res.writeHead(200, { "content-type": "text/html" });
  res.end('<h1>Signed in</h1><form method="post" action="/logout"><button>Sign out</button></form>');
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
guard = createAccessGuard({ APP_USERNAME: "test-owner", APP_PASSWORD: "test-only-password", APP_URL: base });
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "msedge" });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  assert.ok(page.url().includes("/login"));
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.getByLabel("Username", { exact: true }).fill("test-owner");
    await page.getByLabel("Password", { exact: true }).fill("wrong");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByLabel("Password", { exact: true }).inputValue(), "");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `${process.env.TEMP}/cj-login-${viewport.width}.png`, fullPage: true });
  }
  await page.getByLabel("Username", { exact: true }).fill("test-owner");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Signed in" }).waitFor();
  assert.equal((await page.context().request.get(`${base}/api/orders`)).status(), 200);
  await page.reload();
  await page.getByRole("heading", { name: "Signed in" }).waitFor();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Sign in", exact: true }).waitFor();
  assert.equal((await page.context().request.get(`${base}/api/orders`)).status(), 401);
  assert.deepEqual(errors, []);
  console.log("Login UI passed desktop/mobile, wrong password, successful sign-in, reload and sign-out with synthetic credentials.");
} finally { await browser?.close(); await new Promise((resolve) => server.close(resolve)); }
