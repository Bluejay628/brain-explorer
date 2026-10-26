// Links the app's brain regions to the tissue samples ("dissections") of the
// Allen Brain Cell Atlas human whole-brain dataset (Siletti et al., 2023), as
// stored in public/data/cell-atlas.json (built by scripts/build-cell-atlas.py).
//
// The study cut small pieces of tissue from named anatomical areas. Our 3D
// model uses a different atlas (Desikan-Killiany + FreeSurfer structures), so
// this table is a hand-made, APPROXIMATE match by anatomical name. A region is
// only linked when a sample clearly comes from inside it; regions without a
// clear match have no cell data (the UI says so) rather than a guess.

export interface CellAtlasRoi {
  label: string;
  division: string;
  structures: { symbol: string; name: string; id: string }[];
  cells: number;
  donors: number;
  /** Supercluster index (as string) → number of sampled nuclei. */
  superclusters: Record<string, number>;
  /** Neurotransmitter label (e.g. "VGLUT1", "GABA", "None") → number of sampled nuclei. */
  neurotransmitters: Record<string, number>;
}

export interface CellAtlasFile {
  source: { name: string; citation: string; doi: string; url: string; files: string[]; donors: Record<string, string>[]; built: string };
  totalCells: number;
  superclusters: { name: string; color: string; cells: number }[];
  rois: CellAtlasRoi[];
  points: { sampleEvery: number; count: number; x: string; y: string; supercluster: string; roi: string };
}

const DIVISION = (name: string) => `division:${name}`;

/**
 * App region id → dissection labels (or whole anatomical divisions, written
 * "division:<name>"). Larger areas (lobes) list the samples of their parts.
 */
export const REGION_SAMPLES: Record<string, string[]> = {
  // Whole structures
  hippocampus: [DIVISION("Hippocampus")],
  amygdala: [DIVISION("Amygdaloid complex")],
  thalamus: ["Human ANC", "Human CM", "Human CM-Pf", "Human ETH", "Human LG", "Human LP", "Human LP-VPL", "Human MD", "Human MD-Re", "Human MG", "Human Pul", "Human VA", "Human VLN", "Human VPL"],
  hypothalamus: [DIVISION("Hypothalamus")],
  cerebellum: [DIVISION("Cerebellum")],
  brainstem: [DIVISION("Midbrain"), DIVISION("Pons"), DIVISION("Myelencephalon")],
  "basal-ganglia": [DIVISION("Basal nuclei")],
  caudate: ["Human CaB"],
  putamen: ["Human Pu"],
  "globus-pallidus": ["Human GPe", "Human GPi"],
  "nucleus-accumbens": ["Human NAC"],

  // Cortex: samples taken from inside one atlas region
  "precentral-gyrus": ["Human M1C"],
  "postcentral-gyrus": ["Human S1C"],
  pericalcarine: ["Human V1C"],
  "transverse-temporal": ["Human A1C"],
  "superior-temporal-gyrus": ["Human STG"],
  "middle-temporal-gyrus": ["Human MTG"],
  "inferior-temporal-gyrus": ["Human ITG"],
  "temporal-pole": ["Human A38"],
  "entorhinal-cortex": ["Human LEC", "Human MEC"],
  "parahippocampal-gyrus": ["Human TH-TL", "Human TF"],
  "pars-opercularis": ["Human A44-A45"],
  "pars-triangularis": ["Human A44-A45"],
  "rostral-middle-frontal": ["Human A46"],
  "supramarginal-gyrus": ["Human A40"],
  "superior-parietal": ["Human A5-A7"],
  "lateral-orbitofrontal": ["Human A13"],
  "medial-orbitofrontal": ["Human A14"],
  "posterior-cingulate": ["Human A23"],
  "isthmus-cingulate": ["Human A29-A30"],
  insula: ["Human FI", "Human Idg", "Human Ig"],
  "anterior-cingulate": ["Human ACC", "Human A32"],

  // Larger areas: their parts' samples, plus samples that only fit the larger area
  "frontal-lobe": ["Human M1C", "Human A46", "Human A44-A45", "Human A13", "Human A14"],
  "prefrontal-cortex": ["Human A46", "Human A44-A45", "Human A13", "Human A14"],
  "parietal-lobe": ["Human S1C", "Human A40", "Human A5-A7"],
  "temporal-lobe": ["Human A1C", "Human STG", "Human MTG", "Human ITG", "Human A38", "Human LEC", "Human MEC", "Human TH-TL", "Human TF", "Human A35-A36", "Human A35r"],
  "occipital-lobe": ["Human V1C", "Human V2", "Human A19", "Human Pro"],
  "cingulate-cortex": ["Human ACC", "Human A32", "Human A23", "Human A29-A30"],
};

/** The dissections (from the data file) that belong to a region, or [] if none match. */
export function samplesFor(regionId: string, rois: CellAtlasRoi[]): CellAtlasRoi[] {
  const wanted = REGION_SAMPLES[regionId];
  if (!wanted) return [];
  return rois.filter((r) => wanted.includes(r.label) || wanted.includes(DIVISION(r.division)));
}

/** Combine several dissections into one set of counts. */
export function combineSamples(rois: CellAtlasRoi[]) {
  const superclusters = new Map<number, number>();
  const neurotransmitters = new Map<string, number>();
  let cells = 0;
  for (const r of rois) {
    cells += r.cells;
    for (const [k, v] of Object.entries(r.superclusters)) superclusters.set(Number(k), (superclusters.get(Number(k)) ?? 0) + v);
    for (const [k, v] of Object.entries(r.neurotransmitters)) neurotransmitters.set(k, (neurotransmitters.get(k) ?? 0) + v);
  }
  return { cells, superclusters, neurotransmitters };
}

/** Plain-language names for the neurotransmitter labels used in the taxonomy. */
export const NEUROTRANSMITTER_LABEL: Record<string, string> = {
  VGLUT1: "Glutamate (excitatory)",
  VGLUT2: "Glutamate (excitatory)",
  VGLUT3: "Glutamate (excitatory)",
  GABA: "GABA (inhibitory)",
  GLY: "Glycine (inhibitory)",
  CHOL: "Acetylcholine",
  DA: "Dopamine",
  SER: "Serotonin",
  HDC: "Histamine",
  None: "No neurotransmitter genes (mostly support cells)",
};

/** Group a taxonomy label like "GABA VGLUT2" under each plain-language name it contains. */
export function groupNeurotransmitters(counts: Map<string, number>): { name: string; cells: number }[] {
  const out = new Map<string, number>();
  for (const [label, n] of counts) {
    const names = new Set(label.split(" ").map((t) => NEUROTRANSMITTER_LABEL[t] ?? t));
    for (const name of names) out.set(name, (out.get(name) ?? 0) + n);
  }
  return [...out].map(([name, cells]) => ({ name, cells })).sort((a, b) => b.cells - a.cells);
}

/** Superclusters that are not neurons (support cells), by taxonomy name. */
export const NON_NEURONAL = new Set([
  "Oligodendrocyte", "Committed oligodendrocyte precursor", "Oligodendrocyte precursor", "Astrocyte", "Ependymal",
  "Microglia", "Vascular", "Bergmann glia", "Fibroblast", "Choroid plexus",
]);

/**
 * Short textbook background for well-known cell types (general knowledge written
 * for this app, not findings of the dataset). Types without an entry show only
 * their taxonomy name.
 */
export const CELL_TYPE_NOTE: Record<string, string> = {
  Oligodendrocyte: "Support cell that wraps nerve fibers in myelin, which speeds up signals.",
  "Oligodendrocyte precursor": "Support cell that can become a new oligodendrocyte.",
  "Committed oligodendrocyte precursor": "A precursor cell on its way to becoming an oligodendrocyte.",
  Astrocyte: "Star-shaped support cell that feeds neurons and helps control the chemicals around synapses.",
  Microglia: "The brain's immune cell; it clears debris and responds to injury.",
  Ependymal: "Cell lining the fluid-filled ventricles of the brain.",
  Vascular: "Cells of the brain's blood vessels.",
  "Bergmann glia": "Specialized support cell of the cerebellum.",
  Fibroblast: "Connective-tissue cell, mostly in the brain's protective membranes.",
  "Choroid plexus": "Cell of the choroid plexus, which makes cerebrospinal fluid.",
  "Medium spiny neuron": "Inhibitory neuron that makes up most of the striatum (caudate, putamen, accumbens).",
  "Upper-layer intratelencephalic": "Excitatory cortex neuron in the upper layers that connects cortical areas.",
  "Deep-layer intratelencephalic": "Excitatory cortex neuron in the deeper layers that connects cortical areas.",
  "MGE interneuron": "Inhibitory cortex interneuron born in the medial ganglionic eminence (e.g. PVALB, SST types).",
  "CGE interneuron": "Inhibitory cortex interneuron born in the caudal ganglionic eminence (e.g. VIP types).",
  "Hippocampal dentate gyrus": "Granule neuron of the dentate gyrus, the hippocampus's input zone.",
  "Thalamic excitatory": "Excitatory neuron of the thalamus, which relays signals to the cortex.",
};
