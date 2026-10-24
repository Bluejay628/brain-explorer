// Brain-region dictionary (two levels).
//
//  Level 1 — broad areas: lobes, prefrontal cortex, cingulate cortex, basal ganglia, …
//  Level 2 — subdivisions: the 34 Desikan-Killiany cortical regions (per hemisphere)
//            and the FreeSurfer subcortical structures that the 3D model contains,
//            plus three hormone-related glands shown as approximate markers.
//
// The descriptions are short, textbook-level overviews written for this app.
// They are deliberately conservative — brain functions are distributed across
// networks, and no region "does" one thing on its own. They are NOT findings
// from a specific study; the UI labels them "General overview", and the AI may
// only cite them as "textbook background", never as research evidence.
//
// `aliases` drive keyword detection in abstracts. A region being *mentioned*
// in an abstract does not mean the study found anything about it.

export type RegionKind = "lobe" | "cortical-area" | "subdivision" | "deep-structure" | "hindbrain" | "marker";

export interface BrainRegion {
  id: string;
  name: string;
  kind: RegionKind;
  /** Broad area this subdivision belongs to. */
  parent?: string;
  /** Keys of meshes/atlas labels in public/models/brain.json that draw this region. */
  meshKeys?: string[];
  /** Approximate position (scene units) for marker-only structures. */
  marker?: [number, number, number];
  aliases: string[];
  overview: string;
  commonlyStudiedIn: string[];
  caution: string;
  /** Search query used for "Find research on this region". */
  searchQuery: string;
}

const NETWORK_CAUTION = "Brain functions depend on networks of regions; activity here alone does not show that this region causes a behavior.";
const DK_CAUTION = "Atlas boundaries are drawn on an average brain; in real people, these areas vary in size, shape and exact location.";

// mm → scene units, matching scripts/build-brain-model.py (center (0,-18,8), /80, z = posterior).
const mm = (x: number, y: number, z: number): [number, number, number] => [x / 80, (z - 8) / 80, -(y + 18) / 80];

export const REGIONS: BrainRegion[] = [
  // ───────────────────────────── Broad areas ─────────────────────────────
  {
    id: "frontal-lobe", name: "Frontal lobe", kind: "lobe",
    aliases: ["frontal lobe", "frontal cortex", "frontal lobes"],
    overview: "The largest lobe, at the front of each hemisphere. It contains primary motor cortex, premotor areas, Broca's area (usually on the left) and prefrontal cortex.",
    commonlyStudiedIn: ["movement planning", "language production", "decision-making", "executive function"],
    caution: NETWORK_CAUTION, searchQuery: "frontal lobe",
  },
  {
    id: "prefrontal-cortex", name: "Prefrontal cortex", kind: "cortical-area", parent: "frontal-lobe",
    aliases: ["prefrontal cortex", "prefrontal", "pfc"],
    overview: "The front-most part of the frontal lobe, with several subdivisions. It is one of the last brain areas to mature, continuing to develop into the mid-twenties.",
    commonlyStudiedIn: ["working memory", "self-control", "planning", "emotion regulation"],
    caution: "Different prefrontal subregions are linked to different processes; findings for one should not be generalized to the whole area.",
    searchQuery: "prefrontal cortex",
  },
  {
    id: "parietal-lobe", name: "Parietal lobe", kind: "lobe",
    aliases: ["parietal lobe", "parietal cortex", "posterior parietal"],
    overview: "Behind the frontal lobe. It contains primary somatosensory cortex and areas that combine information from different senses.",
    commonlyStudiedIn: ["touch and body sensation", "spatial attention", "numbers and math"],
    caution: NETWORK_CAUTION, searchQuery: "parietal cortex",
  },
  {
    id: "temporal-lobe", name: "Temporal lobe", kind: "lobe",
    aliases: ["temporal lobe", "temporal cortex", "medial temporal lobe", "temporal lobes"],
    overview: "On the side of each hemisphere, below the lateral (Sylvian) fissure. It contains auditory cortex; its inner (medial) part sits next to the hippocampus and amygdala.",
    commonlyStudiedIn: ["hearing", "understanding language", "memory", "recognizing objects and faces"],
    caution: "The outer and inner (medial) temporal lobe are linked to quite different functions.",
    searchQuery: "temporal lobe",
  },
  {
    id: "occipital-lobe", name: "Occipital lobe", kind: "lobe",
    aliases: ["occipital lobe", "occipital cortex", "visual cortex"],
    overview: "The rear-most lobe, where the cortex first processes visual information.",
    commonlyStudiedIn: ["vision", "visual attention"],
    caution: "Visual processing continues far beyond the occipital lobe, into temporal and parietal areas.",
    searchQuery: "occipital cortex visual",
  },
  {
    id: "cingulate-cortex", name: "Cingulate cortex", kind: "cortical-area",
    aliases: ["cingulate cortex", "cingulate gyrus", "cingulate"],
    overview: "A belt of cortex on the inner (medial) surface of each hemisphere, curving around the corpus callosum. Its front and back parts have different connections.",
    commonlyStudiedIn: ["attention and error monitoring", "emotion", "pain", "memory"],
    caution: NETWORK_CAUTION, searchQuery: "cingulate cortex",
  },
  {
    id: "anterior-cingulate", name: "Anterior cingulate cortex", kind: "cortical-area", parent: "cingulate-cortex",
    aliases: ["anterior cingulate", "acc"],
    overview: "The front part of the cingulate cortex, wrapping around the front of the corpus callosum.",
    commonlyStudiedIn: ["error monitoring", "conflict detection", "pain", "emotion"],
    caution: "Theories of anterior cingulate function are still actively debated.",
    searchQuery: "anterior cingulate cortex",
  },
  {
    id: "insula", name: "Insula", kind: "cortical-area", meshKeys: ["insula"],
    aliases: ["insula", "insular cortex", "anterior insula"],
    overview: "Cortex folded deep inside the lateral fissure, hidden beneath the frontal, parietal and temporal lobes.",
    commonlyStudiedIn: ["sensing the body's internal state", "taste", "emotion", "noticing important events"],
    caution: "The insula is active in a very wide range of tasks, which makes its activity hard to interpret on its own.",
    searchQuery: "insula insular cortex",
  },
  {
    id: "basal-ganglia", name: "Basal ganglia", kind: "deep-structure",
    aliases: ["basal ganglia", "striatum", "striatal"],
    overview: "A group of deep nuclei (caudate, putamen, globus pallidus, nucleus accumbens) connected in loops with the cortex and thalamus.",
    commonlyStudiedIn: ["movement control", "habit learning", "reward and motivation"],
    caution: "Reward findings often concern specific parts, such as the nucleus accumbens, not the basal ganglia as a whole.",
    searchQuery: "basal ganglia striatum",
  },

  // ───────────────────── Frontal subdivisions (Desikan-Killiany) ─────────────────────
  {
    id: "precentral-gyrus", name: "Precentral gyrus (primary motor cortex)", kind: "subdivision", parent: "frontal-lobe", meshKeys: ["precentral"],
    aliases: ["precentral gyrus", "primary motor cortex", "motor cortex", "m1"],
    overview: "The strip just in front of the central sulcus. It contains primary motor cortex, which sends signals that control voluntary movements; each body part is represented along it.",
    commonlyStudiedIn: ["voluntary movement", "motor learning", "recovery after stroke"], caution: DK_CAUTION, searchQuery: "primary motor cortex",
  },
  {
    id: "paracentral-lobule", name: "Paracentral lobule", kind: "subdivision", parent: "frontal-lobe", meshKeys: ["paracentral"],
    aliases: ["paracentral lobule", "paracentral"],
    overview: "On the inner surface, where the motor and sensory strips continue over the top of the brain. It includes the areas for the legs and feet.",
    commonlyStudiedIn: ["leg and foot movement and sensation", "bladder control"], caution: DK_CAUTION, searchQuery: "paracentral lobule",
  },
  {
    id: "superior-frontal-gyrus", name: "Superior frontal gyrus", kind: "subdivision", parent: "prefrontal-cortex", meshKeys: ["superiorfrontal"],
    aliases: ["superior frontal gyrus", "superior frontal", "supplementary motor area", "pre-sma"],
    overview: "The top-most fold of the frontal lobe. Its back part includes the supplementary motor area; front parts are part of prefrontal cortex.",
    commonlyStudiedIn: ["planning sequences of movement", "working memory", "self-awareness"], caution: DK_CAUTION, searchQuery: "superior frontal gyrus",
  },
  {
    id: "rostral-middle-frontal", name: "Rostral middle frontal gyrus (dorsolateral prefrontal)", kind: "subdivision", parent: "prefrontal-cortex", meshKeys: ["rostralmiddlefrontal"],
    aliases: ["rostral middle frontal", "middle frontal gyrus", "dorsolateral prefrontal", "dlpfc"],
    overview: "Roughly corresponds to much of the dorsolateral prefrontal cortex (DLPFC), on the outer front surface of the brain.",
    commonlyStudiedIn: ["working memory", "planning", "cognitive control", "sleep loss effects"], caution: DK_CAUTION, searchQuery: "dorsolateral prefrontal cortex",
  },
  {
    id: "caudal-middle-frontal", name: "Caudal middle frontal gyrus", kind: "subdivision", parent: "prefrontal-cortex", meshKeys: ["caudalmiddlefrontal"],
    aliases: ["caudal middle frontal", "frontal eye field", "frontal eye fields"],
    overview: "The back part of the middle frontal gyrus, in front of motor cortex. It includes the frontal eye fields, which help direct eye movements and attention.",
    commonlyStudiedIn: ["eye movements", "attention", "working memory"], caution: DK_CAUTION, searchQuery: "frontal eye field",
  },
  {
    id: "pars-opercularis", name: "Pars opercularis (Broca's area)", kind: "subdivision", parent: "prefrontal-cortex", meshKeys: ["parsopercularis"],
    aliases: ["pars opercularis", "broca", "broca's area", "inferior frontal gyrus", "ifg"],
    overview: "Part of the inferior frontal gyrus. Together with the pars triangularis it forms Broca's area, which is usually stronger on the left side.",
    commonlyStudiedIn: ["speech production", "grammar", "stopping an action"], caution: DK_CAUTION, searchQuery: "Broca area inferior frontal gyrus",
  },
  {
    id: "pars-triangularis", name: "Pars triangularis (Broca's area)", kind: "subdivision", parent: "prefrontal-cortex", meshKeys: ["parstriangularis"],
    aliases: ["pars triangularis", "broca", "broca's area", "inferior frontal gyrus"],
    overview: "The triangular middle part of the inferior frontal gyrus, and part of Broca's area.",
    commonlyStudiedIn: ["word meaning", "language production"], caution: DK_CAUTION, searchQuery: "pars triangularis",
  },
  {
    id: "pars-orbitalis", name: "Pars orbitalis", kind: "subdivision", parent: "prefrontal-cortex", meshKeys: ["parsorbitalis"],
    aliases: ["pars orbitalis"],
    overview: "The lowest, front part of the inferior frontal gyrus, next to the orbitofrontal cortex.",
    commonlyStudiedIn: ["meaning in language", "emotion-related decisions"], caution: DK_CAUTION, searchQuery: "pars orbitalis",
  },
  {
    id: "lateral-orbitofrontal", name: "Lateral orbitofrontal cortex", kind: "subdivision", parent: "prefrontal-cortex", meshKeys: ["lateralorbitofrontal"],
    aliases: ["lateral orbitofrontal", "orbitofrontal cortex", "orbitofrontal", "ofc"],
    overview: "The outer part of the frontal lobe's underside, just above the eyes.",
    commonlyStudiedIn: ["changing behavior when rewards change", "decision-making", "emotion"], caution: DK_CAUTION, searchQuery: "lateral orbitofrontal cortex",
  },
  {
    id: "medial-orbitofrontal", name: "Medial orbitofrontal cortex (ventromedial prefrontal)", kind: "subdivision", parent: "prefrontal-cortex", meshKeys: ["medialorbitofrontal"],
    aliases: ["medial orbitofrontal", "ventromedial prefrontal", "vmpfc", "orbitofrontal"],
    overview: "The inner part of the frontal lobe's underside, overlapping with the ventromedial prefrontal cortex.",
    commonlyStudiedIn: ["valuing rewards", "decision-making", "emotion regulation"], caution: DK_CAUTION, searchQuery: "ventromedial prefrontal cortex",
  },
  {
    id: "frontal-pole", name: "Frontal pole", kind: "subdivision", parent: "prefrontal-cortex", meshKeys: ["frontalpole"],
    aliases: ["frontal pole", "frontopolar", "rostral prefrontal"],
    overview: "The very front tip of the brain.",
    commonlyStudiedIn: ["juggling several goals at once", "thinking about one's own thinking"], caution: DK_CAUTION, searchQuery: "frontopolar cortex",
  },

  // ───────────────────── Parietal subdivisions ─────────────────────
  {
    id: "postcentral-gyrus", name: "Postcentral gyrus (primary somatosensory cortex)", kind: "subdivision", parent: "parietal-lobe", meshKeys: ["postcentral"],
    aliases: ["postcentral gyrus", "somatosensory cortex", "primary somatosensory", "s1"],
    overview: "The strip just behind the central sulcus. It receives touch, pressure, temperature and body-position signals, with each body part mapped along it.",
    commonlyStudiedIn: ["touch", "pain", "body awareness"], caution: DK_CAUTION, searchQuery: "primary somatosensory cortex",
  },
  {
    id: "superior-parietal", name: "Superior parietal lobule", kind: "subdivision", parent: "parietal-lobe", meshKeys: ["superiorparietal"],
    aliases: ["superior parietal", "superior parietal lobule", "intraparietal"],
    overview: "The upper part of the parietal lobe, behind the sensory strip.",
    commonlyStudiedIn: ["spatial attention", "reaching and grasping", "mental rotation"], caution: DK_CAUTION, searchQuery: "superior parietal lobule",
  },
  {
    id: "inferior-parietal", name: "Inferior parietal lobule (angular gyrus)", kind: "subdivision", parent: "parietal-lobe", meshKeys: ["inferiorparietal"],
    aliases: ["inferior parietal", "inferior parietal lobule", "angular gyrus"],
    overview: "The lower back part of the parietal lobe, including the angular gyrus, where several kinds of information meet.",
    commonlyStudiedIn: ["reading", "math facts", "memory retrieval", "attention"], caution: DK_CAUTION, searchQuery: "angular gyrus",
  },
  {
    id: "supramarginal-gyrus", name: "Supramarginal gyrus", kind: "subdivision", parent: "parietal-lobe", meshKeys: ["supramarginal"],
    aliases: ["supramarginal gyrus", "supramarginal"],
    overview: "Part of the inferior parietal lobule, curving around the end of the lateral fissure.",
    commonlyStudiedIn: ["speech sounds", "using tools", "understanding others' perspectives"], caution: DK_CAUTION, searchQuery: "supramarginal gyrus",
  },
  {
    id: "precuneus", name: "Precuneus", kind: "subdivision", parent: "parietal-lobe", meshKeys: ["precuneus"],
    aliases: ["precuneus"],
    overview: "On the inner surface of the parietal lobe. It is a central part of the default mode network, which is active during rest and inward-focused thought.",
    commonlyStudiedIn: ["remembering personal events", "imagining", "self-reflection", "mind-wandering"], caution: DK_CAUTION, searchQuery: "precuneus",
  },

  // ───────────────────── Temporal subdivisions ─────────────────────
  {
    id: "superior-temporal-gyrus", name: "Superior temporal gyrus", kind: "subdivision", parent: "temporal-lobe", meshKeys: ["superiortemporal"],
    aliases: ["superior temporal gyrus", "superior temporal", "stg", "wernicke", "wernicke's area"],
    overview: "The top fold of the temporal lobe. It contains auditory association cortex, and its back part on the left is often linked with Wernicke's area.",
    commonlyStudiedIn: ["processing sounds", "understanding speech", "social perception"], caution: DK_CAUTION, searchQuery: "superior temporal gyrus",
  },
  {
    id: "transverse-temporal", name: "Transverse temporal gyrus (primary auditory cortex)", kind: "subdivision", parent: "temporal-lobe", meshKeys: ["transversetemporal"],
    aliases: ["transverse temporal", "heschl", "heschl's gyrus", "primary auditory cortex", "auditory cortex"],
    overview: "Heschl's gyrus, a small fold hidden in the lateral fissure. It contains primary auditory cortex, the first cortical stop for sound.",
    commonlyStudiedIn: ["hearing", "pitch", "music"], caution: DK_CAUTION, searchQuery: "primary auditory cortex Heschl",
  },
  {
    id: "banks-sts", name: "Banks of the superior temporal sulcus", kind: "subdivision", parent: "temporal-lobe", meshKeys: ["bankssts"],
    aliases: ["superior temporal sulcus", "sts", "bankssts"],
    overview: "The walls of the groove between the superior and middle temporal gyri.",
    commonlyStudiedIn: ["perceiving faces and gaze", "biological motion", "voices"], caution: DK_CAUTION, searchQuery: "superior temporal sulcus",
  },
  {
    id: "middle-temporal-gyrus", name: "Middle temporal gyrus", kind: "subdivision", parent: "temporal-lobe", meshKeys: ["middletemporal"],
    aliases: ["middle temporal gyrus", "middle temporal"],
    overview: "The middle fold on the side of the temporal lobe.",
    commonlyStudiedIn: ["word meaning", "semantic memory", "visual motion (back part)"], caution: DK_CAUTION, searchQuery: "middle temporal gyrus",
  },
  {
    id: "inferior-temporal-gyrus", name: "Inferior temporal gyrus", kind: "subdivision", parent: "temporal-lobe", meshKeys: ["inferiortemporal"],
    aliases: ["inferior temporal gyrus", "inferior temporal cortex", "inferior temporal"],
    overview: "The lowest fold on the side of the temporal lobe, part of the visual 'what' pathway.",
    commonlyStudiedIn: ["recognizing objects", "visual memory"], caution: DK_CAUTION, searchQuery: "inferior temporal cortex",
  },
  {
    id: "fusiform-gyrus", name: "Fusiform gyrus", kind: "subdivision", parent: "temporal-lobe", meshKeys: ["fusiform"],
    aliases: ["fusiform", "fusiform gyrus", "fusiform face area", "ffa", "visual word form area"],
    overview: "On the underside of the temporal and occipital lobes. It contains areas that respond strongly to faces and to written words.",
    commonlyStudiedIn: ["face recognition", "reading", "recognizing objects"], caution: DK_CAUTION, searchQuery: "fusiform gyrus",
  },
  {
    id: "entorhinal-cortex", name: "Entorhinal cortex", kind: "subdivision", parent: "temporal-lobe", meshKeys: ["entorhinal"],
    aliases: ["entorhinal", "entorhinal cortex"],
    overview: "On the inner temporal lobe, next to the hippocampus. It is the main gateway between the hippocampus and the rest of the cortex.",
    commonlyStudiedIn: ["memory", "navigation (grid cells)", "early Alzheimer's changes"], caution: DK_CAUTION, searchQuery: "entorhinal cortex",
  },
  {
    id: "parahippocampal-gyrus", name: "Parahippocampal gyrus", kind: "subdivision", parent: "temporal-lobe", meshKeys: ["parahippocampal"],
    aliases: ["parahippocampal", "parahippocampal gyrus", "parahippocampal place area"],
    overview: "A fold on the inner temporal lobe that surrounds the hippocampus.",
    commonlyStudiedIn: ["memory for places and scenes", "navigation"], caution: DK_CAUTION, searchQuery: "parahippocampal gyrus",
  },
  {
    id: "temporal-pole", name: "Temporal pole", kind: "subdivision", parent: "temporal-lobe", meshKeys: ["temporalpole"],
    aliases: ["temporal pole", "anterior temporal lobe"],
    overview: "The front tip of the temporal lobe.",
    commonlyStudiedIn: ["knowledge about concepts and people", "social and emotional processing"], caution: DK_CAUTION, searchQuery: "temporal pole",
  },

  // ───────────────────── Occipital subdivisions ─────────────────────
  {
    id: "pericalcarine", name: "Pericalcarine cortex (primary visual cortex)", kind: "subdivision", parent: "occipital-lobe", meshKeys: ["pericalcarine"],
    aliases: ["pericalcarine", "calcarine", "primary visual cortex", "v1", "striate cortex"],
    overview: "Cortex along the calcarine sulcus, on the inner back surface. It contains primary visual cortex (V1), the first cortical stop for visual information.",
    commonlyStudiedIn: ["basic vision (edges, contrast)", "visual development"], caution: DK_CAUTION, searchQuery: "primary visual cortex",
  },
  {
    id: "cuneus", name: "Cuneus", kind: "subdivision", parent: "occipital-lobe", meshKeys: ["cuneus"],
    aliases: ["cuneus"],
    overview: "A wedge of the inner occipital lobe, above the calcarine sulcus.",
    commonlyStudiedIn: ["basic visual processing"], caution: DK_CAUTION, searchQuery: "cuneus",
  },
  {
    id: "lingual-gyrus", name: "Lingual gyrus", kind: "subdivision", parent: "occipital-lobe", meshKeys: ["lingual"],
    aliases: ["lingual gyrus", "lingual"],
    overview: "Below the calcarine sulcus, on the inner underside of the occipital lobe.",
    commonlyStudiedIn: ["visual processing", "color", "visual memory"], caution: DK_CAUTION, searchQuery: "lingual gyrus",
  },
  {
    id: "lateral-occipital", name: "Lateral occipital cortex", kind: "subdivision", parent: "occipital-lobe", meshKeys: ["lateraloccipital"],
    aliases: ["lateral occipital", "lateral occipital cortex", "lateral occipital complex"],
    overview: "The outer surface of the occipital lobe, involved in recognizing object shapes.",
    commonlyStudiedIn: ["recognizing objects", "visual motion"], caution: DK_CAUTION, searchQuery: "lateral occipital complex",
  },

  // ───────────────────── Cingulate subdivisions ─────────────────────
  {
    id: "rostral-anterior-cingulate", name: "Rostral anterior cingulate", kind: "subdivision", parent: "anterior-cingulate", meshKeys: ["rostralanteriorcingulate"],
    aliases: ["rostral anterior cingulate", "pregenual", "subgenual", "pregenual anterior cingulate"],
    overview: "The front-most part of the cingulate, below and in front of the knee of the corpus callosum.",
    commonlyStudiedIn: ["emotion", "mood", "regulating stress responses"], caution: DK_CAUTION, searchQuery: "rostral anterior cingulate",
  },
  {
    id: "caudal-anterior-cingulate", name: "Caudal (dorsal) anterior cingulate", kind: "subdivision", parent: "anterior-cingulate", meshKeys: ["caudalanteriorcingulate"],
    aliases: ["caudal anterior cingulate", "dorsal anterior cingulate", "dacc"],
    overview: "The upper back part of the anterior cingulate.",
    commonlyStudiedIn: ["noticing errors and conflict", "effort", "pain"], caution: DK_CAUTION, searchQuery: "dorsal anterior cingulate cortex",
  },
  {
    id: "posterior-cingulate", name: "Posterior cingulate", kind: "subdivision", parent: "cingulate-cortex", meshKeys: ["posteriorcingulate"],
    aliases: ["posterior cingulate", "pcc"],
    overview: "The middle-back part of the cingulate, a core hub of the default mode network.",
    commonlyStudiedIn: ["mind-wandering", "memory", "self-related thinking"], caution: DK_CAUTION, searchQuery: "posterior cingulate cortex",
  },
  {
    id: "isthmus-cingulate", name: "Isthmus cingulate (retrosplenial)", kind: "subdivision", parent: "cingulate-cortex", meshKeys: ["isthmuscingulate"],
    aliases: ["isthmus cingulate", "retrosplenial", "retrosplenial cortex"],
    overview: "The narrow back end of the cingulate, curving behind the corpus callosum; overlaps retrosplenial cortex.",
    commonlyStudiedIn: ["navigation", "memory for places"], caution: DK_CAUTION, searchQuery: "retrosplenial cortex",
  },

  // ───────────────────── Deep structures ─────────────────────
  {
    id: "hippocampus", name: "Hippocampus", kind: "deep-structure", meshKeys: ["hippocampus"],
    aliases: ["hippocampus", "hippocampal", "hippocampi", "dentate gyrus", "ca1", "ca3"],
    overview: "A curved structure inside the medial temporal lobe of each hemisphere. Classic patient studies (such as patient H.M.) linked it to forming new long-term memories.",
    commonlyStudiedIn: ["forming memories", "navigation", "memory consolidation during sleep", "stress effects"],
    caution: "The hippocampus works with surrounding cortex; memories are not stored in one place.", searchQuery: "hippocampus",
  },
  {
    id: "amygdala", name: "Amygdala", kind: "deep-structure", meshKeys: ["amygdala"],
    aliases: ["amygdala", "amygdalae", "amygdalar", "basolateral amygdala"],
    overview: "An almond-shaped group of nuclei in the medial temporal lobe, in front of the hippocampus.",
    commonlyStudiedIn: ["threat and fear learning", "emotional memory", "social cues"],
    caution: "Calling the amygdala the brain's 'fear center' oversimplifies it; it responds to many kinds of important or surprising information.", searchQuery: "amygdala",
  },
  {
    id: "thalamus", name: "Thalamus", kind: "deep-structure", meshKeys: ["thalamus"],
    aliases: ["thalamus", "thalamic", "pulvinar"],
    overview: "A paired structure near the center of the brain made of many nuclei. Most sensory signals pass through it on the way to the cortex.",
    commonlyStudiedIn: ["relaying sensory signals", "attention", "sleep and alertness"],
    caution: "Different thalamic nuclei have very different connections and roles.", searchQuery: "thalamus",
  },
  {
    id: "caudate", name: "Caudate nucleus", kind: "subdivision", parent: "basal-ganglia", meshKeys: ["caudate"],
    aliases: ["caudate", "caudate nucleus"],
    overview: "A C-shaped nucleus of the basal ganglia, curving alongside the lateral ventricle.",
    commonlyStudiedIn: ["goal-directed learning", "feedback and reward", "habits"], caution: NETWORK_CAUTION, searchQuery: "caudate nucleus",
  },
  {
    id: "putamen", name: "Putamen", kind: "subdivision", parent: "basal-ganglia", meshKeys: ["putamen"],
    aliases: ["putamen"],
    overview: "A large rounded nucleus of the basal ganglia, just inside the insula.",
    commonlyStudiedIn: ["movement", "learning motor skills", "habits"], caution: NETWORK_CAUTION, searchQuery: "putamen",
  },
  {
    id: "globus-pallidus", name: "Globus pallidus", kind: "subdivision", parent: "basal-ganglia", meshKeys: ["pallidum"],
    aliases: ["globus pallidus", "pallidum", "pallidal"],
    overview: "A basal ganglia nucleus inside the putamen; a major output station of basal ganglia circuits.",
    commonlyStudiedIn: ["movement control", "Parkinson's disease treatment"], caution: NETWORK_CAUTION, searchQuery: "globus pallidus",
  },
  {
    id: "nucleus-accumbens", name: "Nucleus accumbens", kind: "subdivision", parent: "basal-ganglia", meshKeys: ["nucleus-accumbens"],
    aliases: ["nucleus accumbens", "accumbens", "ventral striatum"],
    overview: "Part of the ventral striatum, where the caudate and putamen meet. It receives dopamine signals from the midbrain.",
    commonlyStudiedIn: ["reward and motivation", "anticipating rewards", "adolescent risk-taking"],
    caution: "Activity here is often described as 'pleasure', but research links it more to motivation and learning from rewards.", searchQuery: "nucleus accumbens",
  },
  {
    id: "ventral-diencephalon", name: "Ventral diencephalon", kind: "deep-structure", meshKeys: ["ventral-diencephalon"],
    aliases: ["ventral diencephalon", "ventral dc"],
    overview: "An atlas label for a group of structures below the thalamus, including the hypothalamus and nearby nuclei. It is a grouping used in brain-scan software, not a single structure.",
    commonlyStudiedIn: ["hormone control (via the hypothalamus)", "sleep–wake regulation"], caution: "This label combines several small structures that standard MRI cannot separate well.", searchQuery: "hypothalamus",
  },
  {
    id: "corpus-callosum", name: "Corpus callosum", kind: "deep-structure", meshKeys: ["corpus-callosum"],
    aliases: ["corpus callosum", "callosal"],
    overview: "The largest bundle of nerve fibers (white matter) in the brain, connecting the left and right hemispheres.",
    commonlyStudiedIn: ["communication between hemispheres", "white-matter development"], caution: "It is made of connecting fibers, not a processing center.", searchQuery: "corpus callosum",
  },
  {
    id: "cerebellum", name: "Cerebellum", kind: "hindbrain", meshKeys: ["cerebellum"],
    aliases: ["cerebellum", "cerebellar"],
    overview: "A large, tightly folded structure at the back of the brain, under the occipital lobes. It contains more neurons than the rest of the brain combined.",
    commonlyStudiedIn: ["coordination", "balance", "motor learning", "timing"],
    caution: "Evidence for cerebellar roles in thinking and emotion is growing but still debated.", searchQuery: "cerebellum",
  },
  {
    id: "brainstem", name: "Brainstem", kind: "hindbrain", meshKeys: ["brainstem"],
    aliases: ["brainstem", "brain stem", "medulla", "pons", "midbrain"],
    overview: "Connects the brain to the spinal cord and includes the midbrain, pons and medulla.",
    commonlyStudiedIn: ["breathing and heart rate", "sleep–wake regulation", "alertness"],
    caution: "Small brainstem nuclei are difficult to image reliably with standard MRI.", searchQuery: "brainstem",
  },

  // ───────────── Hormone-related glands (approximate markers, not atlas meshes) ─────────────
  {
    id: "hypothalamus", name: "Hypothalamus", kind: "marker", parent: "ventral-diencephalon", marker: mm(0, -6, -10),
    aliases: ["hypothalamus", "hypothalamic"],
    overview: "A small region below the thalamus that links the nervous system to the hormone system, mainly by controlling the pituitary gland.",
    commonlyStudiedIn: ["stress hormones (HPA axis)", "puberty", "hunger and body temperature", "sleep timing"],
    caution: "Shown as an approximate marker; it is too small to outline on this model.", searchQuery: "hypothalamus",
  },
  {
    id: "pituitary-gland", name: "Pituitary gland", kind: "marker", parent: "ventral-diencephalon", marker: mm(0, 0, -34),
    aliases: ["pituitary", "pituitary gland"],
    overview: "A pea-sized gland under the hypothalamus that releases hormones controlling growth, stress responses (via ACTH) and puberty (via LH and FSH).",
    commonlyStudiedIn: ["growth", "stress responses", "puberty"],
    caution: "Approximate marker: the pituitary sits outside the brain tissue, below it.", searchQuery: "pituitary gland",
  },
  {
    id: "pineal-gland", name: "Pineal gland", kind: "marker", marker: mm(0, -33, 2),
    aliases: ["pineal", "pineal gland"],
    overview: "A tiny gland near the center of the brain that releases melatonin, mostly at night.",
    commonlyStudiedIn: ["melatonin", "sleep timing", "effects of evening light"],
    caution: "Shown as an approximate marker.", searchQuery: "pineal melatonin",
  },
];

export const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]));

/** Broad areas shown at the top level of the region picker. */
export const TOP_LEVEL = REGIONS.filter((r) => !r.parent || r.kind === "cortical-area").filter((r) => r.kind !== "subdivision" && r.kind !== "marker");

export function childrenOf(id: string): BrainRegion[] {
  return REGIONS.filter((r) => r.parent === id);
}

/** All descendants (children, grandchildren, …). */
export function descendantsOf(id: string): BrainRegion[] {
  const out: BrainRegion[] = [];
  for (const c of childrenOf(id)) out.push(c, ...descendantsOf(c.id));
  return out;
}

/** Atlas mesh keys that draw a region, including all its subdivisions. */
export function meshKeysOf(id: string): string[] {
  const r = REGION_BY_ID.get(id);
  if (!r) return [];
  return [...new Set([...(r.meshKeys ?? []), ...descendantsOf(id).flatMap((d) => d.meshKeys ?? [])])];
}

/** The most specific region that owns a mesh key. */
export function regionForMeshKey(key: string): BrainRegion | undefined {
  return REGIONS.find((r) => r.meshKeys?.includes(key));
}

/** Find regions mentioned in free text (word-boundary match, case-insensitive). */
export function findRegionMentions(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  for (const region of REGIONS) {
    const hit = region.aliases.some((alias) => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(lower);
    });
    if (hit) found.push(region.id);
  }
  return found;
}
