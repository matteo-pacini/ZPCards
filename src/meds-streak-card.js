// Meds streak card: one medicine's last month as a calendar, with its streak.
//
// The card reads a "taken today" sensor: above 0 while today's dose is logged,
// back to 0 at midnight. Past days come from the sensor's long-term
// statistics, which the recorder never purges, so the sensor needs a
// state_class. Today comes from its live state.
//
// A day counts as taken when its daily mean is above TAKEN_MEAN, not when its
// max is: the sensor drops to 0 at midnight, but the 00:00 hour still records
// the 1 it had a moment before, so the max marks the day after every dose as
// taken too.
//
// The streak is the run of taken days ending today, or ending yesterday while
// today's dose is not logged yet, so it only breaks after a whole day with no
// dose. It is worked out on every render from the same days the calendar
// draws, so nothing has to run at midnight.

const DAY_MS = 864e5;
// The daily mean of a 0/1 sensor is the fraction of the day it was 1. A dose
// logged later than about 23:58 stays under this and is not counted; the
// moment of 1 left over at midnight is far below it.
const TAKEN_MEAN = 0.001;
const RETRY_MS = 60e3;
// How far back the streak is followed; a longer one shows as this many days.
const STREAK_DAYS = 365;

const DEFAULT_LOCALE = "en-GB";

// Interface text by language, or by language-Script or language-REGION holding
// only what differs from that language. Each picks up whatever it lacks from
// `en`, so a new key only has to be added there. Chinese is keyed by script
// alone, so Traditional stays English rather than showing Simplified.
// `{n}`, `{days}`, `{time}`, `{when}`, `{name}`, `{count}`, `{streak}` and
// `{entity}` are filled in by fill(). A value that is a mapping has a form per
// plural category (see Intl.PluralRules); `other` is the fallback.
const STRINGS = {
  en: {
    taken_today: "Taken today",
    taken_at: "Taken today at {time}",
    not_yet: "Not yet today",
    not_yet_when: "Not yet today · {when}",
    streak: { one: "day streak", other: "day streak" },
    best: "Best {n} in {days}",
    of_last: { one: "of the last day", other: "of the last {n} days" },
    state_taken: "taken",
    state_missed: "missed",
    state_pending: "not yet",
    state_loading: "loading",
    summary: "{name}: taken on {count} of the last {days} days, {streak} day streak",
    not_found: "{entity} not found",
  },
  de: {
    taken_today: "Heute genommen",
    taken_at: "Heute um {time} genommen",
    not_yet: "Heute noch nicht",
    not_yet_when: "Heute noch nicht · {when}",
    streak: { one: "Tag in Folge", other: "Tage in Folge" },
    best: "Bestwert {n} in {days}",
    of_last: { one: "des letzten Tages", other: "der letzten {n} Tage" },
    state_taken: "genommen",
    state_missed: "verpasst",
    state_pending: "noch nicht",
    state_loading: "wird geladen",
    summary: "{name}: an {count} der letzten {days} Tage genommen, {streak} Tage in Folge",
    not_found: "{entity} nicht gefunden",
  },
  es: {
    taken_today: "Tomado hoy",
    taken_at: "Tomado hoy a las {time}",
    not_yet: "Aún no hoy",
    not_yet_when: "Aún no hoy · {when}",
    streak: { one: "día seguido", other: "días seguidos" },
    best: "Mejor: {n} de {days}",
    of_last: { one: "del último día", other: "de los últimos {n} días" },
    state_taken: "tomado",
    state_missed: "olvidado",
    state_pending: "aún no",
    state_loading: "cargando",
    summary: "{name}: tomado {count} de los últimos {days} días, racha de {streak}",
    not_found: "{entity} no encontrado",
  },
  fr: {
    taken_today: "Pris aujourd’hui",
    taken_at: "Pris aujourd’hui à {time}",
    not_yet: "Pas encore aujourd’hui",
    not_yet_when: "Pas encore aujourd’hui · {when}",
    streak: { one: "jour d’affilée", other: "jours d’affilée" },
    best: "Record {n} sur {days}",
    of_last: { one: "du dernier jour", other: "des {n} derniers jours" },
    state_taken: "pris",
    state_missed: "oublié",
    state_pending: "pas encore",
    state_loading: "chargement",
    summary: "{name} : pris {count} des {days} derniers jours, série de {streak}",
    not_found: "{entity} introuvable",
  },
  it: {
    taken_today: "Preso oggi",
    taken_at: "Preso oggi alle {time}",
    not_yet: "Non ancora oggi",
    not_yet_when: "Non ancora oggi · {when}",
    streak: { one: "giorno di fila", other: "giorni di fila" },
    best: "Record {n} su {days}",
    of_last: { one: "dell’ultimo giorno", other: "degli ultimi {n} giorni" },
    state_taken: "preso",
    state_missed: "saltato",
    state_pending: "non ancora",
    state_loading: "caricamento",
    summary: "{name}: preso {count} degli ultimi {days} giorni, serie di {streak}",
    not_found: "{entity} non trovato",
  },
  nl: {
    taken_today: "Vandaag ingenomen",
    taken_at: "Vandaag ingenomen om {time}",
    not_yet: "Vandaag nog niet",
    not_yet_when: "Vandaag nog niet · {when}",
    streak: { one: "dag op rij", other: "dagen op rij" },
    best: "Beste {n} in {days}",
    of_last: { one: "van de laatste dag", other: "van de laatste {n} dagen" },
    state_taken: "ingenomen",
    state_missed: "gemist",
    state_pending: "nog niet",
    state_loading: "laden",
    summary: "{name}: {count} van de laatste {days} dagen ingenomen, {streak} dagen op rij",
    not_found: "{entity} niet gevonden",
  },
  pl: {
    taken_today: "Przyjęto dziś",
    taken_at: "Przyjęto dziś o {time}",
    not_yet: "Dziś jeszcze nie",
    not_yet_when: "Dziś jeszcze nie · {when}",
    streak: { one: "dzień z rzędu", few: "dni z rzędu", many: "dni z rzędu", other: "dnia z rzędu" },
    best: "Najlepiej {n} z {days}",
    of_last: { one: "z ostatniego dnia", few: "z ostatnich {n} dni", many: "z ostatnich {n} dni", other: "z ostatnich {n} dni" },
    state_taken: "przyjęto",
    state_missed: "pominięto",
    state_pending: "jeszcze nie",
    state_loading: "wczytywanie",
    summary: "{name}: przyjęto w {count} z ostatnich {days} dni, seria {streak}",
    not_found: "Nie znaleziono {entity}",
  },
  pt: {
    taken_today: "Tomado hoje",
    taken_at: "Tomado hoje às {time}",
    not_yet: "Ainda não hoje",
    not_yet_when: "Ainda não hoje · {when}",
    streak: { one: "dia seguido", other: "dias seguidos" },
    best: "Melhor: {n} em {days}",
    of_last: { one: "do último dia", other: "dos últimos {n} dias" },
    state_taken: "tomado",
    state_missed: "falhado",
    state_pending: "ainda não",
    state_loading: "a carregar",
    summary: "{name}: tomado em {count} dos últimos {days} dias, sequência de {streak}",
    not_found: "{entity} não encontrado",
  },
  "pt-BR": {
    state_missed: "esquecido",
    state_loading: "carregando",
  },
  sv: {
    taken_today: "Tagen i dag",
    taken_at: "Tagen i dag kl. {time}",
    not_yet: "Inte än i dag",
    not_yet_when: "Inte än i dag · {when}",
    streak: { one: "dag i rad", other: "dagar i rad" },
    best: "Bästa {n} av {days}",
    of_last: { one: "av den senaste dagen", other: "av de senaste {n} dagarna" },
    state_taken: "tagen",
    state_missed: "missad",
    state_pending: "inte än",
    state_loading: "laddar",
    summary: "{name}: tagen {count} av de senaste {days} dagarna, {streak} dagar i rad",
    not_found: "{entity} hittades inte",
  },
  "zh-Hans": {
    taken_today: "今天已服用",
    taken_at: "今天 {time} 已服用",
    not_yet: "今天尚未服用",
    not_yet_when: "今天尚未服用 · {when}",
    streak: "天连续",
    best: "最佳 {n} / {days}",
    of_last: "/ 近 {n} 天",
    state_taken: "已服用",
    state_missed: "漏服",
    state_pending: "尚未",
    state_loading: "加载中",
    summary: "{name}：最近 {days} 天中服用 {count} 天，连续 {streak} 天",
    not_found: "未找到 {entity}",
  },
};

// The text for a BCP 47 locale: `overrides`, then its language-REGION, then its
// language-Script, then its language, then English. Only the script comes from
// maximize(), which would also turn plain `pt` into pt-BR.
const translate = (locale, overrides) => {
  const tag = new Intl.Locale(locale);
  const { language, region } = tag;
  const { script } = tag.maximize();
  return Object.assign(
    {},
    STRINGS.en,
    STRINGS[language],
    STRINGS[language + "-" + script],
    STRINGS[language + "-" + region],
    overrides
  );
};

// A function replacement, so a `$` in a name is taken literally.
const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, k) => values[k]);

// The form of `forms` (a string, or a mapping by plural category) for count
// `n`, with `{n}` filled in.
const plural = (forms, n, locale) => {
  const form = typeof forms === "string" ? forms : forms[new Intl.PluralRules(locale).select(n)] ?? forms.other;
  return fill(form, { n: new Intl.NumberFormat(locale).format(n) });
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Days are "YYYY-MM-DD" keys in Home Assistant's time zone, the zone its
// daily statistics are bucketed in. Arithmetic on them goes through UTC
// midnight, where every day is 24 hours long.
const utc = (key) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
const addDays = (key, n) => new Date(utc(key) + n * DAY_MS).toISOString().slice(0, 10);
const weekday = (key) => (new Date(utc(key)).getUTCDay() + 6) % 7; // Monday is 0

const dayFormats = new Map();
// The day key of instant `t` (ms, or anything Date takes) in time zone `tz`.
const dayKey = (t, tz) => {
  let f = dayFormats.get(tz);
  if (!f) {
    // en-CA formats a date as YYYY-MM-DD.
    f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormats.set(tz, f);
  }
  return f.format(new Date(t));
};

// The first day drawn: the Monday on or before the first day of the window.
const gridStart = (today, days) => {
  const first = addDays(today, 1 - days);
  return addDays(first, -weekday(first));
};

// The first day fetched: far enough back for the grid and the streak.
const firstDay = (today, days) => {
  const back = addDays(today, -STREAK_DAYS);
  const start = gridStart(today, days);
  return back < start ? back : start;
};

// The days taken, from the rows recorder/statistics_during_period returns for
// one statistic with period "day" and type "mean".
const takenDays = (rows, tz) => new Set(rows.filter((r) => r.mean > TAKEN_MEAN).map((r) => dayKey(r.start, tz)));

// Whether day `k` was taken: today from the live state, past days from
// `taken` (a set of day keys, or null while it loads).
const takenOn = (today, takenToday, taken) => (k) => (k === today ? takenToday : Boolean(taken?.has(k)));

// The current streak, the best run in the window and the days taken in it.
const tally = (today, days, has) => {
  let streak = 0;
  const stop = firstDay(today, days);
  for (let k = has(today) ? today : addDays(today, -1); k >= stop && has(k); k = addDays(k, -1)) streak++;
  let best = 0;
  let run = 0;
  let count = 0;
  for (let k = addDays(today, 1 - days); k <= today; k = addDays(k, 1)) {
    run = has(k) ? run + 1 : 0;
    best = Math.max(best, run);
    if (has(k)) count++;
  }
  return { streak, best, count };
};

// Throws on config the card can't use; the message shows in the dashboard.
const checkConfig = (config) => {
  if (!config?.entity) throw new Error("Set entity to a 0/1 'taken today' sensor, e.g. sensor.meds_taken_today");
  if (config.days != null && !(Number.isInteger(config.days) && config.days >= 1)) {
    throw new Error("meds-streak-card: `days` must be a whole number, 1 or more");
  }
  if (config.locale != null) {
    try {
      new Intl.Locale(config.locale);
    } catch {
      throw new Error("meds-streak-card: `locale` must be a BCP 47 tag, such as de-DE");
    }
  }
  if (config.strings != null) {
    if (typeof config.strings !== "object" || Array.isArray(config.strings)) {
      throw new Error("meds-streak-card: `strings` must be a mapping");
    }
    for (const k of Object.keys(config.strings)) {
      if (!(k in STRINGS.en)) throw new Error(`meds-streak-card: \`strings\` has no key '${k}'`);
    }
  }
};

// Only Home Assistant theme variables, so the card takes its colours from
// whichever theme is active. The fallbacks are other theme variables, then
// CSS system colours, for a theme that leaves one out.
const STYLE = `
  :host {
    display: block;
    --m-taken: var(--green-color, var(--success-color, var(--primary-color, CanvasText)));
    --m-due: var(--orange-color, var(--warning-color, var(--primary-color, CanvasText)));
    --m-ring: var(--primary-color, CanvasText);
    --m-on-fill: var(--text-primary-color, var(--card-background-color, Canvas));
    --m-text: var(--primary-text-color, CanvasText);
    --m-muted: var(--secondary-text-color, GrayText);
    --m-raised: var(--input-fill-color, var(--secondary-background-color, color-mix(in srgb, currentColor 8%, transparent)));
    --m-mono: var(--ha-font-family-code, ui-monospace, monospace);
    --m-ease: cubic-bezier(.2, .8, .2, 1);
  }
  ha-card { padding: 16px; display: flex; flex-direction: column; gap: 14px; color: var(--m-text); }
  .head { display: flex; align-items: center; gap: 12px; }
  .badge { width: 40px; height: 40px; flex: none; border-radius: 14px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent); }
  .badge ha-icon { --mdc-icon-size: 22px; }
  .text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
  .name { font-size: 14px; line-height: 20px; font-weight: 600; }
  .sub { font-size: 12px; line-height: 16px; color: var(--m-muted); }
  .sub.due { color: var(--m-due); }
  .streak { flex: none; display: flex; flex-direction: column; align-items: flex-end; text-align: right; }
  .streak .row { display: flex; align-items: baseline; gap: 6px; }
  .num { font-family: var(--m-mono); font-variant-numeric: tabular-nums; font-size: 30px; line-height: 32px; font-weight: 500; color: var(--m-muted); }
  .num.live { color: var(--m-taken); }
  .num.risk { color: var(--m-due); }
  .unit, .best { font-size: 12px; line-height: 16px; color: var(--m-muted); white-space: nowrap; }
  .grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 6px; }
  .dow { font-size: 11px; line-height: 14px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--m-muted); text-align: center; padding-bottom: 2px; }
  .cell { height: 34px; margin: 0 3px; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 2px; background: var(--m-raised); color: var(--m-muted); font-family: var(--m-mono); font-variant-numeric: tabular-nums; font-size: 12px; font-weight: 500; transition: background 280ms var(--m-ease), color 280ms var(--m-ease); }
  .cell .mon { font-family: var(--ha-font-family-body, inherit); font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
  .cell.t { background: var(--m-taken); color: var(--m-on-fill); }
  .cell.t.jl { margin-left: 0; border-top-left-radius: 0; border-bottom-left-radius: 0; }
  .cell.t.jr { margin-right: 0; border-top-right-radius: 0; border-bottom-right-radius: 0; }
  .cell.today:not(.t) { background: none; color: var(--m-text); box-shadow: inset 0 0 0 2px var(--m-ring); }
  .cell.today.t { outline: 2px solid var(--m-ring); outline-offset: 2px; }
  .cell.out { opacity: .4; }
  .cell.future { visibility: hidden; }
  .foot { display: flex; align-items: center; gap: 12px; }
  .bar { flex: 1 1 auto; height: 6px; border-radius: 999px; background: var(--m-raised); overflow: hidden; }
  .bar div { height: 100%; border-radius: 999px; background: var(--m-taken); transition: width 700ms var(--m-ease); }
  .count { font-family: var(--m-mono); font-variant-numeric: tabular-nums; font-size: 12px; }
  .foot .of { font-size: 12px; color: var(--m-muted); }
  @media (prefers-reduced-motion: reduce) { .cell, .bar div { transition: none; } }
`;

// The visual editor's fields. Labels are in English, as Home Assistant gives
// a config form no way to learn the language.
const EDITOR_FORM = {
  schema: [
    { name: "entity", required: true, selector: { entity: { domain: "sensor" } } },
    { name: "name", selector: { text: {} } },
    { name: "logged", selector: { entity: { domain: "input_datetime" } } },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "when", selector: { text: {} } },
        { name: "icon", selector: { icon: {} } },
      ],
    },
    { name: "days", selector: { number: { min: 7, max: 365, step: 1, mode: "box" } } },
    { name: "locale", selector: { text: {} } },
  ],
  computeLabel: (s) =>
    ({
      entity: "Taken today sensor (0 or 1, with a state_class)",
      name: "Name (default: the sensor's name)",
      logged: "Time taken (optional)",
      when: "When it's due, such as morning",
      icon: "Icon",
      days: "Days shown",
      locale: "Locale, such as de-DE (default: Home Assistant's language)",
    })[s.name],
};

class MedsStreakCard extends HTMLElement {
  static getConfigForm() {
    return EDITOR_FORM;
  }

  static getStubConfig() {
    return { entity: "sensor.meds_taken_today" };
  }

  setConfig(config) {
    checkConfig(config);
    this._config = { days: 30, icon: "mdi:pill", ...config };
    this._taken = null;
    this._fetchedFor = null;
    this._seen = null;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    if (this._hass) this.hass = this._hass;
    else this._render();
  }

  set hass(hass) {
    this._hass = hass;
    const today = this._today();
    if (this._fetchedFor !== today) {
      this._fetchedFor = today;
      this._fetch(today);
    }
    // hass is set on every state change in the house; redraw only for ours.
    const seen = [hass.states[this._config.entity], hass.states[this._config.logged], hass.locale, today];
    if (this._seen && seen.every((s, i) => s === this._seen[i])) return;
    this._seen = seen;
    this._render();
  }

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  _tz() {
    return this._hass.config.time_zone;
  }

  _today() {
    return dayKey(Date.now(), this._tz());
  }

  _locale() {
    return this._config.locale || this._hass?.locale?.language || DEFAULT_LOCALE;
  }

  async _fetch(today) {
    const id = this._config.entity;
    try {
      const res = await this._hass.connection.sendMessagePromise({
        type: "recorder/statistics_during_period",
        // A day early, so the first local day is whole in any time zone.
        start_time: new Date(utc(firstDay(today, this._config.days)) - DAY_MS).toISOString(),
        statistic_ids: [id],
        period: "day",
        types: ["mean"],
        units: {},
      });
      this._taken = takenDays(res[id] || [], this._tz());
    } catch (err) {
      console.warn("[meds-streak-card]", id, err);
      setTimeout(() => {
        if (this._fetchedFor === today) this._fetchedFor = null;
      }, RETRY_MS);
    }
    this._render();
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const c = this._config;
    const hass = this._hass;
    const st = hass?.states[c.entity];
    const name = c.name || st?.attributes.friendly_name || c.entity;
    const locale = this._locale();
    const t = translate(locale, c.strings);
    if (!hass || !st) {
      this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card><div class="name">${esc(name)}</div><div class="sub">${hass ? esc(fill(t.not_found, { entity: c.entity })) : ""}</div></ha-card>`;
      return;
    }

    const tz = this._tz();
    const today = this._today();
    const windowStart = addDays(today, 1 - c.days);
    const start = gridStart(today, c.days);
    const end = addDays(today, 6 - weekday(today));
    const takenToday = Number(st.state) > 0;
    const loaded = this._taken !== null;
    const has = takenOn(today, takenToday, this._taken);
    const { streak, best, count } = tally(today, c.days, has);

    const day = (k, opts) => new Date(utc(k)).toLocaleDateString(locale, { timeZone: "UTC", ...opts });
    // 2024-01-01 was a Monday.
    const dows = [0, 1, 2, 3, 4, 5, 6].map((i) => `<div class="dow">${esc(day(addDays("2024-01-01", i), { weekday: "short" }))}</div>`).join("");
    const cells = [];
    for (let k = start, i = 0; k <= end; k = addDays(k, 1), i++) {
      const taken = has(k);
      const col = weekday(k);
      const cls = ["cell"];
      if (k > today) cls.push("future");
      else {
        if (taken) cls.push("t");
        if (taken && col > 0 && has(addDays(k, -1))) cls.push("jl");
        if (taken && col < 6 && k < today && has(addDays(k, 1))) cls.push("jr");
        if (k === today) cls.push("today");
        if (k < windowStart) cls.push("out");
      }
      const state = k === today && !taken ? t.state_pending : taken ? t.state_taken : loaded ? t.state_missed : t.state_loading;
      const mon = i === 0 || k.endsWith("-01") ? `<span class="mon">${esc(day(k, { month: "short" }))}</span>` : "";
      cells.push(`<div class="${cls.join(" ")}" title="${esc(day(k, { weekday: "short", day: "numeric", month: "short" }))}: ${esc(state)}"><span>${+k.slice(8)}</span>${mon}</div>`);
    }

    let sub = c.when ? fill(t.not_yet_when, { when: c.when }) : t.not_yet;
    if (takenToday) {
      sub = t.taken_today;
      const ts = Number(hass.states[c.logged]?.attributes.timestamp);
      if (ts && dayKey(ts * 1000, tz) === today) {
        const tf = hass.locale?.time_format;
        const time = new Date(ts * 1000).toLocaleTimeString(locale, {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
          hour12: tf === "12" ? true : tf === "24" ? false : undefined,
        });
        sub = fill(t.taken_at, { time });
      }
    }
    const hue = takenToday ? "var(--m-taken)" : "var(--m-due)";
    const numCls = !loaded ? "" : takenToday && streak ? "live" : streak ? "risk" : "";
    const n = (v) => new Intl.NumberFormat(locale).format(v);
    const summary = fill(t.summary, { name, count: n(count), days: n(c.days), streak: n(streak) });

    this.shadowRoot.innerHTML = `<style>${STYLE}</style>
      <ha-card>
        <div class="head">
          <div class="badge" style="--c: ${hue}"><ha-icon icon="${esc(c.icon)}"></ha-icon></div>
          <div class="text">
            <span class="name">${esc(name)}</span>
            <span class="sub${takenToday ? "" : " due"}">${esc(sub)}</span>
          </div>
          <div class="streak">
            <div class="row"><span class="num ${numCls}">${loaded ? n(streak) : "–"}</span><span class="unit">${esc(plural(t.streak, streak, locale))}</span></div>
            <span class="best">${loaded ? esc(fill(t.best, { n: n(best), days: n(c.days) })) : ""}</span>
          </div>
        </div>
        <div class="grid" role="img" aria-label="${esc(summary)}">${dows}${cells.join("")}</div>
        <div class="foot">
          <div class="bar"><div style="width: ${loaded ? Math.round((count / c.days) * 100) : 0}%"></div></div>
          <span class="count">${loaded ? n(count) : "–"}</span><span class="of">${esc(plural(t.of_last, c.days, locale))}</span>
        </div>
      </ha-card>`;
  }
}

customElements.define("meds-streak-card", MedsStreakCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "meds-streak-card",
  name: "Meds streak",
  description: "A medicine's last month as a calendar, with its streak",
  preview: false,
  documentationURL: "https://github.com/matteo-pacini/ZPCards#meds-streak-card",
});
