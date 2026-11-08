// Tests for the meds streak card's languages: the STRINGS table, which
// language a locale gets, and plural forms.
//
// Run with `node --experimental-vm-modules --test test/*.test.js` from the
// repository root.

const test = require("node:test");
const assert = require("node:assert/strict");
const { meds: m } = require("./meds-streak-card.harness.js");
const { cards: prepping } = require("./prepping-cards.harness.js");
const { STRINGS, translate, plural } = m;

const LANGUAGES = Object.keys(prepping.STRINGS);
const placeholders = (v) =>
  [...new Set((typeof v === "string" ? [v] : Object.values(v)).join(" ").match(/\{\w+\}/g) || [])].sort();

test("the card speaks the same languages as the other cards", () => {
  assert.deepEqual(Object.keys(STRINGS).sort(), [...LANGUAGES].sort());
});

for (const lang of LANGUAGES) {
  test(`${lang} has only keys that English has, with the same placeholders`, () => {
    for (const [k, v] of Object.entries(STRINGS[lang])) {
      assert.ok(k in STRINGS.en, `${lang} has stray key '${k}'`);
      // A form may spell its number out and leave {n} out, as "of the last day" does.
      const en = placeholders(STRINGS.en[k]);
      assert.deepEqual(placeholders(v).filter((p) => p !== "{n}"), en.filter((p) => p !== "{n}"), `${lang}.${k}`);
      for (const p of placeholders(v)) assert.ok(en.includes(p), `${lang}.${k} ${p}`);
    }
  });

  test(`${lang} plural mappings have an 'other' form and only CLDR categories`, () => {
    for (const [k, v] of Object.entries(STRINGS[lang])) {
      if (typeof v === "string") continue;
      assert.ok("other" in v, `${lang}.${k}`);
      for (const cat of Object.keys(v)) assert.ok(["zero", "one", "two", "few", "many", "other"].includes(cat), `${lang}.${k}.${cat}`);
    }
  });
}

test("every full language translates every key", () => {
  for (const lang of LANGUAGES.filter((l) => !l.includes("-") || l === "zh-Hans")) {
    assert.deepEqual(Object.keys(STRINGS.en).filter((k) => !(k in STRINGS[lang])), [], lang);
  }
});

test("a locale picks its region, then its script, then its language, then English", () => {
  assert.equal(translate("pt-BR").state_missed, "esquecido");
  assert.equal(translate("pt-PT").state_missed, "falhado");
  assert.equal(translate("pt-BR").taken_today, "Tomado hoje");
  assert.equal(translate("de-AT").taken_today, "Heute genommen");
  assert.equal(translate("zh-CN").taken_today, "今天已服用");
  assert.equal(translate("zh-TW").taken_today, "Taken today");
  assert.equal(translate("ko-KR").taken_today, "Taken today");
});

test("overrides win over every language", () => {
  assert.equal(translate("it", { not_yet: "Da prendere" }).not_yet, "Da prendere");
  assert.equal(translate("it", { not_yet: "Da prendere" }).taken_today, "Preso oggi");
});

test("streak and window labels change with the number", () => {
  assert.equal(plural(STRINGS.en.of_last, 30, "en"), "of the last 30 days");
  assert.equal(plural(STRINGS.en.of_last, 1, "en"), "of the last day");
  assert.equal(plural(STRINGS.de.streak, 1, "de"), "Tag in Folge");
  assert.equal(plural(STRINGS.de.streak, 0, "de"), "Tage in Folge");
  assert.equal(plural(STRINGS.fr.streak, 0, "fr"), "jour d’affilée");
  assert.equal(plural(STRINGS.pl.streak, 1, "pl"), "dzień z rzędu");
  assert.equal(plural(STRINGS.pl.streak, 3, "pl"), "dni z rzędu");
  assert.equal(plural(STRINGS.pl.streak, 5, "pl"), "dni z rzędu");
  assert.equal(plural(STRINGS.pl.of_last, 30, "pl"), "z ostatnich 30 dni");
  assert.equal(plural(STRINGS["zh-Hans"].of_last, 30, "zh-CN"), "/ 近 30 天");
});
