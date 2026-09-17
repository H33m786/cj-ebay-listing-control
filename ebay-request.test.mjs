import test from "node:test";
import assert from "node:assert/strict";
import { accountRequestUrl, ebayErrorMessage } from "./ebay-request.mjs";

test("opt-in has no marketplace query while policy retrieval retains one", () => {
  const base = "https://api.ebay.com";
  assert.equal(accountRequestUrl("/sell/account/v1/program/opt_in", base, "EBAY_GB", "POST").search, "");
  for (const type of ["payment", "return", "fulfillment"]) {
    assert.equal(accountRequestUrl(`/sell/account/v1/${type}_policy`, base, "EBAY_GB").searchParams.get("marketplace_id"), "EBAY_GB");
  }
  assert.equal(accountRequestUrl("/sell/account/v1/payment_policy?marketplace_id=EBAY_US", base, "EBAY_GB").searchParams.get("marketplace_id"), "EBAY_US");
  assert.equal(accountRequestUrl("/sell/account/v1/payment_policy", base, "EBAY_GB", "POST").search, "");
});

test("errors preserve the actionable eBay code and detailed explanation", () => {
  assert.equal(ebayErrorMessage({ errors: [{ errorId: 20403, message: "Input error", longMessage: "User is not eligible", inputRefIds: [null] }] }, 400), "User is not eligible (eBay 20403)");
  assert.equal(ebayErrorMessage({}, 500), "eBay API failed with 500");
});
