import test from "node:test";
import assert from "node:assert/strict";
import { riskyTermsForDraft, saferRiskWording } from "./public/risk-terms.js";

test("risky term review finds Apple and proposes safer wording", () => {
  const draft = {
    title: "Apple iPhone magnetic charging case",
    description: "Protective case for Apple iPhone with slim shockproof edge."
  };
  const suggestion = saferRiskWording(draft);
  assert.deepEqual(riskyTermsForDraft(draft), ["apple"]);
  assert.equal(suggestion.hasRisk, true);
  assert.equal(suggestion.changed, true);
  assert.doesNotMatch(suggestion.title, /\bapple\b/i);
  assert.doesNotMatch(suggestion.description, /\bapple\b/i);
  assert.match(suggestion.title, /smartphone/i);
});

test("risky term review leaves ordinary wording alone", () => {
  const draft = {
    title: "Magnetic USB C charging cable",
    description: "Braided charging cable for compatible smartphones and tablets."
  };
  const suggestion = saferRiskWording(draft);
  assert.deepEqual(riskyTermsForDraft(draft), []);
  assert.equal(suggestion.hasRisk, false);
  assert.equal(suggestion.changed, false);
});

test("risky term review does not match Apple inside another word", () => {
  const draft = {
    title: "Pineapple fruit slicer kitchen tool",
    description: "Stainless corer for preparing pineapple rings at home."
  };
  assert.deepEqual(riskyTermsForDraft(draft), []);
  assert.equal(saferRiskWording(draft).changed, false);
});
