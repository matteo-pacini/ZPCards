// Tests for meds-streak-card.js: which days count as taken, day keys across
// time zones, the streak, the statistics request, config checks and the
// rendered card.
//
// Run with `node --experimental-vm-modules --test test/*.test.js` from the
// repository root.

const test = require("node:test");
const assert = require("node:assert/strict");
const { ctx, timers, ENTITY, row, meds: m, plain, setNow, hass, make, text, cells } = require("./meds-streak-card.harness.js");
const { addDays, weekday, dayKey, gridStart, firstDay, takenDays, takenOn, tally, checkConfig, STREAK_DAYS } = m;

// The keys of `n` days ending at `last`, oldest first.
const run = (last, n) => Array.from({ length: n }, (_, i) => addDays(last, i - n + 1));

test.beforeEach(() => setNow("2026-11-08T12:00:00Z"));

// The sensor is 1 from the dose to midnight. The recorder's 00:00 hour still
// holds the 1 it had at the very start of the next day, so that day's max is
// 1 while its mean is a few seconds out of 86,400.
test("a day counts by its mean, so the day after a dose is not taken", () => {
  const rows = [
    { ...row("2026-11-05", 1 / 24), max: 1 }, // dose at 23:00
    { ...row("2026-11-06", 2 / 86400), max: 1 }, // only the midnight leftover
    { ...row("2026-11-07", 0.5), max: 1 }, // dose at noon
  ];
  assert.deepEqual(plain([...takenDays(rows, "UTC")]), ["2026-11-05", "2026-11-07"]);
});

test("a dose logged after about 23:58 is under the threshold", () => {
  assert.equal(takenDays([row("2026-11-05", 1 / 1440)], "UTC").size, 0); // 23:59
  assert.equal(takenDays([row("2026-11-05", 3 / 1440)], "UTC").size, 1); // 23:57
});

test("day keys are local to Home Assistant's time zone", () => {
  // 23:00 UTC on 31 October is midnight on 1 November in Rome (CET, UTC+1).
  const t = Date.UTC(2026, 9, 31, 23, 0);
  assert.equal(dayKey(t, "Europe/Rome"), "2026-11-01");
  assert.equal(dayKey(t, "UTC"), "2026-10-31");
  assert.equal(dayKey(t - 1, "Europe/Rome"), "2026-10-31");
});

test("statistics rows key to their local day across a DST change", () => {
  // New York leaves daylight time on 1 November 2026, so local midnights are
  // 04:00 UTC before it and 05:00 UTC after.
  const tz = "America/New_York";
  const rows = ["2026-10-31", "2026-11-01", "2026-11-02"].map((k) => row(k, 0.5, tz));
  assert.deepEqual(rows.map((r) => new Date(r.start).toISOString().slice(11, 13)), ["04", "04", "05"]);
  assert.deepEqual(plain([...takenDays(rows, tz)]), ["2026-10-31", "2026-11-01", "2026-11-02"]);
});

test("rows with an ISO start key the same as rows with ms", () => {
  const r = row("2026-11-01", 0.5, "Europe/Rome");
  assert.deepEqual(plain([...takenDays([{ ...r, start: new Date(r.start).toISOString() }], "Europe/Rome")]), ["2026-11-01"]);
});

test("day arithmetic crosses months, years and DST changes", () => {
  assert.equal(addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(addDays("2026-03-29", 1), "2026-03-30");
  assert.equal(addDays("2027-01-01", -1), "2026-12-31");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(weekday("2026-11-09"), 0); // a Monday
  assert.equal(weekday("2026-11-08"), 6); // a Sunday
});

test("the grid starts on the Monday on or before the window's first day", () => {
  // 30 days ending Sunday 8 November start on Saturday 10 October.
  assert.equal(gridStart("2026-11-08", 30), "2026-10-05");
  assert.equal(gridStart("2026-11-15", 7), "2026-11-09");
  assert.equal(firstDay("2026-11-08", 30), addDays("2026-11-08", -STREAK_DAYS));
  assert.equal(firstDay("2026-11-08", 400), gridStart("2026-11-08", 400));
});

test("the streak runs back from today while today is taken", () => {
  const taken = new Set(run("2026-11-07", 4));
  assert.equal(tally("2026-11-08", 30, takenOn("2026-11-08", true, taken)).streak, 5);
});

test("the streak runs back from yesterday while today is not logged yet", () => {
  const taken = new Set(run("2026-11-07", 4));
  assert.equal(tally("2026-11-08", 30, takenOn("2026-11-08", false, taken)).streak, 4);
});

test("a whole day missed breaks the streak", () => {
  const taken = new Set([...run("2026-11-05", 6), "2026-11-07"]);
  assert.equal(tally("2026-11-08", 30, takenOn("2026-11-08", true, taken)).streak, 2);
  assert.equal(tally("2026-11-08", 30, takenOn("2026-11-08", false, new Set(run("2026-11-06", 9)))).streak, 0);
});

test("today comes from the live state, not from statistics", () => {
  // A row for today (a partial day the recorder already has) is ignored.
  const has = takenOn("2026-11-08", false, new Set(["2026-11-08"]));
  assert.equal(has("2026-11-08"), false);
  assert.equal(takenOn("2026-11-08", true, new Set())("2026-11-08"), true);
});

test("a streak longer than the fetch shows as the fetched days", () => {
  const taken = new Set(run("2026-11-07", 500));
  assert.equal(tally("2026-11-08", 30, takenOn("2026-11-08", true, taken)).streak, STREAK_DAYS + 1);
});

test("best and count are within the window only, the streak is not", () => {
  const taken = new Set([...run("2026-10-20", 50), ...run("2026-11-07", 3)]);
  const { streak, best, count } = tally("2026-11-08", 30, takenOn("2026-11-08", false, taken));
  // The window is 10 October to 8 November: 11 days of the long run, then 3.
  assert.deepEqual({ streak, best, count }, { streak: 3, best: 11, count: 14 });
});

test("the card asks for daily means from a day before its first day", async () => {
  const h = hass();
  await make({}, h);
  assert.equal(h.sent.length, 1);
  assert.deepEqual(plain(h.sent[0]), {
    type: "recorder/statistics_during_period",
    start_time: new Date(Date.UTC(2025, 10, 8) - 864e5).toISOString(),
    statistic_ids: [ENTITY],
    period: "day",
    types: ["mean"],
    units: {},
  });
});

test("the card fetches again once the local day changes, and not before", async () => {
  const h = hass({ tz: "Europe/Rome" });
  const el = await make({}, h);
  setNow("2026-11-08T22:59:00Z");
  el.hass = { ...h };
  assert.equal(h.sent.length, 1);
  setNow("2026-11-08T23:00:00Z"); // midnight in Rome
  el.hass = { ...h };
  assert.equal(h.sent.length, 2);
});

test("today is the day in Home Assistant's time zone, not UTC", async () => {
  // 12:30 UTC on 7 November is 01:30 on 8 November in Auckland (UTC+13).
  setNow("2026-11-07T12:30:00Z");
  const tz = "Pacific/Auckland";
  const el = await make({}, hass({ tz, rows: run("2026-11-07", 3).map((k) => row(k, 0.4, tz)) }));
  const html = el.shadowRoot.innerHTML;
  const today = cells(html).find(([, cls]) => cls.includes("today"));
  assert.deepEqual(today, [8, "today"]);
  assert.match(text(html), /3 day streak/);
});

test("the card renders the calendar, streak, best and count", async () => {
  const rows = [...run("2026-10-31", 5), ...run("2026-11-07", 3)].map((k) => row(k, 0.4));
  const el = await make({ when: "morning" }, hass({ rows }));
  const html = el.shadowRoot.innerHTML;
  const t = text(html);
  assert.match(t, /^Thyroxine Not yet today · morning 3 day streak Best 5 in 30 /);
  assert.match(t, /8 of the last 30 days$/);
  assert.match(html, /<span class="num risk">3</);
  assert.match(html, /style="width: 27%"/);
  const cs = cells(html);
  // Monday 5 October to Sunday 8 November: five whole weeks.
  assert.equal(cs.length, 35);
  assert.deepEqual(cs[0], [5, "out"]);
  // 27 to 31 October join into one bar.
  assert.deepEqual(cs.slice(22, 27).map(([, c]) => c), ["t jr", "t jl jr", "t jl jr", "t jl jr", "t jl"]);
  // 5 to 7 November join; the bar stops short of today, not yet taken.
  assert.deepEqual(cs.slice(28, 35).map(([, c]) => c), ["", "", "", "t jr", "t jl jr", "t jl", "today"]);
});

test("a taken day joins today's bar on its left but today ends the bar", async () => {
  const el = await make({}, hass({ state: "1", rows: run("2026-11-07", 2).map((k) => row(k, 0.4)) }));
  const cs = cells(el.shadowRoot.innerHTML);
  assert.deepEqual(cs.at(-1), [8, "t jl today"]);
  assert.match(el.shadowRoot.innerHTML, /<span class="num live">3</);
});

test("the time taken shows when it is today, in Home Assistant's time zone", async () => {
  const logged = Date.UTC(2026, 10, 8, 7, 5) / 1000;
  const config = { logged: "input_datetime.meds_logged" };
  let el = await make(config, hass({ state: "1", tz: "Europe/Rome", logged }));
  assert.match(text(el.shadowRoot.innerHTML), /Taken today at 08:05/);
  el = await make(config, hass({ state: "1", logged: logged - 864e2 }));
  assert.match(text(el.shadowRoot.innerHTML), /Taken today 1 day streak/);
});

test("the time follows Home Assistant's 12-hour setting", async () => {
  const logged = Date.UTC(2026, 10, 8, 15, 5) / 1000;
  const el = await make({ logged: "input_datetime.meds_logged" }, hass({ state: "1", language: "en-US", time_format: "12", logged }));
  assert.match(text(el.shadowRoot.innerHTML), /Taken today at 03:05 PM/i);
});

test("while statistics load, figures show as dashes and past days as loading", async () => {
  const el = new ctx.customElements.defined["meds-streak-card"]();
  el.setConfig({ entity: ENTITY });
  el.hass = hass();
  const html = el.shadowRoot.innerHTML;
  assert.match(html, /<span class="num ">–</);
  assert.match(html, /: loading"/);
});

test("a failed fetch is retried after a minute", async () => {
  timers.length = 0;
  const h = hass({ rows: new Error("recorder down") });
  const el = await make({}, h);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 60e3);
  timers[0].fn();
  el.hass = { ...h };
  assert.equal(h.sent.length, 2);
});

test("a missing sensor is named on the card", async () => {
  const el = await make({}, hass({ state: null }));
  assert.equal(text(el.shadowRoot.innerHTML), `${ENTITY} ${ENTITY} not found`);
});

test("the card speaks Home Assistant's language, or its locale", async () => {
  const rows = run("2026-11-07", 2).map((k) => row(k, 0.4));
  let el = await make({}, hass({ rows, language: "it" }));
  assert.match(text(el.shadowRoot.innerHTML), /Non ancora oggi 2 giorni di fila Record 2 su 30 /);
  el = await make({ locale: "de-AT", strings: { not_yet: "Noch offen" } }, hass({ rows, language: "it" }));
  assert.match(text(el.shadowRoot.innerHTML), /Noch offen 2 Tage in Folge/);
  assert.match(el.shadowRoot.innerHTML, /<div class="dow">Mo</);
});

test("config is checked", () => {
  assert.throws(() => checkConfig({}), /Set entity/);
  for (const days of [0, 2.5, "30"]) assert.throws(() => checkConfig({ entity: ENTITY, days }), /`days`/);
  assert.throws(() => checkConfig({ entity: ENTITY, locale: "not a locale" }), /`locale`/);
  assert.throws(() => checkConfig({ entity: ENTITY, strings: { nope: "x" } }), /no key 'nope'/);
  checkConfig({ entity: ENTITY, days: 14, locale: "pt-BR", strings: { taken_today: "Done" } });
});

test("the card uses only theme variables for colour", () => {
  const css = m.STYLE;
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  for (const v of ["--green-color", "--orange-color", "--primary-color", "--text-primary-color", "--primary-text-color", "--secondary-text-color", "--input-fill-color", "--secondary-background-color", "--ha-font-family-code"]) {
    assert.ok(css.includes(`var(${v}`), v);
  }
});

test("the card registers in the card picker with a visual editor", () => {
  const card = ctx.window.customCards.find((c) => c.type === "meds-streak-card");
  assert.equal(card.documentationURL, "https://github.com/matteo-pacini/ZPCards#meds-streak-card");
  const form = m.MedsStreakCard.getConfigForm();
  const names = form.schema.flatMap((f) => (f.schema ? f.schema : [f])).map((f) => f.name);
  assert.deepEqual(plain(names), ["entity", "name", "logged", "when", "icon", "days", "locale"]);
  for (const name of names) assert.ok(form.computeLabel({ name }), name);
  assert.doesNotThrow(() => checkConfig(m.MedsStreakCard.getStubConfig()));
});
