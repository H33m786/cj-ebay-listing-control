import test from "node:test";
import assert from "node:assert/strict";
import { previewResearchCsv, normalizeResearchIdea, mergeResearchIdeas, researchMedian } from "./research-import.mjs";

test("research CSV supports BOM, quoted commas and multiline titles", () => {
  const result = previewResearchCsv('\ufeffTitle,Price\r\n"Lamp, adjustable\nUSB",12.50\r\n');
  assert.deepEqual(result.headers, ["Title", "Price"]);
  assert.equal(result.rows[0][0], "Lamp, adjustable\nUSB");
  assert.throws(() => previewResearchCsv("Title,Price\na,b,c"));
  assert.throws(() => previewResearchCsv("Title\n"));
});
test("missing evidence remains unknown while zero sales is preserved", () => {
  const idea = normalizeResearchIdea({ title: "Lamp" });
  assert.equal(idea.price, null);
  assert.equal(idea.sales, null);
  assert.equal(idea.days, null);
  assert.equal(normalizeResearchIdea({ title: "Lamp", sales: "0", days: "30" }).sales, 0);
  assert.throws(() => normalizeResearchIdea({ title: "Lamp", sales: "5" }), /period/);
});
test("rejects unsafe URLs, other currencies and malformed numeric values", () => {
  for (const url of ["javascript:alert(1)", "https://ebay.co.uk.evil.test/x", "https://user:secret@ebay.co.uk/x"]) {
    assert.throws(() => normalizeResearchIdea({ title: "Lamp", url }));
  }
  for (const price of ["$12.50", "12,50", "-1", "Infinity"]) assert.throws(() => normalizeResearchIdea({ title: "Lamp", price }));
  assert.equal(normalizeResearchIdea({ title: "Lamp", price: "\u00a31,234.50" }).price, 1234.5);
});
test("duplicate imports retain saved research without duplication", () => {
  const first = normalizeResearchIdea({ title: "Lamp" });
  const result = mergeResearchIdeas([first], [normalizeResearchIdea({ title: "lamp" }), normalizeResearchIdea({ title: "Bag" })]);
  assert.equal(result.added, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.ideas[1].id, first.id);
});
test("market median uses delivered GBP prices and excludes unknown delivery and foreign prices", () => {
  const item = { price: 10, shippingCost: 2, currency: "GBP", shippingCurrency: "GBP" };
  assert.equal(researchMedian([item, { ...item, price: 20 }, { ...item, price: 1, currency: "USD" }, { ...item, shippingCost: null }]), 17);
  assert.equal(researchMedian([{ ...item, shippingCost: null }]), null);
});
