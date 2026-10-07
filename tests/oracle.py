#!/usr/bin/env python3
"""Independent oracle for ReefDose. Re-derives every constant from published atomic
weights (not the engine's hardcoded fractions), then computes all dosing cases with
exact fractions. Writes tests/expected.json for tests/run_tests.js."""
import json, os
from fractions import Fraction as Fr

# published atomic weights
AW = dict(Ca=Fr('40.078'), Cl=Fr('35.45'), Na=Fr('22.989769'), H=Fr('1.008'),
          O=Fr('15.999'), Mg=Fr('24.305'), C=Fr('12.011'))
def molmass(parts):
    return sum(AW[k] * n for k, n in parts.items())
CaCl2_2H2O = molmass(dict(Ca=1, Cl=2)) + 2 * molmass(dict(H=2, O=1))
MgCl2_6H2O = molmass(dict(Mg=1, Cl=2)) + 6 * molmass(dict(H=2, O=1))
NaHCO3 = molmass(dict(Na=1, H=1, C=1, O=3))
Na2CO3 = molmass(dict(Na=2, C=1, O=3))
F_Ca = AW['Ca'] / CaCl2_2H2O
F_Mg = AW['Mg'] / MgCl2_6H2O
MEQ_HCO3 = Fr(1000, 1) / NaHCO3      # 1 meq per mol
MEQ_CO3 = 2 * Fr(1000, 1) / Na2CO3   # 2 meq per mol
DKH_PER_MEQ = Fr('2.8')
CA_PER_DKH = Fr(20, 1) / DKH_PER_MEQ  # 20 ppm Ca per meq/L (calcification stoichiometry)
KALK_MEQ = Fr('40.8'); KALK_CA = Fr(804)

def ca_dose(dppm, v):
    return float(Fr(str(dppm)) * v / (F_Ca * 1000))
def mg_dose(dppm, v):
    return float(Fr(str(dppm)) * v / (F_Mg * 1000))
def alk_dose(ddkh, v, chem):
    meq_per_g = MEQ_CO3 if chem == 'co3' else MEQ_HCO3
    meq = (Fr(str(ddkh)) / DKH_PER_MEQ) * v
    return float(meq / meq_per_g), float(meq)
def two_part(cons, v):
    ca_ppm = float(Fr(str(cons)) * CA_PER_DKH)
    return dict(bakingSodaG=alk_dose(cons, v, 'hco3')[0],
                sodaAshG=alk_dose(cons, v, 'co3')[0],
                calciumG=ca_dose(ca_ppm, v), caPpmPerDay=ca_ppm)
def water_change(f, cur, new):
    return {k: float(Fr(str(cur[k])) * (1 - Fr(str(f))) + Fr(str(new[k])) * Fr(str(f)))
            for k in ('ca', 'alk', 'mg')}
def kalk(l, v):
    return dict(dkhPerDay=float(KALK_MEQ * l / (DKH_PER_MEQ * v)),
                caPpmPerDay=float(KALK_CA * l / v))

out = dict(constants=dict(
    F_Ca=float(F_Ca), F_Mg=float(F_Mg), MEQ_HCO3=float(MEQ_HCO3), MEQ_CO3=float(MEQ_CO3),
    CA_PER_DKH=float(CA_PER_DKH), CaCl2_2H2O=float(CaCl2_2H2O), MgCl2_6H2O=float(MgCl2_6H2O)))
out['ca'] = {f'{d}ppm_{v}L': ca_dose(d, v) for d, v in [(40, 300), (25, 120), (60, 450), (10.5, 75)]}
out['mg'] = {f'{d}ppm_{v}L': mg_dose(d, v) for d, v in [(80, 300), (130, 200), (55.5, 90)]}
out['alk'] = {f'{d}dkh_{v}L_{c}': dict(grams=alk_dose(d, v, c)[0], meq=alk_dose(d, v, c)[1])
              for d, v, c in [(1.5, 300, 'hco3'), (2.2, 120, 'co3'), (0.8, 60, 'hco3'), (3, 500, 'co3')]}
out['twoPart'] = {f'{c}_{v}': two_part(c, v) for c, v in [(0.7, 300), (1.2, 120), (0.35, 450), (2.0, 80)]}
out['waterChange'] = {
    'mix1': water_change(0.2, dict(ca=390, alk=7.2, mg=1280), dict(ca=440, alk=9.0, mg=1320)),
    'mix2': water_change(0.1, dict(ca=500, alk=12.0, mg=1400), dict(ca=440, alk=9.0, mg=1320)),
    'mix3': water_change(0.5, dict(ca=380, alk=6.5, mg=1200), dict(ca=450, alk=10.0, mg=1350))}
out['kalk'] = {f'{l}L_{v}': kalk(l, v) for l, v in [(2, 300), (5.5, 450), (1, 120), (0.5, 80)]}
path = os.path.join(os.path.dirname(__file__), 'expected.json')
with open(path, 'w') as f:
    json.dump(out, f)
print('wrote', path)
print('CaCl2.2H2O =', float(CaCl2_2H2O), 'F_Ca =', float(F_Ca))
print('MgCl2.6H2O =', float(MgCl2_6H2O), 'F_Mg =', float(F_Mg))
print('meq/g NaHCO3 =', float(MEQ_HCO3), 'Na2CO3 =', float(MEQ_CO3))
print('Ca per dKH =', float(CA_PER_DKH))
