import test from "node:test";
import assert from "node:assert/strict";
import { requestEbayJson } from "./ebay-request.mjs";
const url = "https://api.ebay.com/sell/inventory/v1/inventory_item/BLACKXL";
const init = { method: "PUT", body: '{"product":{"title":"Test"}}' };
const failure = (id = 25001, status = 500) => new Response(JSON.stringify({ errors: [{ errorId: id, message: "System error" }] }), { status });
test("unreadable success cannot be treated as a confirmed publish", async () => {
  await assert.rejects(requestEbayJson("https://api.ebay.com/sell/inventory/v1/offer/123/publish", { method: "POST" }, {
    fetchImpl: async () => new Response("<html>Unexpected page</html>", { status: 200 })
  }), /could not be confirmed/);
});
test("inventory persistence failure retries the exact SKU and payload and recovers", async () => {
  const calls = []; const pauses = [];
  const result = await requestEbayJson(url, init, {
    fetchImpl: async (target, options) => { calls.push({ target, options }); return calls.length < 3 ? failure() : new Response(null, { status: 204 }); },
    sleep: async (ms) => pauses.push(ms)
  });
  assert.equal(result.response.status, 204);
  assert.deepEqual(pauses, [1500, 3000]);
  assert.ok(calls.every((call) => call.target === url && call.options.body === init.body));
  assert.notEqual(calls[0].options.signal, calls[1].options.signal);
});
test("persistent inventory failure stops after three attempts", async () => {
  let calls = 0;
  await assert.rejects(requestEbayJson(url, init, { fetchImpl: async () => { calls++; return failure(); }, sleep: async () => {} }), /after 3 attempts/);
  assert.equal(calls, 3);
});
test("validation errors, offer creation and publishing are never retried", async () => {
  for (const [target, options, id, status] of [[url, init, 25129, 400], [url, init, 25129, 500], ["https://api.ebay.com/sell/inventory/v1/offer", { method: "POST" }, 25001, 500], ["https://api.ebay.com/sell/inventory/v1/offer/123/publish", { method: "POST" }, 25001, 500]]) {
    let calls = 0;
    await assert.rejects(requestEbayJson(target, options, { fetchImpl: async () => { calls++; return failure(id, status); }, sleep: async () => assert.fail("Unexpected retry") }));
    assert.equal(calls, 1);
  }
});
test("temporary gateway HTML and network failures can recover on inventory PUT", async () => {
  let calls = 0;
  await requestEbayJson(url, init, { fetchImpl: async () => {
    calls++;
    if (calls === 1) throw new TypeError("fetch failed");
    if (calls === 2) return new Response("<html>Unavailable</html>", { status: 503 });
    return new Response("{}", { status: 200 });
  }, sleep: async () => {} });
  assert.equal(calls, 3);
});
