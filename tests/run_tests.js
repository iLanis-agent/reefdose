// ReefDose suite: engine vs independent atomic-weight oracle (tests/expected.json),
// plus published-convention checks (2.8 dKH per meq/L, calcification ratio).
const e = require('../engine.js');
const exp = require('./expected.json');
let pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); } }
function near(a, b, t, m) { ok(typeof a === 'number' && Math.abs(a - b) <= t, `${m}: got ${a}, want ${b} +/- ${t}`); }

// 1. constants vs atomic-weight derivation (0.05% tolerance for rounding of inputs)
near(e.CONST.F_Ca_CaCl2_2H2O, exp.constants.F_Ca, 0.0002, 'F_Ca from atomic weights');
near(e.CONST.F_Mg_MgCl2_6H2O, exp.constants.F_Mg, 0.0002, 'F_Mg from atomic weights');
near(e.CONST.MEQ_G_NaHCO3, exp.constants.MEQ_HCO3, 0.001, 'meq/g NaHCO3');
near(e.CONST.MEQ_G_Na2CO3, exp.constants.MEQ_CO3, 0.001, 'meq/g Na2CO3');
near(e.CONST.CA_PER_DKH, exp.constants.CA_PER_DKH, 0.001, 'Ca per dKH ratio');

// 2. dosing vs oracle
for (const [k, v] of Object.entries(exp.ca)) {
  const [d, vol] = k.match(/([\d.]+)ppm_([\d.]+)L/).slice(1).map(Number);
  near(e.caDoseGrams(d, vol).grams, v, 0.02, `ca dose ${k}`);
}
for (const [k, v] of Object.entries(exp.mg)) {
  const [d, vol] = k.match(/([\d.]+)ppm_([\d.]+)L/).slice(1).map(Number);
  near(e.mgDoseGrams(d, vol).grams, v, 0.02, `mg dose ${k}`);
}
for (const [k, v] of Object.entries(exp.alk)) {
  const m = k.match(/([\d.]+)dkh_([\d.]+)L_(hco3|co3)/);
  const r = e.alkDoseGrams(+m[1], +m[2], m[3]);
  near(r.grams, v.grams, 0.02, `alk dose ${k}`);
  near(r.meq, v.meq, 0.01, `alk meq ${k}`);
}
for (const [k, v] of Object.entries(exp.twoPart)) {
  const [c, vol] = k.split('_').map(Number);
  const r = e.twoPartDaily(c, vol);
  near(r.bakingSodaG, v.bakingSodaG, 0.02, `2part soda ${k}`);
  near(r.sodaAshG, v.sodaAshG, 0.02, `2part ash ${k}`);
  near(r.calciumG, v.calciumG, 0.02, `2part calcium ${k}`);
  near(r.caPpmPerDay, v.caPpmPerDay, 0.001, `2part caPpm ${k}`);
}
for (const [k, v] of Object.entries(exp.waterChange)) {
  const fr = { mix1: 0.2, mix2: 0.1, mix3: 0.5 }[k];
  const cur = { mix1: { ca: 390, alk: 7.2, mg: 1280 }, mix2: { ca: 500, alk: 12, mg: 1400 }, mix3: { ca: 380, alk: 6.5, mg: 1200 } }[k];
  const nw = { mix1: { ca: 440, alk: 9, mg: 1320 }, mix2: { ca: 440, alk: 9, mg: 1320 }, mix3: { ca: 450, alk: 10, mg: 1350 } }[k];
  const r = e.waterChange(300, fr, cur, nw);
  near(r.ca, v.ca, 0.01, `${k} ca`); near(r.alk, v.alk, 0.01, `${k} alk`); near(r.mg, v.mg, 0.01, `${k} mg`);
}
for (const [k, v] of Object.entries(exp.kalk)) {
  const [l, vol] = k.match(/([\d.]+)L_([\d.]+)/).slice(1).map(Number);
  const r = e.kalkDaily(l, vol);
  near(r.dkhPerDay, v.dkhPerDay, 0.001, `kalk dkh ${k}`);
  near(r.caPpmPerDay, v.caPpmPerDay, 0.01, `kalk ca ${k}`);
}

// 3. published-convention properties
ok(Math.abs(e.alkDoseGrams(2.8, 1, 'hco3').meq - 1) < 1e-9, '1 meq/L = 2.8 dKH convention');
ok(Math.abs(e.twoPartDaily(1, 100).caPpmPerDay - 20 / 2.8) < 1e-3, 'calcification 20 ppm per meq');
// soda ash delivers 2x meq per gram vs baking soda (exact ratio from mol stoichiometry)
ok(Math.abs(e.alkDoseGrams(1, 100, 'hco3').grams / e.alkDoseGrams(1, 100, 'co3').grams - exp.constants.MEQ_CO3 / exp.constants.MEQ_HCO3) < 1e-3, 'ash vs soda meq ratio');

// 4. correction plan logic
const c1 = e.correction(6.5, 8.5, 1.4);
ok(c1.days === 2 && Math.abs(c1.perDay - 1.0) < 1e-9, 'alk correction splits to 2 days');
ok(e.correction(8.0, 8.5, 1.4).days === 1, 'small correction 1 day');
ok(e.correction(9.0, 8.5, 1.4) === null, 'no correction needed when above target');

// 5. verdicts
ok(e.verdict('ca', 300).tag === 'LOW' && e.verdict('ca', 500).tag === 'HIGH' && e.verdict('ca', 420).tag === 'IN RANGE', 'ca verdict bands');
ok(e.verdict('alk', 6).tag === 'LOW' && e.verdict('alk', 12).tag === 'HIGH' && e.verdict('alk', 9).tag === 'IN RANGE', 'alk verdict bands');
ok(e.verdict('mg', 1100).tag === 'LOW' && e.verdict('mg', 1400).tag === 'HIGH' && e.verdict('mg', 1300).tag === 'IN RANGE', 'mg verdict bands');

// 6. error paths
ok(e.caDoseGrams(-5, 100).error, 'negative ca delta rejected');
ok(e.caDoseGrams(5, 0).error, 'zero volume rejected');
ok(e.mgDoseGrams(5, NaN).error, 'NaN volume rejected');
ok(e.alkDoseGrams(-1, 100).error, 'negative dkh rejected');
ok(e.twoPartDaily(0.5, -10).error, 'negative volume rejected');
ok(e.kalkDaily(-1, 100).error, 'negative kalk rejected');
ok(e.waterChange(100, 1.5, { ca: 1, alk: 1, mg: 1 }, { ca: 1, alk: 1, mg: 1 }).error, '>100% change rejected');
ok(e.waterChange(100, -0.1, { ca: 1, alk: 1, mg: 1 }, { ca: 1, alk: 1, mg: 1 }).error, 'negative change rejected');
ok(e.waterChange(100, 0.5, { ca: 440, alk: 9, mg: 1320 }, { ca: 400, alk: 8, mg: 1300 }).note.includes('cannot raise'), 'dilution honesty note present');

console.log(`${pass} passed, ${fail} failed`);
if (fail) { console.log(fails.slice(0, 15).join('\n')); process.exit(1); }
