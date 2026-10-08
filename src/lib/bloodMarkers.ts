// Blood marker definitions: labels, units, reference ranges.
// Ranges are the clinic's functional ranges (PMS/ANALYSIS (2).xlsx), used only for low/normal/high flagging.
// refLow/refHigh are the default (male / adult) range; `rules` override it by sex and/or age.

export type BloodMarkerKey =
  | 'fasting_blood_sugar'
  | 'insulin_fasting'
  | 'total_cholesterol'
  | 'triglycerides'
  | 'vitamin_b12'
  | 'homocysteine'
  | 'ggt'
  | 'urea'
  | 'tsh'
  | 'cortisol'
  | 'postprandial_blood_sugar'
  | 'insulin_post_prandial'
  | 'ldl'
  | 'hemoglobin'
  | 'vitamin_d'
  | 'sgot'
  | 'alp'
  | 'creatinine'
  | 't3'
  | 'fsh'
  | 'lh'
  | 'estrogen'
  | 'progesterone'
  | 'prolactin'
  | 'hba1c'
  | 'homo_ir'
  | 'hdl'
  | 'ferritin'
  | 'esr'
  | 'sgpt'
  | 'bilirubin'
  | 'uric_acid'
  | 't4'
  | 'testosterone'
  | 'vldl'
  | 'iron'
  | 'calcium'
  // Iron panel
  | 'tibc'
  | 'iron_saturation'
  // CBC
  | 'rbc'
  | 'hematocrit'
  | 'mcv'
  | 'mch'
  | 'mchc'
  | 'rdw'
  | 'platelets'
  | 'wbc'
  | 'neutrophils'
  | 'lymphocytes'
  | 'monocytes'
  | 'eosinophils'
  | 'basophils'
  // Insulin
  | 'c_peptide'
  // LFT
  | 'total_protein'
  | 'albumin'
  | 'globulin'
  // Kidney / electrolytes
  | 'sodium'
  | 'chloride'
  | 'phosphorus'
  | 'potassium'
  | 'osmolarity'
  // Minerals
  | 'magnesium'
  | 'selenium'
  // Enzymes
  | 'ldh'
  // Thyroid
  | 'free_t3'
  | 'free_t4'
  | 'anti_tpo'
  | 'anti_tg'
  // Inflammation
  | 'hs_crp'
  | 'il6'
  // Coagulation
  | 'd_dimer'
  | 'prothrombin_time'
  | 'ptt'
  | 'fibrinogen'
  // Hormones
  | 'dheas';

export type Sex = 'male' | 'female';

export interface RangeRule {
  sex?: Sex;
  minAge?: number;
  maxAge?: number | null;
  low: number | null;
  high: number | null;
}

// Who the value belongs to — both optional; unknown sex/age just falls back to the default range
export interface MarkerProfile {
  sex?: string | null;
  age?: number | null;
}

export interface BloodMarkerDef {
  key: BloodMarkerKey;
  label: string;
  unit: string;
  // null on either side = open-ended
  refLow: number | null;
  refHigh: number | null;
  // First matching rule wins; null low/high inside a rule = open-ended (both null = don't flag)
  rules?: RangeRule[];
  // Aliases used when extracting from raw text
  aliases: string[];
  group: 'Sugar' | 'Insulin' | 'Lipids' | 'Vitamins' | 'Inflammation' | 'Kidney' | 'Thyroid' | 'Hormones' | 'LFT' | 'CBC' | 'Minerals' | 'Enzymes' | 'Coagulation';
}

export const BLOOD_MARKERS: BloodMarkerDef[] = [
  // Sugar
  { key: 'fasting_blood_sugar', label: 'Fasting Sugar', unit: 'mg/dL', refLow: 82, refHigh: 88, group: 'Sugar', aliases: ['fasting blood sugar', 'fasting glucose', 'fbs', 'glucose fasting', 'fasting sugar'] },
  // Insulin
  { key: 'insulin_fasting', label: 'Insulin(F)', unit: 'µIU/mL', refLow: null, refHigh: 5, group: 'Insulin', aliases: ['insulin fasting', 'fasting insulin', 'insulin f', 'f insulin', 'insulin f'] },
  // Lipids
  { key: 'total_cholesterol', label: 'Cholesterol', unit: 'mg/dL', refLow: 120, refHigh: 240, rules: [{ sex: 'male', minAge: 60, low: 170, high: 270 }, { sex: 'female', minAge: 60, low: 200, high: 300 }], group: 'Lipids', aliases: ['total cholesterol', 'cholesterol total', 'cholesterol'] },
  { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', refLow: 50, refHigh: 90, group: 'Lipids', aliases: ['triglycerides', 'tg'] },
  // Vitamins
  { key: 'vitamin_b12', label: 'B12', unit: 'pg/mL', refLow: 200, refHigh: 900, group: 'Vitamins', aliases: ['vitamin b12', 'b12', 'cobalamin', 'vit b12'] },
  { key: 'homocysteine', label: 'Homocysteine', unit: 'µmol/L', refLow: 5, refHigh: 9, group: 'Inflammation', aliases: ['homocysteine', 'hcy'] },
  // Inflammation/Liver
  { key: 'ggt', label: 'GGT', unit: 'U/L', refLow: 12, refHigh: 24, rules: [{ sex: 'female', low: 10, high: 22 }], group: 'Inflammation', aliases: ['ggt', 'gamma glutamyl transferase', 'gamma gt'] },
  // Kidney
  { key: 'urea', label: 'Urea', unit: 'mg/dL', refLow: 15, refHigh: 45, group: 'Kidney', aliases: ['urea', 'blood urea', 'bun'] },
  // Thyroid
  { key: 'tsh', label: 'TSH', unit: 'µIU/mL', refLow: 1, refHigh: 2, group: 'Thyroid', aliases: ['tsh', 'thyroid stimulating hormone'] },
  // Hormones
  { key: 'cortisol', label: 'Cortisol', unit: 'µg/dL', refLow: 5, refHigh: 25, rules: [{ sex: 'female', low: 6.2, high: 19.4 }], group: 'Hormones', aliases: ['cortisol', 'serum cortisol'] },
  { key: 'postprandial_blood_sugar', label: 'PP Sugar', unit: 'mg/dL', refLow: null, refHigh: 140, group: 'Sugar', aliases: ['postprandial', 'pp blood sugar', 'ppbs', 'glucose pp', 'post prandial', 'pp sugar'] },
  { key: 'insulin_post_prandial', label: 'Insulin(PP)', unit: 'µIU/mL', refLow: null, refHigh: 30, group: 'Insulin', aliases: ['insulin post prandial', 'post prandial insulin', 'insulin pp', 'pp insulin'] },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL', refLow: 80, refHigh: 170, rules: [{ minAge: 60, low: 120, high: 170 }], group: 'Lipids', aliases: ['ldl', 'ldl cholesterol', 'low density'] },
  { key: 'hemoglobin', label: 'Hb', unit: 'g/dL', refLow: 14.5, refHigh: 16, rules: [{ sex: 'female', low: 13, high: 14.5 }], group: 'CBC', aliases: ['hemoglobin', 'haemoglobin', 'hb', 'hgb'] },
  { key: 'vitamin_d', label: 'Vitamin D', unit: 'ng/mL', refLow: 30, refHigh: 100, group: 'Vitamins', aliases: ['vitamin d', '25-oh vitamin d', '25 hydroxy', 'vit d', '25(oh)d'] },
  // LFT
  { key: 'sgot', label: 'SGOT', unit: 'U/L', refLow: 12, refHigh: 26, rules: [{ sex: 'female', low: 9, high: 21 }], group: 'LFT', aliases: ['sgot', 'ast', 'aspartate aminotransferase'] },
  { key: 'alp', label: 'ALP', unit: 'U/L', refLow: 65, refHigh: 90, group: 'LFT', aliases: ['alp', 'alkaline phosphatase'] },
  { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', refLow: 0.8, refHigh: 1.1, group: 'Kidney', aliases: ['creatinine', 'serum creatinine'] },
  // Thyroid
  { key: 't3', label: 'T3', unit: 'ng/mL', refLow: 0.8, refHigh: 2.0, group: 'Thyroid', aliases: ['t3', 'triiodothyronine'] },
  // Hormones — female ranges depend on cycle phase / pregnancy / menopause (not tracked), so only men are flagged
  { key: 'fsh', label: 'FSH', unit: 'mIU/mL', refLow: null, refHigh: null, rules: [{ sex: 'male', minAge: 18, low: 1.5, high: 12.4 }], group: 'Hormones', aliases: ['fsh', 'follicle stimulating hormone'] },
  { key: 'lh', label: 'LH', unit: 'mIU/mL', refLow: null, refHigh: null, rules: [{ sex: 'male', minAge: 71, low: 3.1, high: 34 }, { sex: 'male', minAge: 20, low: 0.7, high: 7.9 }], group: 'Hormones', aliases: ['lh', 'luteinizing hormone'] },
  { key: 'estrogen', label: 'Estrogen', unit: 'pg/mL', refLow: null, refHigh: null, rules: [{ sex: 'male', low: 22, high: 30 }], group: 'Hormones', aliases: ['estrogen', 'estradiol'] },
  { key: 'progesterone', label: 'Progesterone', unit: 'ng/mL', refLow: null, refHigh: null, rules: [{ sex: 'male', low: 0, high: 1 }], group: 'Hormones', aliases: ['progesterone'] },
  { key: 'prolactin', label: 'Prolactin', unit: 'ng/mL', refLow: 3, refHigh: 15, rules: [{ sex: 'female', low: 3, high: 30 }], group: 'Hormones', aliases: ['prolactin', 'prl'] },
  // Sugar
  { key: 'hba1c', label: 'HbA1c', unit: '%', refLow: 5, refHigh: 5.3, group: 'Sugar', aliases: ['hba1c', 'hb a1c', 'glycated hemoglobin', 'glycosylated hemoglobin', 'a1c'] },
  { key: 'homo_ir', label: 'HOMA-IR', unit: '', refLow: null, refHigh: 1.8, group: 'Insulin', aliases: ['homo ir', 'homair', 'insulin resistance', 'homa ir'] },
  { key: 'hdl', label: 'HDL', unit: 'mg/dL', refLow: 65, refHigh: 85, rules: [{ sex: 'female', low: 55, high: 75 }], group: 'Lipids', aliases: ['hdl', 'hdl cholesterol', 'high density'] },
  { key: 'ferritin', label: 'Ferritin', unit: 'ng/mL', refLow: 75, refHigh: 150, rules: [{ sex: 'female', low: 50, high: 125 }], group: 'Minerals', aliases: ['ferritin'] },
  { key: 'esr', label: 'ESR', unit: 'mm/hr', refLow: null, refHigh: 5, rules: [{ sex: 'female', low: null, high: 10 }], group: 'Inflammation', aliases: ['esr', 'erythrocyte sedimentation rate', 'sedimentation rate'] },
  // LFT
  { key: 'sgpt', label: 'SGPT', unit: 'U/L', refLow: 13, refHigh: 22, rules: [{ sex: 'female', low: 10, high: 19 }], group: 'LFT', aliases: ['sgpt', 'alt', 'alanine aminotransferase'] },
  { key: 'bilirubin', label: 'Bilirubin', unit: 'mg/dL', refLow: 0.5, refHigh: 0.8, group: 'LFT', aliases: ['bilirubin', 'total bilirubin'] },
  { key: 'uric_acid', label: 'Uric Acid', unit: 'mg/dL', refLow: 3.7, refHigh: 5.5, rules: [{ sex: 'female', low: 3.2, high: 4.4 }], group: 'Kidney', aliases: ['uric acid'] },
  // Thyroid
  { key: 't4', label: 'T4', unit: 'µg/dL', refLow: 5, refHigh: 12, group: 'Thyroid', aliases: ['t4', 'thyroxine'] },
  // Hormones
  { key: 'testosterone', label: 'Testosterone', unit: 'ng/dL', refLow: null, refHigh: null, rules: [{ sex: 'male', low: 600, high: 900 }, { sex: 'female', low: 2, high: 45 }], group: 'Hormones', aliases: ['testosterone', 'serum testosterone'] },
  // Other
  { key: 'vldl', label: 'VLDL', unit: 'mg/dL', refLow: null, refHigh: 30, group: 'Lipids', aliases: ['vldl', 'very low density'] },
  { key: 'iron', label: 'Iron', unit: 'µg/dL', refLow: 80, refHigh: 100, group: 'Minerals', aliases: ['iron', 'serum iron'] },
  { key: 'calcium', label: 'Calcium', unit: 'mg/dL', refLow: 9.4, refHigh: 9.8, group: 'Minerals', aliases: ['calcium', 'serum calcium'] },

  // Iron panel
  { key: 'tibc', label: 'TIBC', unit: 'µg/dL', refLow: 250, refHigh: 370, rules: [{ sex: 'female', low: 250, high: 315 }], group: 'Minerals', aliases: ['tibc', 'total iron binding capacity'] },
  { key: 'iron_saturation', label: 'Iron Saturation', unit: '%', refLow: 30, refHigh: 40, group: 'Minerals', aliases: ['iron saturation', 'transferrin saturation', 'tsat', '% saturation'] },
  // CBC
  { key: 'rbc', label: 'RBC', unit: 'x10⁶/µL', refLow: 4.8, refHigh: 5.5, rules: [{ sex: 'female', low: 4.4, high: 4.8 }], group: 'CBC', aliases: ['rbc', 'red blood cell count', 'red blood cells'] },
  { key: 'hematocrit', label: 'Hematocrit', unit: '%', refLow: 40, refHigh: 49, rules: [{ sex: 'female', low: 39, high: 45 }], group: 'CBC', aliases: ['hematocrit', 'haematocrit', 'pcv', 'packed cell volume', 'hct'] },
  { key: 'mcv', label: 'MCV', unit: 'fL', refLow: 84, refHigh: 92, group: 'CBC', aliases: ['mcv', 'mean corpuscular volume'] },
  { key: 'mch', label: 'MCH', unit: 'pg', refLow: 28, refHigh: 32, group: 'CBC', aliases: ['mch', 'mean corpuscular hemoglobin'] },
  { key: 'mchc', label: 'MCHC', unit: 'g/dL', refLow: 33, refHigh: 35, group: 'CBC', aliases: ['mchc', 'mean corpuscular hemoglobin concentration'] },
  { key: 'rdw', label: 'RDW', unit: '%', refLow: null, refHigh: 13, group: 'CBC', aliases: ['rdw', 'red cell distribution width'] },
  { key: 'platelets', label: 'Platelets', unit: 'x10³/µL', refLow: 225, refHigh: 275, rules: [{ sex: 'female', low: 150, high: 385 }], group: 'CBC', aliases: ['platelets', 'platelet count', 'plt'] },
  { key: 'wbc', label: 'WBC', unit: 'x10³/µL', refLow: 3.5, refHigh: 6, group: 'CBC', aliases: ['wbc', 'white blood cell count', 'white blood cells', 'tlc', 'total leukocyte count'] },
  { key: 'neutrophils', label: 'Neutrophils', unit: '%', refLow: 50, refHigh: 60, group: 'CBC', aliases: ['neutrophils', 'neutrophil count', 'polymorphs'] },
  { key: 'lymphocytes', label: 'Lymphocytes', unit: '%', refLow: 30, refHigh: 35, group: 'CBC', aliases: ['lymphocytes', 'lymphocyte count', 'lymphs'] },
  { key: 'monocytes', label: 'Monocytes', unit: '%', refLow: 1, refHigh: 7, group: 'CBC', aliases: ['monocytes', 'monocyte count'] },
  { key: 'eosinophils', label: 'Eosinophils', unit: '%', refLow: null, refHigh: 3, group: 'CBC', aliases: ['eosinophils', 'eosinophil count'] },
  { key: 'basophils', label: 'Basophils', unit: 'x10³/µL', refLow: 0, refHigh: 0.2, group: 'CBC', aliases: ['basophils', 'basophil count'] },
  // Insulin
  { key: 'c_peptide', label: 'C-Peptide', unit: 'ng/mL', refLow: 1.1, refHigh: 2.1, group: 'Insulin', aliases: ['c-peptide', 'c peptide'] },
  // LFT
  { key: 'total_protein', label: 'Total Protein', unit: 'g/dL', refLow: 6.4, refHigh: 8.0, group: 'LFT', aliases: ['total protein', 'protein total'] },
  { key: 'albumin', label: 'Albumin', unit: 'g/dL', refLow: 4.5, refHigh: 5.0, group: 'LFT', aliases: ['albumin', 'serum albumin'] },
  { key: 'globulin', label: 'Globulin', unit: 'g/dL', refLow: 1.9, refHigh: 3.0, group: 'LFT', aliases: ['globulin'] },
  // Kidney / electrolytes
  { key: 'sodium', label: 'Sodium', unit: 'mmol/L', refLow: 139, refHigh: 142, group: 'Kidney', aliases: ['sodium', 'na', 'serum sodium'] },
  { key: 'chloride', label: 'Chloride', unit: 'mmol/L', refLow: 102, refHigh: 105, group: 'Kidney', aliases: ['chloride', 'cl', 'serum chloride'] },
  { key: 'phosphorus', label: 'Phosphorus', unit: 'mg/dL', refLow: 3.0, refHigh: 3.5, rules: [{ sex: 'female', low: 3.0, high: 4.0 }], group: 'Kidney', aliases: ['phosphorus', 'serum phosphorus', 'phosphate'] },
  { key: 'potassium', label: 'Potassium', unit: 'mmol/L', refLow: 4, refHigh: 4.4, group: 'Kidney', aliases: ['potassium', 'k', 'serum potassium'] },
  { key: 'osmolarity', label: 'Osmolarity', unit: 'mOsm/kg', refLow: 288, refHigh: 292, group: 'Kidney', aliases: ['osmolarity', 'serum osmolality', 'osmolality'] },
  // Minerals
  { key: 'magnesium', label: 'Magnesium', unit: 'mg/dL', refLow: 2, refHigh: 2.3, group: 'Minerals', aliases: ['magnesium', 'mg', 'serum magnesium'] },
  { key: 'selenium', label: 'Selenium', unit: 'µg/L', refLow: 90, refHigh: 140, group: 'Minerals', aliases: ['selenium'] },
  // Enzymes
  { key: 'ldh', label: 'LDH', unit: 'U/L', refLow: 140, refHigh: 175, group: 'Enzymes', aliases: ['ldh', 'lactate dehydrogenase', 'lactic dehydrogenase'] },
  // Thyroid
  { key: 'free_t3', label: 'Free T3', unit: 'pg/mL', refLow: 3.2, refHigh: 4.5, group: 'Thyroid', aliases: ['free t3', 'ft3'] },
  { key: 'free_t4', label: 'Free T4', unit: 'ng/dL', refLow: 1.1, refHigh: 1.7, group: 'Thyroid', aliases: ['free t4', 'ft4'] },
  { key: 'anti_tpo', label: 'Anti-TPO', unit: 'IU/mL', refLow: null, refHigh: 4, group: 'Thyroid', aliases: ['tpo', 'anti-tpo', 'anti tpo', 'thyroid peroxidase antibody'] },
  { key: 'anti_tg', label: 'Anti-TG (TGAB)', unit: 'IU/mL', refLow: null, refHigh: 4, group: 'Thyroid', aliases: ['tgab', 'anti-tg', 'anti tg', 'thyroglobulin antibody'] },
  // Inflammation
  { key: 'hs_crp', label: 'HS-CRP', unit: 'mg/L', refLow: null, refHigh: 1, group: 'Inflammation', aliases: ['hs-crp', 'hs crp', 'high sensitivity crp', 'crp'] },
  { key: 'il6', label: 'IL-6', unit: 'pg/mL', refLow: 2, refHigh: 6, group: 'Inflammation', aliases: ['il-6', 'il6', 'interleukin 6', 'interleukin-6'] },
  // Coagulation
  { key: 'd_dimer', label: 'D-Dimer', unit: 'mg/L FEU', refLow: 0, refHigh: 0.49, group: 'Coagulation', aliases: ['d-dimer', 'd dimer'] },
  { key: 'prothrombin_time', label: 'Prothrombin Time', unit: 'sec', refLow: 9.1, refHigh: 12, rules: [{ maxAge: 17, low: 9.9, high: 12.1 }], group: 'Coagulation', aliases: ['pt', 'prothrombin time'] },
  { key: 'ptt', label: 'PTT', unit: 'sec', refLow: 24, refHigh: 33, rules: [{ maxAge: 17, low: 26, high: 35 }], group: 'Coagulation', aliases: ['ptt', 'aptt', 'partial thromboplastin time'] },
  { key: 'fibrinogen', label: 'Fibrinogen', unit: 'mg/dL', refLow: 175, refHigh: 425, group: 'Coagulation', aliases: ['fibrinogen'] },
  // Hormones
  { key: 'dheas', label: 'DHEA-S', unit: 'µg/dL', refLow: null, refHigh: null, rules: [{ sex: 'male', minAge: 18, maxAge: 19, low: 108, high: 441 }, { sex: 'male', minAge: 20, maxAge: 29, low: 280, high: 640 }, { sex: 'male', minAge: 30, maxAge: 39, low: 120, high: 520 }, { sex: 'male', minAge: 40, maxAge: 49, low: 95, high: 530 }, { sex: 'male', minAge: 50, maxAge: 59, low: 70, high: 310 }, { sex: 'male', minAge: 60, maxAge: 69, low: 42, high: 290 }, { sex: 'male', minAge: 70, maxAge: null, low: 28, high: 175 }, { sex: 'female', minAge: 18, maxAge: 19, low: 145, high: 395 }, { sex: 'female', minAge: 20, maxAge: 29, low: 65, high: 380 }, { sex: 'female', minAge: 30, maxAge: 39, low: 45, high: 270 }, { sex: 'female', minAge: 40, maxAge: 49, low: 32, high: 240 }, { sex: 'female', minAge: 50, maxAge: 59, low: 26, high: 200 }, { sex: 'female', minAge: 60, maxAge: 69, low: 13, high: 130 }, { sex: 'female', minAge: 70, maxAge: null, low: 17, high: 90 }], group: 'Hormones', aliases: ['dheas', 'dhea-s', 'dhea sulfate', 'dehydroepiandrosterone sulfate'] },
];

export const BLOOD_MARKER_MAP: Record<BloodMarkerKey, BloodMarkerDef> =
  BLOOD_MARKERS.reduce((acc, m) => { acc[m.key] = m; return acc; }, {} as Record<BloodMarkerKey, BloodMarkerDef>);

export type MarkerStatus = 'low' | 'normal' | 'high' | 'unknown';

export const getMarkerRange = (
  def: BloodMarkerDef,
  profile: MarkerProfile = {},
): { low: number | null; high: number | null } => {
  const g = profile.sex?.trim().toLowerCase();
  const sex = g === 'male' || g === 'female' ? g : undefined;
  const age = profile.age ?? undefined;
  const rule = def.rules?.find((r) =>
    (r.sex === undefined || r.sex === sex) &&
    (r.minAge === undefined || (age !== undefined && age >= r.minAge)) &&
    (r.maxAge === undefined || r.maxAge === null || (age !== undefined && age <= r.maxAge)),
  );
  return rule ? { low: rule.low, high: rule.high } : { low: def.refLow, high: def.refHigh };
};

export const getMarkerStatus = (
  key: BloodMarkerKey,
  value: number | null | undefined,
  profile?: MarkerProfile,
): MarkerStatus => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unknown';
  const def = BLOOD_MARKER_MAP[key];
  if (!def) return 'unknown';
  const { low, high } = getMarkerRange(def, profile);
  if (low !== null && value < low) return 'low';
  if (high !== null && value > high) return 'high';
  return 'normal';
};

export const STATUS_BADGE_CLASS: Record<MarkerStatus, string> = {
  low: 'bg-warning/15 text-warning border-warning/30',
  normal: 'bg-success/15 text-success border-success/30',
  high: 'bg-destructive/15 text-destructive border-destructive/30',
  unknown: 'bg-muted text-muted-foreground border-border',
};
