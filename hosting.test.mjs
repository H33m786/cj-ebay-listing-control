import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStorage } from "./storage.mjs";
import { createAccessGuard } from "./access.mjs";

test("local documents survive reopening storage", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cj-storage-"));
  try {
    const storage = await createStorage(directory);
    const file = path.join(directory, "ebay-token.json");
    await storage.writeFile(file, JSON.stringify({ access_token: "test-only" }));
    const reopened = await createStorage(directory);
    assert.equal(JSON.parse(await reopened.readFile(file, "utf8")).access_token, "test-only");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("hosted app refuses missing storage or login configuration", () => {
  assert.throws(() => createAccessGuard({ RENDER: "true" }), /Hosting requires/);
});

test("local network mode can use file storage without Neon", () => {
  assert.doesNotThrow(() => createAccessGuard({ LOCAL_NETWORK: "true", APP_USERNAME: "owner", APP_PASSWORD: "test-password-long" }));
  assert.throws(() => createAccessGuard({ LOCAL_NETWORK: "true", APP_USERNAME: "owner", APP_PASSWORD: "short" }), /Local network access requires/);
});
test("local price-job lock blocks overlap and releases after failure", async () => {
  const storage = await createStorage(tmpdir());
  let release;
  const blocker = new Promise((resolve) => { release = resolve; });
  const first = storage.withJobLock(() => blocker);
  assert.equal(await storage.withJobLock(() => { throw new Error("must not run"); }), false);
  release();
  assert.equal(await first, true);
  await assert.rejects(storage.withJobLock(() => { throw new Error("test failure"); }));
  assert.equal(await storage.withJobLock(async () => {}), true);
});

test("login protects pages, APIs and callbacks but permits public endpoints", () => {
  const guard = createAccessGuard({ APP_USERNAME: "owner", APP_PASSWORD: "test-password-long", APP_URL: "https://example.com" });
  const response = () => ({ status: 200, setHeader() {}, writeHead(status) { this.status = status; }, end() {} });
  for (const pathname of ["/", "/api/drafts", "/api/orders", "/api/repricing", "/api/repricing/run", "/auth/ebay/callback"]) {
    const res = response();
    assert.equal(guard({ headers: {}, method: "GET" }, res, new URL(pathname, "https://example.com")), false);
    assert.equal(res.status, 401);
  }
  for (const pathname of ["/healthz", "/privacy.html", "/api/ebay/marketplace-account-deletion"]) {
    assert.equal(guard({ headers: {}, method: "GET" }, response(), new URL(pathname, "https://example.com")), true);
  }
  const authorization = `Basic ${Buffer.from("owner:test-password-long").toString("base64")}`;
  const url = new URL("https://example.com/api/drafts");
  assert.equal(guard({ headers: { authorization, origin: url.origin }, method: "POST" }, response(), url), true);
  const res = response();
  assert.equal(guard({ headers: { authorization, origin: "https://attacker.example" }, method: "POST" }, res, url), false);
  assert.equal(res.status, 403);
});
