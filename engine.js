// ReefDose engine: reef-aquarium chemistry dosing from test-kit numbers.
// Stoichiometry from published molecular weights; target ranges and daily-change
// guidance are commonly published reef-keeping values (labeled in the UI).
// Ideal-solution model: ignores ionic strength, impurities and test-kit error.

// compound constants (mass fractions from published atomic weights)
var F_Ca_CaCl2_2H2O = 0.27262;  // Ca in calcium chloride dihydrate (40.078/147.008)
var F_Mg_MgCl2_6H2O = 0.11955;  // Mg in magnesium chloride hexahydrate (24.305/203.303)
var MEQ_G_NaHCO3 = 11.9039;     // 1000/84.0066 meq per gram baking soda (1 mol = 1 meq)
var MEQ_G_Na2CO3 = 18.8705;     // 1000*2/105.9888 meq per gram soda ash (1 mol = 2 meq)
var DKH_PER_MEQ = 2.8;          // published convention: 1 meq/L = 2.8 dKH
var CA_PER_DKH = 7.1429;        // ppm Ca consumed per dKH consumed (calcification: 20 ppm per meq/L)
// saturated limewater (kalkwasser) at 25 C, published values ~:
var KALK_ALK_MEQ_L = 40.8;      // meq/L
var KALK_CA_PPM = 804;          // ppm Ca
// commonly published target ranges
var RANGE = {
  ca: { lo: 380, hi: 450, target: 420, unit: 'ppm', name: 'Calcium' },
  alk: { lo: 7, hi: 11, target: 8.5, unit: 'dKH', name: 'Alkalinity' },
  mg: { lo: 1250, hi: 1350, target: 1300, unit: 'ppm', name: 'Magnesium' }
};
// commonly published max safe daily changes
var MAX_DAILY = { ca: 50, alk: 1.4, mg: 100 };

function bad(v){ return !(typeof v === 'number' && isFinite(v)); }

// grams of calcium chloride dihydrate to raise Ca by dPpm in volLiters
function caDoseGrams(dPpm, volLiters) {
  if (bad(dPpm) || bad(volLiters) || dPpm < 0 || volLiters <= 0) return { error: 'Calcium delta and volume must be positive numbers.' };
  return { grams: dPpm * volLiters / (F_Ca_CaCl2_2H2O * 1000) };
}
function mgDoseGrams(dPpm, volLiters) {
  if (bad(dPpm) || bad(volLiters) || dPpm < 0 || volLiters <= 0) return { error: 'Magnesium delta and volume must be positive numbers.' };
  return { grams: dPpm * volLiters / (F_Mg_MgCl2_6H2O * 1000) };
}
// alkalinity raise by dDkh; chem: 'hco3' (baking soda) or 'co3' (soda ash)
function alkDoseGrams(dDkh, volLiters, chem) {
  if (bad(dDkh) || bad(volLiters) || dDkh < 0 || volLiters <= 0) return { error: 'Alkalinity delta and volume must be positive numbers.' };
  var meqPerG = chem === 'co3' ? MEQ_G_Na2CO3 : MEQ_G_NaHCO3;
  var meqNeeded = (dDkh / DKH_PER_MEQ) * volLiters;
  return { grams: meqNeeded / meqPerG, meq: meqNeeded, chem: chem === 'co3' ? 'soda ash' : 'baking soda' };
}
// correction plan to a target, split by max daily change
function correction(current, target, maxDaily) {
  if (current >= target) return null;
  var delta = target - current;
  var days = Math.max(1, Math.ceil(delta / maxDaily - 1e-9));
  return { delta: delta, days: days, perDay: delta / days };
}
// daily two-part maintenance from measured alkalinity consumption (dKH/day)
function twoPartDaily(consumpDkh, volLiters) {
  if (bad(consumpDkh) || bad(volLiters) || consumpDkh < 0 || volLiters <= 0) return { error: 'Consumption and volume must be positive numbers.' };
  var caPerDay = consumpDkh * CA_PER_DKH; // ppm/day consumed with it
  return {
    bakingSodaG: alkDoseGrams(consumpDkh, volLiters, 'hco3').grams,
    sodaAshG: alkDoseGrams(consumpDkh, volLiters, 'co3').grams,
    calciumG: caDoseGrams(caPerDay, volLiters).grams,
    caPpmPerDay: caPerDay
  };
}
// water change outcome: fraction f (0-1) replaced with water at (caN, alkN, mgN)
function waterChange(volLiters, frac, cur, newW) {
  if (bad(frac) || frac <= 0 || frac > 1) return { error: 'Change fraction must be between 0 and 100%.' };
  ['ca', 'alk', 'mg'].forEach(function (k) { if (bad(cur[k]) || bad(newW[k])) throw 0; });
  return {
    ca: cur.ca * (1 - frac) + newW.ca * frac,
    alk: cur.alk * (1 - frac) + newW.alk * frac,
    mg: cur.mg * (1 - frac) + newW.mg * frac,
    note: (newW.ca < cur.ca || newW.alk < cur.alk || newW.mg < cur.mg)
      ? 'A water change can only move a parameter toward the salt mix value - it cannot raise anything above it.'
      : ''
  };
}
// saturated limewater: liters/day effect on tank
function kalkDaily(litersPerDay, volLiters) {
  if (bad(litersPerDay) || bad(volLiters) || litersPerDay < 0 || volLiters <= 0) return { error: 'Liters per day and volume must be positive numbers.' };
  return {
    dkhPerDay: KALK_ALK_MEQ_L * litersPerDay / (DKH_PER_MEQ * volLiters),
    caPpmPerDay: KALK_CA_PPM * litersPerDay / volLiters,
    note: 'Assumes fully saturated limewater at 25 C (published ~' + KALK_ALK_MEQ_L + ' meq/L, ~' + KALK_CA_PPM + ' ppm Ca). Actual saturation varies with mixing and temperature.'
  };
}
function verdict(param, value) {
  var r = RANGE[param];
  if (value < r.lo) return { tag: 'LOW', hint: 'below the commonly published ' + r.lo + '-' + r.hi + ' ' + r.unit + ' range' };
  if (value > r.hi) return { tag: 'HIGH', hint: 'above the commonly published ' + r.lo + '-' + r.hi + ' ' + r.unit + ' range' };
  return { tag: 'IN RANGE', hint: 'inside the commonly published ' + r.lo + '-' + r.hi + ' ' + r.unit + ' range' };
}

var engine = {
  caDoseGrams: caDoseGrams, mgDoseGrams: mgDoseGrams, alkDoseGrams: alkDoseGrams,
  correction: correction, twoPartDaily: twoPartDaily, waterChange: waterChange,
  kalkDaily: kalkDaily, verdict: verdict,
  CONST: { F_Ca_CaCl2_2H2O: F_Ca_CaCl2_2H2O, F_Mg_MgCl2_6H2O: F_Mg_MgCl2_6H2O,
    MEQ_G_NaHCO3: MEQ_G_NaHCO3, MEQ_G_Na2CO3: MEQ_G_Na2CO3, DKH_PER_MEQ: DKH_PER_MEQ,
    CA_PER_DKH: CA_PER_DKH, KALK_ALK_MEQ_L: KALK_ALK_MEQ_L, KALK_CA_PPM: KALK_CA_PPM },
  RANGE: RANGE, MAX_DAILY: MAX_DAILY
};
if (typeof module !== 'undefined') module.exports = engine;
