import test from "node:test";
import assert from "node:assert/strict";
import { createCjRequester } from "./cj-request.mjs";

function fixture(responses) {
  let time = 0;
  const calls = [];
  const sleeps = [];
  const request = createCjRequester({ now: () => time, sleep: async (ms) => { sleeps.push(ms); time += ms; }, fetchImpl: async (url) => {
    calls.push({ url, time });
    const item = responses.shift() || { code: 200 };
    return { status: item.status || 200, ok: !item.status || item.status === 200,
      headers: new Headers(item.headers), json: async () => item };
  } });
  return { request, calls, sleeps };
}
test("CJ search retries 429 and honours Retry-After", async () => {
  const f = fixture([{ status: 429, headers: { "Retry-After": "5" } }, { code: 200, data: { list: [] } }]);
  assert.equal((await f.request("search")).code, 200);
  assert.deepEqual(f.sleeps, [5000]);
  assert.equal(f.calls.length, 2);
});
test("concurrent CJ searches are paced by one queue", async () => {
  const f = fixture([]);
  await Promise.all([f.request("a"), f.request("b"), f.request("c")]);
  assert.deepEqual(f.calls.map((call) => call.time), [0, 1100, 2200]);
});
test("body rate limits back off and stop after bounded attempts", async () => {
  const f = fixture(Array.from({ length: 4 }, () => ({ code: 160000, message: "Too many requests" })));
  await assert.rejects(f.request("search"), /rate-limiting/);
  assert.equal(f.calls.length, 4);
  assert.deepEqual(f.sleeps, [2000, 4000, 8000]);
  await f.request("next");
  assert.equal(f.sleeps.at(-1), 16000);
});
test("long server cooldown blocks queued calls without hitting CJ again", async () => {
  const f = fixture([{ status: 429, headers: { "Retry-After": "120" } }]);
  await assert.rejects(f.request("search"), /cooldown/);
  await assert.rejects(f.request("next"), /retry later/);
  assert.equal(f.calls.length, 1);
});
test("ordinary CJ errors fail without retries and do not poison queue", async () => {
  const f = fixture([{ status: 401, message: "Token expired" }]);
  await assert.rejects(f.request("search"), /Token expired/);
  assert.equal(f.calls.length, 1);
  assert.equal((await f.request("next")).code, 200);
});
test("HTTP date Retry-After is honoured", async () => {
  const f = fixture([{ status: 429, headers: { "Retry-After": new Date(10000).toUTCString() } }]);
  await f.request("search");
  assert.deepEqual(f.sleeps, [10000]);
});
