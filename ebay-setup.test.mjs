import test from "node:test";
import assert from "node:assert/strict";
import { publishingSetup } from "./ebay-setup.mjs";

const connected = { connected: true, environment: "production" };
const env = { EBAY_MERCHANT_LOCATION_KEY: "location", EBAY_PAYMENT_POLICY_ID: "payment", EBAY_RETURN_POLICY_ID: "return", EBAY_FULFILLMENT_POLICY_ID: "postage" };
test("connected OAuth is not reported as missing when publishing selections are absent", () => {
  const result = publishingSetup({}, connected, "production");
  assert.equal(result.connectionReady, true);
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, ["Merchant location", "Payment policy", "Return policy", "Fulfilment policy"]);
});
test("complete selections are ready, without enabling publishing", () => {
  assert.equal(publishingSetup(env, connected, "production").ready, true);
});
test("only missing or blank selections are identified", () => {
  assert.deepEqual(publishingSetup({ ...env, EBAY_RETURN_POLICY_ID: " " }, connected, "production").missing, ["Return policy"]);
});
test("wrong-environment and disconnected accounts cannot be ready", () => {
  assert.equal(publishingSetup(env, connected, "sandbox").ready, false);
  assert.equal(publishingSetup(env, { connected: false }, "production").ready, false);
});
