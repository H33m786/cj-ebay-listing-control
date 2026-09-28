import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("./public/app.js", import.meta.url), "utf8");
const chartSource = source.slice(source.indexOf("function statsLineGraph("), source.indexOf("function renderStats("));
const chart = vm.runInNewContext(`${chartSource}; statsLineGraph`, { escapeHtml: String });

test("zero sales graph never labels its scale as one sale", () => {
  const html = chart([{ label: "28 Sep", views: 2, units: 0 }]);
  assert.match(html, />0 sold<\/text>/);
  assert.doesNotMatch(html, /1 sold/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test("missing traffic is a graph gap, not a zero-view point", () => {
  const html = chart([
    { label: "26 Sep", views: 2, units: 0 },
    { label: "27 Sep", views: null, units: 0 },
    { label: "28 Sep", views: 6, units: 0 }
  ]);
  assert.equal((html.match(/class="dot views"/g) || []).length, 2);
  const path = html.match(/class="line views" d="([^"]*)"/)[1];
  assert.equal((path.match(/M/g) || []).length, 2);
  assert.doesNotMatch(path, /L/);
});
