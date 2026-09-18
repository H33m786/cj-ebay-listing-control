import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { createHmac, createHash } from "node:crypto";
import { createAccessGuard } from "./access.mjs";

const env = { APP_USERNAME: "owner", APP_PASSWORD: "test-password-long", APP_URL: "https://example.com" };
const response = () => ({ status: 200, headers: {}, body: "", setHeader(name, value) { this.headers[name.toLowerCase()] = value; }, writeHead(status, headers = {}) { this.status = status; for (const [name, value] of Object.entries(headers)) this.setHeader(name, value); }, end(body = "") { this.body = body; } });
async function login(guard, fields = {}, headers = {}) {
  const req = Readable.from([new URLSearchParams({ username: "owner", password: "test-password-long", next: "/", ...fields }).toString()]);
  req.method = "POST";
  req.headers = { origin: "https://example.com", "content-type": "application/x-www-form-urlencoded", ...headers };
  const res = response();
  assert.equal(await guard.handleSession(req, res, new URL("https://example.com/login")), true);
  return res;
}
test("browser navigation redirects to persistent login without a popup challenge", async () => {
  const guard = createAccessGuard(env);
  const res = response();
  assert.equal(guard({ method: "GET", headers: { accept: "text/html" } }, res, new URL("https://example.com/")), false);
  assert.equal(res.status, 302); assert.equal(res.headers["www-authenticate"], undefined);
  const page = response();
  await guard.handleSession({ method: "GET", headers: {} }, page, new URL("https://example.com/login"));
  assert.equal(page.status, 200); assert.match(page.body, /autocomplete="current-password"/); assert.match(page.headers["content-security-policy"], /form-action 'self'/);
  assert.equal(page.headers["cache-control"], "no-store");
  assert.equal(page.headers["referrer-policy"], "same-origin");
});
test("correct credentials set a signed secure cookie and preserve the local destination", async () => {
  const guard = createAccessGuard(env);
  const res = await login(guard, { next: "/auth/ebay/callback?state=test&code=test-only" });
  assert.equal(res.status, 303); assert.match(res.headers.location, /^\/auth\/ebay\/callback/);
  const cookie = res.headers["set-cookie"];
  assert.match(cookie, /^__Host-cj-session=/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /; Secure/);
  assert.ok(!cookie.includes(env.APP_PASSWORD));
  assert.equal(guard({ method: "GET", headers: { cookie: cookie.split(";")[0] } }, response(), new URL("https://example.com/api/orders")), true);
});
test("bad credentials stay on the login page without disclosing values or setting cookies", async () => {
  const res = await login(createAccessGuard(env), { password: "wrong-secret" });
  assert.equal(res.status, 401); assert.match(res.body, /Username or password is incorrect/);
  assert.equal(res.headers["www-authenticate"], undefined); assert.equal(res.headers["set-cookie"], undefined); assert.ok(!res.body.includes("wrong-secret"));
});
test("open redirects are rejected and hidden values are escaped", async () => {
  for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", "/login", "/logout", "/\r\nlocation:evil"]) {
    const res = await login(createAccessGuard(env), { next }); assert.equal(res.headers.location, "/");
  }
  const res = response();
  await createAccessGuard(env).handleSession({ method: "GET", headers: {} }, res, new URL('https://example.com/login?next=%2F%3Fx%3D%22%3E%3Cscript%3E'));
  assert.ok(!res.body.includes("<script>"));
});
test("cross-site and origin-less login are rejected", async () => {
  for (const headers of [{ origin: "https://evil.example" }, { origin: undefined }, { "sec-fetch-site": "cross-site" }]) assert.equal((await login(createAccessGuard(env), {}, headers)).status, 403);
});
test("tampered, expired and old-password cookies cannot authenticate", async () => {
  const guard = createAccessGuard(env);
  const result = await login(guard);
  const cookie = result.headers["set-cookie"].split(";")[0];
  const check = (value, current = guard) => current({ method: "GET", headers: { cookie: value } }, response(), new URL("https://example.com/api/orders"));
  assert.equal(check(cookie + "tamper"), false);
  assert.equal(check(cookie, createAccessGuard({ ...env, APP_PASSWORD: "rotated-password-long" })), false);
  const payload = Buffer.from(JSON.stringify({ exp: 1 })).toString("base64url");
  const key = createHash("sha256").update(`${env.APP_USERNAME}:${env.APP_PASSWORD}`).digest();
  const sig = createHmac("sha256", key).update(`session:${payload}`).digest("base64url");
  assert.equal(check(`__Host-cj-session=${payload}.${sig}`), false);
});
test("session writes require same origin; scheduler Basic auth still works without browser headers", async () => {
  const guard = createAccessGuard(env);
  const result = await login(guard);
  const cookie = result.headers["set-cookie"].split(";")[0];
  const url = new URL("https://example.com/api/repricing/run");
  assert.equal(guard({ method: "POST", headers: { cookie } }, response(), url), false);
  assert.equal(guard({ method: "POST", headers: { cookie, origin: url.origin } }, response(), url), true);
  const authorization = `Basic ${Buffer.from(`${env.APP_USERNAME}:${env.APP_PASSWORD}`).toString("base64")}`;
  assert.equal(guard({ method: "POST", headers: { authorization } }, response(), url), true);
});
test("logout clears the cookie and cannot be triggered by a cross-site request", async () => {
  const guard = createAccessGuard(env);
  const res = response();
  await guard.handleSession({ method: "POST", headers: { origin: "https://example.com" } }, res, new URL("https://example.com/logout"));
  assert.equal(res.status, 303); assert.match(res.headers["set-cookie"], /Max-Age=0/);
  const blocked = response();
  await guard.handleSession({ method: "POST", headers: { origin: "https://evil.example" } }, blocked, new URL("https://example.com/logout"));
  assert.equal(blocked.status, 403); assert.equal(blocked.headers["set-cookie"], undefined);
});
test("failed login attempts are throttled", async () => {
  const guard = createAccessGuard(env);
  for (let i = 0; i < 5; i++) assert.equal((await login(guard, { password: "wrong" })).status, 401);
  const res = await login(guard); assert.equal(res.status, 429); assert.equal(res.headers["retry-after"], "60");
});
