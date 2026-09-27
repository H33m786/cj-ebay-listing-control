import test from "node:test";
import assert from "node:assert/strict";
import { fetchUsdToGbpRate, parseUsdToGbpRate } from "./exchange-rate.mjs";

test("parseUsdToGbpRate returns the GBP amount for one USD", () => {
  assert.deepEqual(parseUsdToGbpRate({ date: "2026-09-27", rates: { GBP: 0.748321 } }), {
    base: "USD",
    quote: "GBP",
    rate: 0.748321,
    date: "2026-09-27",
    source: "Frankfurter"
  });
});

test("parseUsdToGbpRate supports Frankfurter v2 rate rows", () => {
  assert.equal(parseUsdToGbpRate([{ date: "2026-09-27", base: "USD", quote: "GBP", rate: 0.75449 }]).rate, 0.75449);
});

test("parseUsdToGbpRate rejects missing or impossible rates", () => {
  for (const body of [{}, { rates: { GBP: 0 } }, { rates: { GBP: -1 } }, { rates: { GBP: 99 } }]) {
    assert.throws(() => parseUsdToGbpRate(body), /unavailable/);
  }
});

test("fetchUsdToGbpRate calls the no-key exchange-rate API", async () => {
  const result = await fetchUsdToGbpRate(async (url, options) => {
    assert.match(url, /api\.frankfurter\.dev/);
    assert.equal(options.headers.accept, "application/json");
    return { ok: true, json: async () => ({ date: "2026-09-27", rates: { GBP: 0.75 } }) };
  });
  assert.equal(result.rate, 0.75);
});
