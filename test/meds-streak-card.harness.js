// Loads meds-streak-card.js for the tests. The card is a browser script, so it
// runs in a vm context with just enough DOM stubbed for the element to be
// defined, constructed and rendered, and a clock the tests set. The rendered
// markup is left as a string on el.shadowRoot.innerHTML.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const timers = [];
const ctx = vm.createContext({
  console: { warn() {} },
  // Recorded, not run, so a test can fire a retry when it chooses.
  setTimeout: (fn, ms) => timers.push({ fn, ms }),
});
vm.runInContext(
  `
  var __now = "2026-11-08T12:00:00Z";
  const __RealDate = Date;
  Date = class extends __RealDate {
    constructor(...a) { super(...(a.length ? a : [__now])); }
    static now() { return new __RealDate(__now).getTime(); }
  };
  class HTMLElement {
    attachShadow() {
      return (this.shadowRoot = { innerHTML: "" });
    }
  }
  var customElements = {
    defined: {},
    define(name, cls) {
      this.defined[name] = cls;
    },
  };
  var window = {};
  `,
  ctx
);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src", "meds-streak-card.js"), "utf8"), ctx);

const ENTITY = "sensor.meds_taken_today";

// A daily statistics row for the local day `key` in `tz`, as
// recorder/statistics_during_period returns it: `start` is the local midnight
// in ms.
const row = (key, mean, tz = "UTC") => {
  const guess = Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
  // The offset of `tz` at that moment, found by formatting it there.
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(guess)
      .map((p) => [p.type, +p.value])
  );
  const offset = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - guess;
  return { start: guess - offset, end: guess - offset + 864e5, mean };
};

module.exports = {
  ctx,
  timers,
  ENTITY,
  row,

  // The script's top-level declarations, which are not properties of the
  // context's global object and so are fetched by name.
  meds: vm.runInContext(
    "({ STRINGS, STYLE, translate, fill, plural, TAKEN_MEAN, STREAK_DAYS, utc, addDays, weekday, dayKey, gridStart, firstDay, takenDays, takenOn, tally, checkConfig, EDITOR_FORM, MedsStreakCard })",
    ctx
  ),

  // Values built inside the vm have that realm's prototypes, which deepEqual
  // rejects; a JSON round trip brings them into this one.
  plain: (v) => JSON.parse(JSON.stringify(v)),

  setNow: (iso) => vm.runInContext(`__now = ${JSON.stringify(iso)}`, ctx),

  // A Home Assistant connection. `state` is the sensor's live state (null: no
  // such entity), `rows` the statistics it returns (an Error: the call fails),
  // `logged` an input_datetime's timestamp in seconds. Each message sent is
  // kept on `sent`.
  hass: ({ state = "0", rows = [], tz = "UTC", language = "en-GB", time_format = "24", logged } = {}) => {
    const sent = [];
    const states = {};
    if (state !== null) states[ENTITY] = { state, attributes: { friendly_name: "Thyroxine" } };
    if (logged != null) states["input_datetime.meds_logged"] = { state: "", attributes: { timestamp: logged } };
    return {
      sent,
      states,
      config: { time_zone: tz },
      locale: { language, time_format },
      connection: {
        sendMessagePromise: async (msg) => {
          sent.push(msg);
          if (rows instanceof Error) throw rows;
          return { [ENTITY]: rows };
        },
      },
    };
  },

  // A card with `config`, given `hass`, once its statistics have arrived.
  make: async (config, hass) => {
    const el = new ctx.customElements.defined["meds-streak-card"]();
    el.setConfig({ entity: ENTITY, ...config });
    if (hass) {
      el.hass = hass;
      await new Promise((r) => setImmediate(r));
    }
    return el;
  },

  // Visible text of rendered markup, without the stylesheet: tags dropped,
  // the entities esc() writes decoded, whitespace collapsed.
  text: (html) =>
    html
      .replace(/<style>[\s\S]*?<\/style>/, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" })[e])
      .replace(/\s+/g, " ")
      .trim(),

  // The calendar's cells as [day of month, classes], from the rendered markup.
  cells: (html) =>
    [...html.matchAll(/<div class="cell([^"]*)"[^>]*><span>(\d+)<\/span>/g)].map((m) => [+m[2], m[1].trim()]),
};
