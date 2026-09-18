import test from "node:test";
import assert from "node:assert/strict";
import { linkedEbayProfile, identityScope, refreshScopes } from "./ebay-profile.mjs";

const token = async () => ({ environment: "production", access_token: "test-only" });

test("returns only the authenticated username, not private profile details", async () => {
  const result = await linkedEbayProfile("production", token, async (url, options) => {
    assert.equal(url, "https://apiz.ebay.com/commerce/identity/v1/user/");
    assert.equal(options.headers.authorization, "Bearer test-only");
    return Response.json({ username: "seller-example", email: "private@example.test", userId: "private-id" });
  });
  assert.deepEqual(result, { username: "seller-example", message: "" });
});

test("sandbox mock profiles must not be shown as the connected seller", async () => {
  const result = await linkedEbayProfile("sandbox", () => { throw new Error("Must not call"); });
  assert.equal(result.username, null);
  assert.match(result.message, /Sandbox/);
});

test("rejects a token for the wrong environment without sending it", async () => {
  const result = await linkedEbayProfile("production", async () => ({ environment: "sandbox" }), () => { throw new Error("Must not call"); });
  assert.match(result.message, /Reconnect/);
});

test("missing consent clearly asks for reconnection", async () => {
  for (const status of [401, 403]) {
    const result = await linkedEbayProfile("production", token, async () => new Response("", { status }));
    assert.equal(result.username, null);
    assert.match(result.message, /Reconnect/);
  }
});

test("missing name and upstream failure never fabricate a username or expose secrets", async () => {
  for (const request of [
    async () => Response.json({ userId: "private-id" }),
    async () => new Response("private error", { status: 500 }),
    async () => { throw new Error("secret-token"); },
    async () => new Response("invalid json")
  ]) {
    const result = await linkedEbayProfile("production", token, request);
    assert.equal(result.username, null);
    assert.doesNotMatch(JSON.stringify(result), /secret-token|private-id|private error/);
  }
});

test("refresh retains existing permission set without adding identity access", () => {
  const base = "https://api.ebay.com/oauth/api_scope";
  assert.equal(refreshScopes({}, [identityScope, base]), base);
  assert.equal(refreshScopes({ scope: base }, [identityScope, base]), base);
  assert.equal(refreshScopes({ scope: identityScope }, [identityScope, base]), identityScope);
});
