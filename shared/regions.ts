// Brain-region dictionary.
//
// The descriptions below are short, textbook-level overviews written for this
// app. They are deliberately conservative: brain functions are distributed
// across networks, and no region "does" one thing on its own. They are NOT
// derived from a specific study — the UI labels them "General overview" and
// links users to the research library for evidence.
//
// `aliases` drive keyword detection in abstracts. A region being *mentioned*
// in an abstract does not mean the study found anything about it.

export type RegionKind = "lobe" | "cortical-area" | "deep-structure" | "hindbrain";

export interface BrainRegion {
  id: string;
  name: string;
  kind: RegionKind;
  aliases: string[];
  overview: string;
  commonlyStudiedIn: string[];
  caution: string;
  /** Search query used for "Find research on this region". */
  searchQuery: string;
}

export const REGIONS: BrainRegion[] = [
  {
    id: "frontal-lobe",
    name: "Frontal lobe",
    kind: "lobe",
    aliases: ["frontal lobe", "frontal cortex", "frontal lobes"],
    overview:
      "The largest lobe, at the front of each hemisphere. It contains primary motor cortex, premotor areas, Broca's area (typically in the left hemisphere) and prefrontal cortex.",
    commonlyStudiedIn: ["movement planning", "language production", "decision-making", "executive function"],
    caution: "Frontal regions work within networks that span the whole brain; damage or activation here rarely maps onto a single ability.",
    searchQuery: "frontal lobe",
  },
  {
    id: "prefrontal-cortex",
    name: "Prefrontal cortex",
    kind: "cortical-area",
    aliases: ["prefrontal cortex", "prefrontal", "dlpfc", "dorsolateral prefrontal", "ventromedial prefrontal", "vmpfc", "orbitofrontal cortex", "orbitofrontal"],
    overview:
      "The front-most part of the frontal lobe, with several subdivisions (e.g., dorsolateral, ventromedial, orbitofrontal). It matures relatively late, continuing to develop into early adulthood.",
    commonlyStudiedIn: ["working memory", "attention control", "planning", "emotion regulation"],
    caution: "Different prefrontal subregions are associated with different processes; findings for one subregion should not be generalized to the whole area.",
    searchQuery: "prefrontal cortex",
  },
  {
    id: "parietal-lobe",
    name: "Parietal lobe",
    kind: "lobe",
    aliases: ["parietal lobe", "parietal cortex", "posterior parietal", "intraparietal", "precuneus"],
    overview:
      "Located behind the frontal lobe. It contains primary somatosensory cortex and posterior parietal areas involved in integrating sensory information.",
    commonlyStudiedIn: ["touch and body sensation", "spatial attention", "numerical cognition"],
    caution: "Parietal activation appears in many tasks; on its own it does not identify which mental process was engaged.",
    searchQuery: "parietal cortex",
  },
  {
    id: "temporal-lobe",
    name: "Temporal lobe",
    kind: "lobe",
    aliases: ["temporal lobe", "temporal cortex", "superior temporal", "medial temporal lobe", "temporal lobes"],
    overview:
      "Located on the side of each hemisphere, below the lateral (Sylvian) fissure. It contains primary auditory cortex, and its medial portion includes the hippocampus and amygdala.",
    commonlyStudiedIn: ["hearing", "language comprehension", "memory", "object and face recognition"],
    caution: "The lateral and medial temporal lobe are associated with quite different functions.",
    searchQuery: "temporal lobe",
  },
  {
    id: "occipital-lobe",
    name: "Occipital lobe",
    kind: "lobe",
    aliases: ["occipital lobe", "occipital cortex", "visual cortex", "primary visual cortex", "v1"],
    overview:
      "The rear-most lobe. It contains primary visual cortex and other areas that process visual input.",
    commonlyStudiedIn: ["visual perception", "visual attention"],
    caution: "Visual processing continues well beyond the occipital lobe into temporal and parietal areas.",
    searchQuery: "occipital cortex visual",
  },
  {
    id: "insula",
    name: "Insula",
    kind: "cortical-area",
    aliases: ["insula", "insular cortex", "anterior insula"],
    overview: "Cortex folded deep within the lateral fissure, hidden beneath the frontal, parietal and temporal lobes.",
    commonlyStudiedIn: ["interoception (sensing internal body states)", "taste", "emotion", "salience"],
    caution: "The insula is active across a very wide range of tasks, which makes its activation hard to interpret on its own.",
    searchQuery: "insula insular cortex",
  },
  {
    id: "anterior-cingulate",
    name: "Anterior cingulate cortex",
    kind: "cortical-area",
    aliases: ["anterior cingulate", "cingulate cortex", "acc", "cingulate"],
    overview: "Part of the medial surface of the frontal lobe, wrapping around the front of the corpus callosum.",
    commonlyStudiedIn: ["error monitoring", "conflict detection", "pain", "emotion"],
    caution: "Theories of anterior cingulate function remain actively debated.",
    searchQuery: "anterior cingulate cortex",
  },
  {
    id: "hippocampus",
    name: "Hippocampus",
    kind: "deep-structure",
    aliases: ["hippocampus", "hippocampal", "hippocampi", "dentate gyrus", "ca1", "ca3"],
    overview:
      "A curved structure in the medial temporal lobe of each hemisphere. Classic patient studies (such as patient H.M.) linked it to forming new long-term memories.",
    commonlyStudiedIn: ["episodic memory", "spatial navigation", "memory consolidation during sleep", "stress effects"],
    caution: "The hippocampus works with surrounding cortex; memory is not stored in one place.",
    searchQuery: "hippocampus",
  },
  {
    id: "amygdala",
    name: "Amygdala",
    kind: "deep-structure",
    aliases: ["amygdala", "amygdalae", "amygdalar", "basolateral amygdala"],
    overview: "An almond-shaped group of nuclei in the medial temporal lobe, in front of the hippocampus.",
    commonlyStudiedIn: ["threat and fear learning", "emotional memory", "social perception"],
    caution: "Describing the amygdala as the brain's 'fear center' is an oversimplification; it is involved in processing many kinds of salient information.",
    searchQuery: "amygdala",
  },
  {
    id: "thalamus",
    name: "Thalamus",
    kind: "deep-structure",
    aliases: ["thalamus", "thalamic", "pulvinar"],
    overview: "A paired structure near the center of the brain made of many nuclei. Most sensory pathways pass through it on their way to cortex.",
    commonlyStudiedIn: ["sensory relay", "attention", "sleep and arousal"],
    caution: "Different thalamic nuclei have very different connections and roles.",
    searchQuery: "thalamus",
  },
  {
    id: "basal-ganglia",
    name: "Basal ganglia",
    kind: "deep-structure",
    aliases: ["basal ganglia", "striatum", "caudate", "putamen", "nucleus accumbens", "globus pallidus", "striatal"],
    overview: "A group of deep nuclei (including the caudate, putamen and globus pallidus) connected in loops with cortex and thalamus.",
    commonlyStudiedIn: ["movement control", "habit learning", "reward processing"],
    caution: "Reward-related findings are often about specific subregions such as the nucleus accumbens, not the basal ganglia as a whole.",
    searchQuery: "basal ganglia striatum",
  },
  {
    id: "cerebellum",
    name: "Cerebellum",
    kind: "hindbrain",
    aliases: ["cerebellum", "cerebellar"],
    overview: "A large, densely folded structure at the back of the brain, beneath the occipital lobes. It contains more neurons than the rest of the brain combined.",
    commonlyStudiedIn: ["motor coordination", "balance", "motor learning", "timing"],
    caution: "Evidence for cerebellar roles in cognition is growing but still debated.",
    searchQuery: "cerebellum",
  },
  {
    id: "brainstem",
    name: "Brainstem",
    kind: "hindbrain",
    aliases: ["brainstem", "brain stem", "medulla", "pons", "midbrain"],
    overview: "Connects the brain to the spinal cord and includes the midbrain, pons and medulla.",
    commonlyStudiedIn: ["breathing and heart rate", "sleep–wake regulation", "arousal"],
    caution: "Small brainstem nuclei are difficult to image reliably with standard MRI.",
    searchQuery: "brainstem",
  },
];

export const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]));

/** Find regions mentioned in free text (word-boundary match, case-insensitive). */
export function findRegionMentions(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found: string[] = [];
  for (const region of REGIONS) {
    const hit = region.aliases.some((alias) => {
      // Short abbreviations (acc, v1, ca1) need strict boundaries to avoid false matches.
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(lower);
    });
    if (hit) found.push(region.id);
  }
  return found;
}
