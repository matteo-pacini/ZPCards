// Tests for the cat stockpile card: its cats and their meals, wet and dry
// stock counted apart, what it renders, and what it writes.
//
// Run with `node --experimental-vm-modules --test test/*.test.js` from the
// repository root.

const test = require("node:test");
const assert = require("node:assert/strict");
const { cards: c, plain, item, hass, make, text } = require("./prepping-cards.harness.js");
const { KINDS, readItems, itemJSON, readCats, catJSON, catNeeds, catDays, fmtGrams } = c;

const CAT = "cat-stockpile-card";
const LIST = "todo.cat_stockpile";

// Example cats: one on both types, one on dry only, one on wet only.
const CATS = [
  { name: "Miso", wet: { meals: 2, g: 85 }, dry: { meals: 1, g: 25 } },
  { name: "Tofu", dry: { meals: 2, g: 30 } },
  { name: "Pepper", wet: { meals: 3, g: 50 } },
];

// 5,782 g wet at 320 g a day, 5,500 g dry at 85 g a day.
const larder = (cats = CATS) => ({
  [LIST]: [
    item("Cat stockpile settings", { target_days: 30, cats }),
    item("Chicken pouches", { type: "wet", grams: 85, count: 36 }),
    item("Indoor kibble", { type: "dry", grams: 2000, count: 2 }),
    item("Tuna tins", { type: "wet", grams: 156, count: 12 }),
    item("Senior kibble", { type: "dry", grams: 1500, count: 1 }),
    item("Salmon trays", { type: "wet", grams: 85, count: 10 }),
    // Another card's item in the same list is left alone.
    item("Crackers", { portion_g: 300, kcal_per_100g: 439, count: 4 }),
  ],
});

const summary = (el) => text(el.part(".summary").innerHTML);
const list = (el) => text(el.part(".list").innerHTML);

test("the cat card reads wet and dry items, and its cats from its settings", () => {
  const { rows, settings } = readItems(KINDS.cat, larder()[LIST]);
  assert.deepEqual(plain(rows.map((r) => [r.name, r.type, r.grams])), [
    ["Chicken pouches", "wet", 85],
    ["Indoor kibble", "dry", 2000],
    ["Tuna tins", "wet", 156],
    ["Senior kibble", "dry", 1500],
    ["Salmon trays", "wet", 85],
  ]);
  assert.equal(settings.target_days, 30);
  assert.deepEqual(plain(settings.cats), [
    { name: "Miso", wet: { meals: 2, g: 85 }, dry: { meals: 1, g: 25 } },
    { name: "Tofu", wet: null, dry: { meals: 2, g: 30 } },
    { name: "Pepper", wet: { meals: 3, g: 50 }, dry: null },
  ]);
});

test("food and water cards don't read cat food, nor the cat card theirs", () => {
  assert.equal(readItems(KINDS.food, larder()[LIST]).rows.length, 1);
  assert.equal(readItems(KINDS.water, larder()[LIST]).rows.length, 0);
});

test("an unknown food type reads as wet", () => {
  const { rows } = readItems(KINDS.cat, [item("Mystery", { type: "raw", grams: 100, count: 1 })]);
  assert.equal(rows[0].type, "wet");
});

test("cats without a name or any meal are skipped, and meals are whole", () => {
  const cats = readCats([
    { name: " Miso ", wet: { meals: 2.7, g: 85 } },
    { name: "", dry: { meals: 1, g: 30 } },
    { name: "Ghost" },
    { name: "Nibbles", wet: { meals: 0, g: 85 }, dry: { meals: 1, g: 0 } },
    "Tofu",
    null,
  ]);
  assert.deepEqual(plain(cats), [{ name: "Miso", wet: { meals: 2, g: 85 }, dry: null }]);
  assert.deepEqual(plain(readCats(undefined)), []);
});

test("a cat is stored with only the types it eats", () => {
  assert.deepEqual(plain(catJSON({ name: "Tofu", wet: null, dry: { meals: 2, g: 30 } })), { name: "Tofu", dry: { meals: 2, g: 30 } });
});

test("cat food items store their type and grams with their batches", () => {
  const row = { type: "dry", grams: 2000, batches: [{ n: 1, exp: "2027-06", count: 2 }] };
  assert.equal(itemJSON(KINDS.cat, row), '{"type":"dry","grams":2000,"count":2,"batches":[{"n":1,"exp":"2027-06","count":2}]}');
});

test("the cats' daily needs add up per type", () => {
  assert.deepEqual(plain(catNeeds(readCats(CATS))), {
    wet: { perDay: 320, meals: 5, names: ["Miso", "Pepper"] },
    dry: { perDay: 85, meals: 3, names: ["Miso", "Tofu"] },
  });
});

test("the stock lasts until the first type eaten runs out", () => {
  const need = catNeeds(readCats(CATS));
  assert.deepEqual(plain(catDays(need, { wet: 3200, dry: 85 })), { eaten: ["wet", "dry"], days: { wet: 10, dry: 1 }, first: "dry", overall: 1 });
  assert.equal(catDays(need, { wet: 3200, dry: 8500 }).first, "wet");
});

test("a type no cat eats never limits the days", () => {
  const need = catNeeds(readCats([{ name: "Tofu", dry: { meals: 2, g: 30 } }]));
  assert.deepEqual(plain(catDays(need, { wet: 0, dry: 600 })), { eaten: ["dry"], days: { dry: 10 }, first: "dry", overall: 10 });
  assert.deepEqual(plain(catDays(catNeeds([]), { wet: 100, dry: 100 })), { eaten: [], days: {}, first: null, overall: 0 });
});

test("grams show as kilos from 1 kg", () => {
  assert.equal(fmtGrams(850, "en-GB"), "850 g");
  assert.equal(fmtGrams(5782, "en-GB"), "5.8 kg");
  assert.equal(fmtGrams(5782, "de"), "5,8 kg");
});

test("the summary shows the days to the first type running out, each type, and the cats", () => {
  const el = make(CAT, { entity: LIST }, hass(larder()));
  assert.equal(
    summary(el),
    "Cats 18 of 30 days Wet · 18 d · 5.8 kg / 9.6 kg · runs out first Dry · 64 d · 5.5 kg / 2.6 kg 3 cats · 8 meals a day − 30 + Wet Dry"
  );
  assert.match(el.part(".summary").innerHTML, /class="days low"/);
  assert.match(el.part(".summary").innerHTML, /class="amount first"/);
});

test("the cats show their diet and meals", () => {
  const el = make(CAT, { entity: LIST }, hass(larder()));
  assert.equal(el.part(".catsum").textContent, "Wet 320 g · Dry 85 g a day");
  assert.equal(
    text(el.part(".catlist").innerHTML),
    "Miso Wet & dry Wet 2 × 85 g · Dry 1 × 25 g Tofu Dry Dry 2 × 30 g Pepper Wet Wet 3 × 50 g"
  );
});

test("rows are grouped by type, with who eats it and the meals each holds", () => {
  const el = make(CAT, { entity: LIST }, hass(larder()));
  // Wet meals average 64 g (320 g over 5 meals), dry ones 28.3 g.
  assert.equal(
    list(el),
    "Wet food 320 g a day · Miso, Pepper " +
      "Chicken pouches 3.1 kg · 9.5 d 85 g each · 47 meals 36 B1 36 · no date + B2 " +
      "Tuna tins 1.9 kg · 5.8 d 156 g each · 29 meals 12 B1 12 · no date + B2 " +
      "Salmon trays 850 g · 2.6 d 85 g each · 13 meals 10 B1 10 · no date + B2 " +
      "Dry food 85 g a day · Miso, Tofu " +
      "Indoor kibble 4 kg · 47 d 2 kg each · 141 meals 2 B1 2 · no date + B2 " +
      "Senior kibble 1.5 kg · 17 d 1.5 kg each · 52 meals 1 B1 1 · no date + B2"
  );
});

test("a type no cat eats keeps its rows, without days", () => {
  const el = make(CAT, { entity: LIST }, hass(larder([{ name: "Tofu", dry: { meals: 2, g: 30 } }])));
  assert.match(summary(el), /^Cats 91 of 30 days Dry · 91 d · 5\.5 kg \/ 1\.8 kg 1 cat · 2 meals a day /);
  assert.doesNotMatch(summary(el), /runs out first|Wet/);
  assert.match(list(el), /^Wet food No cat eats this Chicken pouches 3\.1 kg 85 g each 36 /);
});

test("with no cats the card asks for one and still lists the stock", () => {
  const el = make(CAT, { entity: LIST }, hass(larder([])));
  assert.equal(summary(el), "Cats Add a cat to count days. − 30 +");
  assert.equal(el.part(".catlist").innerHTML, "");
  assert.match(list(el), /^Wet food No cat eats this Chicken pouches/);
});

test("an empty list says so", () => {
  const el = make(CAT, { entity: LIST }, hass({ [LIST]: [] }));
  assert.equal(list(el), "No cat food yet. Add some below.");
});

test("the cat card speaks the household's language", () => {
  const el = make(CAT, { entity: LIST }, hass(larder(), { language: "it" }));
  assert.match(summary(el), /^Gatti 18 su 30 giorni Umido · 18 gg · 5,8 kg \/ 9,6 kg · finisce prima Secco · /);
  assert.match(summary(el), /3 gatti · 8 pasti al giorno/);
  assert.match(list(el), /^Cibo umido 320 g al giorno · Miso, Pepper /);
});

test("the visual editor has no household fields on the cat card", () => {
  const form = c.editorForm(KINDS.cat);
  assert.deepEqual(plain(form.schema.map((f) => f.name)), ["entity", "title", "locale"]);
});

// The card writes after WRITE_DELAY_MS, so these wait for it.
const settle = () => new Promise((r) => setTimeout(r, 700));

const recording = (lists) => {
  const h = hass(lists);
  h.calls = [];
  h.callService = async (domain, service, data) => h.calls.push([service, data]);
  return h;
};

test("changing the target keeps the cats", async () => {
  const h = recording(larder());
  const el = make(CAT, { entity: LIST }, h);
  el._setTarget(31);
  await settle();
  assert.equal(h.calls.length, 1);
  const [service, data] = h.calls[0];
  assert.equal(service, "update_item");
  assert.deepEqual(JSON.parse(data.description), { target_days: 31, cats: CATS });
});

test("changing the cats keeps the target, and a quick target change after it", async () => {
  const h = recording(larder());
  const el = make(CAT, { entity: LIST }, h);
  el._setSettings({ cats: [CATS[1]] });
  el._setTarget(45);
  await settle();
  assert.equal(h.calls.length, 1);
  assert.deepEqual(JSON.parse(h.calls[0][1].description), { target_days: 45, cats: [CATS[1]] });
});

test("the first cat on a new list adds the settings item, with the default target", async () => {
  const h = recording({ [LIST]: [] });
  const el = make(CAT, { entity: LIST }, h);
  el._setSettings({ cats: [CATS[0]] });
  await settle();
  assert.deepEqual(h.calls[0][0], "add_item");
  assert.equal(h.calls[0][1].item, "Cat stockpile settings");
  assert.deepEqual(JSON.parse(h.calls[0][1].description), { target_days: 30, cats: [CATS[0]] });
});

test("the food card's target write is unchanged", async () => {
  const h = recording({ "todo.food_stockpile": [item("Food stockpile settings", { target_days: 30 })] });
  const el = make("food-stockpile-card", { entity: "todo.food_stockpile" }, h);
  el._setTarget(29);
  await settle();
  assert.equal(h.calls[0][1].description, '{"target_days":29}');
});
