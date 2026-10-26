// Disease staging models for the "how the brain changes over time" animation.
//
// What these ARE: simplified summaries of well-known, published *staging models*
// that describe WHERE disease-related changes typically appear, and in what ORDER,
// based on studies of many brains (mostly post-mortem pathology).
//
// What these are NOT: measurements, predictions for any person, exact timing
// (stages are not years), or brain scans. The intensity numbers only show
// "earlier / less" vs "later / more" involvement for the color animation.
//
// Each model names its source in the conventional way (e.g. "Braak & Braak, 1991")
// and provides a search query so students can open the original paper from a real
// database instead of trusting a reference typed by hand.

export interface DiseaseStage {
  label: string;
  /** Plain-language description of where changes appear at this stage. */
  description: string;
  /** Region ids (see shared/regions.ts) → relative involvement 0–1 (illustrative only). */
  regions: Record<string, number>;
}

export interface DiseaseModel {
  id: string;
  name: string;
  /** Words that suggest a question is about this disease. */
  keywords: RegExp;
  modelName: string;
  /** What kind of change the stages track (e.g. tau tangles). */
  tracks: string;
  /** Conventional citation name of the staging model. */
  sourceLabel: string;
  /** Search query that finds the original staging paper in the research databases. */
  sourceQuery: string;
  /** Rough time course, in words only (no invented numbers). */
  timeCourse: string;
  /** Who it usually affects, in words. */
  whoItAffects: string;
  stages: DiseaseStage[];
  caution: string;
  /** Typical question to run through the research engine. */
  question: string;
}

const GENERAL_CAUTION =
  "This shows a simplified, published staging model of where changes usually appear and in what order. It is not a scan, not a measurement, and not a prediction for any person. Stages are not years, and real people vary a lot.";

export const DISEASES: DiseaseModel[] = [
  {
    id: "alzheimers",
    name: "Alzheimer's disease",
    keywords: /\b(alzheimer'?s?|dementia)\b/i,
    modelName: "Braak neurofibrillary staging (stages I–VI)",
    tracks: "where tau protein tangles build up",
    sourceLabel: "Braak & Braak (1991)",
    sourceQuery: "Braak neuropathological stageing of Alzheimer-related changes",
    timeCourse: "Tangle changes are thought to begin many years, often decades, before memory symptoms appear, and spread slowly.",
    whoItAffects: "Most common in older adults; rare before middle age.",
    stages: [
      { label: "Stage I", description: "Changes first appear in the transentorhinal and entorhinal cortex, on the inner temporal lobe.", regions: { "entorhinal-cortex": 0.35 } },
      { label: "Stage II", description: "Entorhinal changes increase and begin in the hippocampus.", regions: { "entorhinal-cortex": 0.6, hippocampus: 0.3 } },
      { label: "Stage III", description: "Changes spread through limbic areas: hippocampus, parahippocampal and fusiform gyri, amygdala.", regions: { "entorhinal-cortex": 0.75, hippocampus: 0.55, "parahippocampal-gyrus": 0.45, "fusiform-gyrus": 0.3, amygdala: 0.35 } },
      { label: "Stage IV", description: "Limbic areas are heavily involved; changes reach the wider temporal lobe.", regions: { "entorhinal-cortex": 0.9, hippocampus: 0.75, "parahippocampal-gyrus": 0.65, "fusiform-gyrus": 0.5, amygdala: 0.55, "inferior-temporal-gyrus": 0.4, "temporal-pole": 0.4, insula: 0.25 } },
      { label: "Stage V", description: "Association cortex (frontal, parietal and temporal areas that combine information) becomes involved.", regions: { "entorhinal-cortex": 1, hippocampus: 0.9, "parahippocampal-gyrus": 0.8, "fusiform-gyrus": 0.7, amygdala: 0.7, "inferior-temporal-gyrus": 0.65, "middle-temporal-gyrus": 0.55, "temporal-pole": 0.6, insula: 0.45, "inferior-parietal": 0.5, precuneus: 0.5, "superior-parietal": 0.4, "rostral-middle-frontal": 0.45, "superior-frontal-gyrus": 0.4, "lateral-occipital": 0.35 } },
      { label: "Stage VI", description: "Changes reach primary areas too: primary visual, sensory and motor cortex.", regions: { "entorhinal-cortex": 1, hippocampus: 1, "parahippocampal-gyrus": 0.95, "fusiform-gyrus": 0.85, amygdala: 0.85, "inferior-temporal-gyrus": 0.8, "middle-temporal-gyrus": 0.75, "temporal-pole": 0.75, insula: 0.65, "inferior-parietal": 0.75, precuneus: 0.7, "superior-parietal": 0.65, "rostral-middle-frontal": 0.7, "superior-frontal-gyrus": 0.65, "lateral-occipital": 0.6, pericalcarine: 0.45, "precentral-gyrus": 0.4, "postcentral-gyrus": 0.4, "transverse-temporal": 0.4 } },
    ],
    caution: GENERAL_CAUTION,
    question: "How does Alzheimer's disease change the brain over time?",
  },
  {
    id: "parkinsons",
    name: "Parkinson's disease",
    keywords: /\b(parkinson'?s?)\b/i,
    modelName: "Braak Lewy-body staging (stages 1–6)",
    tracks: "where alpha-synuclein (Lewy) pathology appears",
    sourceLabel: "Braak et al. (2003)",
    sourceQuery: "Braak staging of brain pathology related to sporadic Parkinson's disease",
    timeCourse: "Early stages are thought to come before movement symptoms; movement symptoms usually appear around stages 3–4. Some people do not follow this pattern.",
    whoItAffects: "Most common in older adults; uncommon in young people.",
    stages: [
      { label: "Stage 1", description: "Changes begin low in the brainstem (medulla) and in the olfactory (smell) system.", regions: { brainstem: 0.3 } },
      { label: "Stage 2", description: "Changes move up the brainstem into the pons.", regions: { brainstem: 0.5 } },
      { label: "Stage 3", description: "The midbrain is involved, including the substantia nigra, which makes dopamine; the amygdala is also affected.", regions: { brainstem: 0.75, amygdala: 0.4 } },
      { label: "Stage 4", description: "The inner temporal lobe (entorhinal and parahippocampal areas) becomes involved.", regions: { brainstem: 0.9, amygdala: 0.6, "entorhinal-cortex": 0.45, "parahippocampal-gyrus": 0.35, hippocampus: 0.3 } },
      { label: "Stage 5", description: "Higher-order association and prefrontal cortex are involved.", regions: { brainstem: 1, amygdala: 0.75, "entorhinal-cortex": 0.6, "parahippocampal-gyrus": 0.5, hippocampus: 0.45, insula: 0.45, "anterior-cingulate": 0.45, "prefrontal-cortex": 0.4 } },
      { label: "Stage 6", description: "Primary sensory and motor areas are involved.", regions: { brainstem: 1, amygdala: 0.85, "entorhinal-cortex": 0.75, "parahippocampal-gyrus": 0.65, hippocampus: 0.6, insula: 0.6, "anterior-cingulate": 0.6, "prefrontal-cortex": 0.6, "precentral-gyrus": 0.4, "postcentral-gyrus": 0.4 } },
    ],
    caution: GENERAL_CAUTION,
    question: "How does Parkinson's disease change the brain over time?",
  },
  {
    id: "huntingtons",
    name: "Huntington's disease",
    keywords: /\b(huntington'?s?)\b/i,
    modelName: "Vonsattel neuropathological grading (grades 1–4)",
    tracks: "loss of neurons in the striatum (caudate and putamen)",
    sourceLabel: "Vonsattel et al. (1985)",
    sourceQuery: "Vonsattel neuropathological classification of Huntington's disease",
    timeCourse: "Changes usually progress over many years after symptoms begin; brain changes can be detected before symptoms.",
    whoItAffects: "An inherited condition; symptoms usually start in mid-adulthood.",
    stages: [
      { label: "Grade 1", description: "Mild changes in the caudate nucleus.", regions: { caudate: 0.35 } },
      { label: "Grade 2", description: "Caudate changes increase; the putamen is involved.", regions: { caudate: 0.6, putamen: 0.35 } },
      { label: "Grade 3", description: "Caudate and putamen are clearly affected; the globus pallidus is involved.", regions: { caudate: 0.8, putamen: 0.6, "globus-pallidus": 0.35, "nucleus-accumbens": 0.3 } },
      { label: "Grade 4", description: "Severe striatal changes; the cortex is also affected.", regions: { caudate: 1, putamen: 0.85, "globus-pallidus": 0.55, "nucleus-accumbens": 0.6, "frontal-lobe": 0.3 } },
    ],
    caution: GENERAL_CAUTION,
    question: "How does Huntington's disease change the brain over time?",
  },
  {
    id: "als",
    name: "ALS (amyotrophic lateral sclerosis)",
    keywords: /\b(als|amyotrophic lateral sclerosis|lou gehrig'?s?|motor neuron disease)\b/i,
    modelName: "pTDP-43 staging (stages 1–4)",
    tracks: "where TDP-43 protein pathology appears",
    sourceLabel: "Brettschneider et al. (2013)",
    sourceQuery: "Brettschneider stages of pTDP-43 pathology in amyotrophic lateral sclerosis",
    timeCourse: "ALS usually progresses over a few years after symptoms begin, but this varies widely.",
    whoItAffects: "Most often begins in mid-to-late adulthood.",
    stages: [
      { label: "Stage 1", description: "Motor cortex and motor nuclei in the brainstem (and spinal cord).", regions: { "precentral-gyrus": 0.5, brainstem: 0.4 } },
      { label: "Stage 2", description: "Prefrontal cortex (middle frontal gyrus) and more brainstem areas.", regions: { "precentral-gyrus": 0.7, brainstem: 0.55, "rostral-middle-frontal": 0.4, "caudal-middle-frontal": 0.4 } },
      { label: "Stage 3", description: "More prefrontal areas, the sensory strip and the striatum.", regions: { "precentral-gyrus": 0.85, brainstem: 0.7, "rostral-middle-frontal": 0.6, "caudal-middle-frontal": 0.6, "medial-orbitofrontal": 0.4, "postcentral-gyrus": 0.4, caudate: 0.35, putamen: 0.35 } },
      { label: "Stage 4", description: "The front of the inner temporal lobe, including the hippocampus.", regions: { "precentral-gyrus": 1, brainstem: 0.8, "rostral-middle-frontal": 0.75, "caudal-middle-frontal": 0.75, "medial-orbitofrontal": 0.55, "postcentral-gyrus": 0.55, caudate: 0.5, putamen: 0.5, hippocampus: 0.45, "entorhinal-cortex": 0.4, "temporal-pole": 0.35 } },
    ],
    caution: GENERAL_CAUTION,
    question: "How does ALS change the brain over time?",
  },
  {
    id: "cte",
    name: "CTE (chronic traumatic encephalopathy)",
    keywords: /\b(cte|chronic traumatic encephalopathy|repeated (head )?(injur|concussion|impact)\w*|repetitive head)\b/i,
    modelName: "McKee CTE staging (stages I–IV)",
    tracks: "where tau protein builds up after repeated head impacts",
    sourceLabel: "McKee et al. (2013)",
    sourceQuery: "McKee spectrum of disease in chronic traumatic encephalopathy",
    timeCourse: "Described in people with years of repeated head impacts (for example some contact-sport athletes). It can currently only be confirmed after death.",
    whoItAffects: "Described in people with many years of repeated head impacts.",
    stages: [
      { label: "Stage I", description: "Small spots of tau at the bottom of folds (sulci) in the frontal cortex.", regions: { "superior-frontal-gyrus": 0.3, "rostral-middle-frontal": 0.3 } },
      { label: "Stage II", description: "More spots across the frontal cortex; the brainstem (locus coeruleus) is involved.", regions: { "superior-frontal-gyrus": 0.5, "rostral-middle-frontal": 0.5, "caudal-middle-frontal": 0.35, brainstem: 0.3 } },
      { label: "Stage III", description: "Spreads through frontal and temporal cortex and the insula, and into the hippocampus, entorhinal cortex and amygdala.", regions: { "frontal-lobe": 0.55, "temporal-lobe": 0.45, insula: 0.45, hippocampus: 0.5, "entorhinal-cortex": 0.5, amygdala: 0.5, brainstem: 0.45 } },
      { label: "Stage IV", description: "Widespread across the cortex, with more severe involvement of inner temporal structures.", regions: { "frontal-lobe": 0.85, "temporal-lobe": 0.75, "parietal-lobe": 0.5, insula: 0.7, hippocampus: 0.85, "entorhinal-cortex": 0.85, amygdala: 0.8, brainstem: 0.6, "occipital-lobe": 0.3 } },
    ],
    caution: `${GENERAL_CAUTION} One concussion does not mean someone will develop CTE.`,
    question: "How does chronic traumatic encephalopathy change the brain over time?",
  },
];

export const DISEASE_BY_ID = new Map(DISEASES.map((d) => [d.id, d]));

/** The disease model a question is about, if any. */
export function detectDisease(question: string): DiseaseModel | undefined {
  return DISEASES.find((d) => d.keywords.test(question));
}
