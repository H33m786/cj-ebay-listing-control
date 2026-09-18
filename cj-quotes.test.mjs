import test from "node:test";
import assert from "node:assert/strict";
test("empty supplier freight values are not treated as free shipping", () => {
  for (const value of ["", " ", -1, "invalid"]) assert.deepEqual(normalizeQuotes([{ logisticName: "CJPacket", logisticPrice: value }]), []);
  assert.deepEqual(normalizeQuotes([{ logisticName: "CJPacket", logisticPrice: 5, totalPostageFee: "" }]), []);
});
import { normalizeQuotes } from "./cj-quotes.mjs";

test("CJ freight uses total postage when supplied without double counting fees", () => {
  assert.equal(normalizeQuotes([{ logisticName: "Luwei", logisticPrice: 10, taxesFee: 1, clearanceOperationFee: 0.25, totalPostageFee: 11.25 }])[0].price, 11.25);
});
test("CJ freight sums returned charges when no total is supplied", () => {
  assert.equal(normalizeQuotes([{ logisticName: "Luwei", logisticPrice: 10, taxesFee: 1, clearanceOperationFee: 0.25 }])[0].price, 11.25);
});
test("malformed or unavailable freight cannot become free shipping", () => {
  assert.deepEqual(normalizeQuotes([{ logisticName: "Missing" }, { logisticName: "Invalid", logisticPrice: "unknown" }]), []);
  assert.deepEqual(normalizeQuotes(null), []);
});
