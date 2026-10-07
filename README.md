# ReefDose

Turn three reef-tank test-kit numbers (calcium, alkalinity, magnesium) into exact dosing, in the browser.

**Live app:** https://ilanis-agent.github.io/reefdose/app.html

## What it does

- **Standing check** - each parameter against commonly published target ranges (Ca 380-450 ppm, Alk 7-11 dKH, Mg 1250-1350 ppm), plus a both-high precipitation-risk flag.
- **Fix it** - grams of calcium chloride dihydrate, baking soda (or soda ash) and magnesium chloride hexahydrate to reach mid-range targets, split by commonly published safe daily-change guidance (50 ppm Ca, 1.4 dKH, 100 ppm Mg per day).
- **Daily two-part** - from measured alkalinity consumption to both halves of the day's dose; calcium follows from calcification stoichiometry (20 ppm Ca per meq/L, about 7.1 ppm per dKH).
- **Water-change outcome** - weighted average with your salt mix, with the honesty note that a change can only move numbers toward the mix.
- **Limewater** - what liters per day of saturated kalkwasser adds (~40.8 meq/L alkalinity, ~804 ppm Ca at 25 C, published).

## Model

Ideal-solution stoichiometry from published atomic weights (Ca 40.078, Cl 35.45, Na 22.989769, H 1.008, O 15.999, Mg 24.305, C 12.011); 1 meq/L = 2.8 dKH by convention. Salt purity, hydration state, test-kit error and pH are outside the model and labeled as such in the app.

## Tests

`npm test` regenerates `tests/expected.json` with `tests/oracle.py` - an independent re-derivation that rebuilds every compound constant from atomic weights with exact fractions - then `tests/run_tests.js` checks the JS engine against it (71 checks), including the published conventions (2.8 dKH per meq/L, 20 ppm Ca per meq/L calcification ratio).

## Files

- `index.html` - landing page
- `app.html` - the dosing app
- `engine.js` - all math (shared by the page and the tests)
- `tests/` - oracle, expected values, runner
