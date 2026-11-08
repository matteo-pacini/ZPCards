// Checks zp-cards.js, the file HACS installs: it matches src/, and it defines
// every card when loaded as Home Assistant loads it, as strict module code.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const bundlePath = path.join(__dirname, "..", "zp-cards.js");

test("zp-cards.js is built from the current src/", () => {
  const { build } = require("../scripts/build.js");
  assert.equal(fs.readFileSync(bundlePath, "utf8"), build(), "run node scripts/build.js");
});

test("zp-cards.js defines every card and its editor", async () => {
  const defined = [];
  const ctx = vm.createContext({
    HTMLElement: class {},
    customElements: { define: (name) => defined.push(name), whenDefined: async () => {} },
    window: {},
  });
  const mod = new vm.SourceTextModule(fs.readFileSync(bundlePath, "utf8"), { context: ctx });
  await mod.link(() => {});
  await mod.evaluate();
  assert.deepEqual(defined.sort(), [
    "budget-sankey-card",
    "budget-sankey-card-editor",
    "cat-stockpile-card",
    "food-stockpile-card",
    "meds-streak-card",
    "water-stockpile-card",
  ]);
  assert.deepEqual(
    Array.from(ctx.window.customCards, (c) => c.type).sort(),
    ["budget-sankey-card", "cat-stockpile-card", "food-stockpile-card", "meds-streak-card", "water-stockpile-card"],
  );
});
