# AGENTS.md

ZPCards is a set of Home Assistant dashboard cards. HACS installs one file, `zp-cards.js`.

## Layout

- `src/`: one plain browser script per card or family of cards. There are no imports, dependencies or build tools beyond Node.
- `zp-cards.js`: generated from `src/` by `scripts/build.js`. Never edit it by hand. Commit it rebuilt, together with every change to `src/`.
- `test/`: Node's built-in test runner. Each `*.harness.js` file loads one script into a `vm` context with a stubbed DOM, and exposes the script's top-level functions to the tests.
- `images/<card>/`: the screenshots in the README.

## Commands

Use Node 24 or later.

```sh
node scripts/build.js                                  # rebuild zp-cards.js
node scripts/build.js --check                          # CI: fail if it is stale
node --experimental-vm-modules --test test/*.test.js   # all tests
```

CI runs the HACS validator, the build check and the tests.

## Rules that are easy to break

- **Shared scope.** Scripts in `src/` reuse top-level names such as `esc`, `STRINGS` and `translate`. The bundle wraps each script in its own block, and loads as a module, so it is strict code. Never rely on a name from another script. Never declare a global with `var` or `window.x`, except `window.customCards`.
- **New card.** Add its file to `SOURCES` in `scripts/build.js`, and its element names to `test/zp-cards.bundle.test.js`. Register it in `window.customCards` with `documentationURL` set to its README anchor. Write a section for it in `README.md`.
- **Element names.** Keep existing ones (`budget-sankey-card`, `food-stockpile-card`, `water-stockpile-card`, `cat-stockpile-card`, `meds-streak-card`). Users' dashboards reference them.
- **Stored data.** Keep the stockpile cards' JSON in to-do item descriptions backward compatible. Settings writes keep keys they don't change, so the target and the cat card's cats never overwrite each other.
- **Languages.** Every card has a `STRINGS` table in the same 11 languages: en, de, es, fr, it, nl, pl, pt, pt-BR, sv and zh-Hans. Add a new key to `en` first, then to each language. The i18n tests check keys, placeholders and plural categories. Visual editor labels stay in English.
- **Config errors.** Validate config in `setConfig`, and throw an `Error` whose message tells the user what to fix.
- **Theming.** Take colours and fonts from Home Assistant theme variables (`--primary-color`, `--green-color`, `--secondary-text-color`, `--ha-font-family-code`, ...), so cards follow any theme. The meds card has no hard-coded colours, and a test enforces this.
- **Meds days.** The meds card counts a day as taken by its daily statistics mean, not its max, and keys days in `hass.config.time_zone`. Read the comment at the top of `src/meds-streak-card.js` before changing either.

## Style

- Match the surrounding code. Comments say why, not what.
- The README is plain, short sentences. Each card section has screenshots, YAML examples and an options table.
- Commit subjects are short imperative sentences, with no type prefix.
