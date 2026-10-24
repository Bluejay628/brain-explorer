// Shared data shapes used by BOTH the server and the browser.
//
// Scientific-integrity rule baked into these types: every field that is not
// copied directly from the publisher/PubMed is marked with how it was derived,
// so the UI can show users the difference between "the source says X" and
// "this app inferred X".

/** How a piece of information was obtained. */
export type Provenance =
  | "source" // copied verbatim from PubMed / the publisher record
  | "pubmed-indexing" // assigned by NLM indexers (MeSH terms, publication types)
  | "keyword-derived" // detected by this app's keyword rules — may be wrong
  | "ai-summary"; // written by the AI from the abstract — interpretation, not a finding

export interface Derived<T> {
  value: T;
  provenance: Provenance;
  /** Human-readable explanation of how it was derived. */
  note?: string;
}

/** Broad publication category, from PubMed's PublicationType field. */
export type PublicationCategory =
  | "meta-analysis"
  | "systematic-review"
  | "review"
  | "randomized-controlled-trial"
  | "clinical-trial"
  | "original-research"
  | "case-report"
  | "editorial-or-comment"
  | "other";

/** Kind of evidence / method, detected from MeSH terms and abstract keywords. */
export type EvidenceMethod =
  | "functional-mri"
  | "structural-mri"
  | "diffusion-connectivity"
  | "functional-connectivity"
  | "eeg-meg"
  | "pet"
  | "lesion"
  | "brain-stimulation"
  | "behavioral"
  | "animal-model"
  | "computational";

export type AgeGroup = "child" | "adolescent" | "young-adult" | "adult" | "middle-aged" | "older-adult";

export interface Author {
  lastName?: string;
  foreName?: string;
  collective?: string;
}

export interface AbstractSection {
  label?: string; // e.g. "METHODS", "RESULTS" when the abstract is structured
  text: string;
}

export interface ResearchRecord {
  /** Stable internal ID, e.g. "pmid:12345678". */
  id: string;
  pmid?: string;
  doi?: string;
  pmcid?: string;
  title: string;
  authors: Author[];
  journal?: string;
  /** Publication date as reported (may be partial, e.g. "2021 Mar"). */
  publicationDate?: string;
  publicationYear?: number;
  abstract: AbstractSection[];
  /** Raw PubMed publication types, e.g. ["Journal Article", "Review"]. */
  publicationTypes: string[];
  category: Derived<PublicationCategory>;
  methods: Derived<EvidenceMethod[]>;
  /** Species studied, from MeSH ("Humans", "Mice", ...). */
  species: Derived<string[]>;
  ageGroups: Derived<AgeGroup[]>;
  /** Sample size auto-extracted from the abstract, if a clear statement exists. */
  sampleSize?: Derived<number>;
  meshTerms: string[];
  keywords: string[];
  /** Brain regions whose names appear in the title/abstract (mention ≠ finding). */
  regionsMentioned: Derived<string[]>;
  /** Abstract sections labelled RESULTS/FINDINGS/CONCLUSIONS, verbatim. */
  reportedFindings?: Derived<string>;
  /** Limitations stated in the abstract, verbatim, when present. */
  reportedLimitations?: Derived<string>;
  sourceUrl: string;
  doiUrl?: string;
  source: "pubmed";
  retrievedAt: string; // ISO timestamp
  verification: VerificationStatus;
}

export type VerificationStatus =
  | "retrieved-from-pubmed" // fetched live from NCBI E-utilities and parsed
  | "manually-reviewed"; // a human checked this record against the original paper

/** Filters a user can apply in the Research Library. */
export interface SearchFilters {
  yearFrom?: number;
  yearTo?: number;
  categories?: PublicationCategory[];
  methods?: EvidenceMethod[];
  ageGroups?: AgeGroup[];
  humansOnly?: boolean;
}

export interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  /** Also query PubMed live (otherwise local library only). */
  includePubMed?: boolean;
  limit?: number;
}

export interface SourceCoverage {
  source: "local-library" | "pubmed";
  searched: boolean;
  query?: string;
  resultCount: number;
  /** Total matching records reported by the source (PubMed reports this). */
  totalAvailable?: number;
  error?: string;
}

export interface SearchResponse {
  results: ResearchRecord[];
  coverage: SourceCoverage[];
}

// ─────────────────────────── AI research answers ───────────────────────────

export interface ExtractedIntent {
  topic: string;
  task: "explain" | "find-studies" | "compare" | "limitations" | "region-function";
  /** Filters actually stated by the user. Unstated filters are left undefined. */
  filters: SearchFilters;
  regions: string[];
  /** Plain-language notes on how the request was interpreted. */
  interpretationNotes: string[];
}

export interface CitedClaim {
  text: string;
  /** Record IDs (e.g. "pmid:123") — validated against retrieved records. */
  citations: string[];
  /** What kind of statement this is. */
  claimType: "reported-finding" | "interpretation" | "hypothesis" | "open-question";
}

export interface StudyAssessment {
  recordId: string;
  relevance: string;
  evidenceNote: string;
}

export type AnswerStatus =
  | "answered"
  | "insufficient-evidence"
  | "retrieval-only" // AI not configured; evidence shown without synthesis
  | "ai-error";

export interface ResearchAnswer {
  status: AnswerStatus;
  question: string;
  intent: ExtractedIntent;
  directAnswer: string;
  mainFindings: CitedClaim[];
  mixedOrContradictory: CitedClaim[];
  limitations: string[];
  uncertainty: string;
  supportingStudies: StudyAssessment[];
  regions: { name: string; citations: string[] }[];
  /** All records retrieved for this question, so users can inspect them. */
  evidence: ResearchRecord[];
  coverage: SourceCoverage[];
  brainMaps: BrainMapAvailability[];
  /** Problems found by the citation validator (removed claims etc.). */
  validationNotes: string[];
  model?: string;
  generatedAt: string;
}

// ─────────────────────────────── Brain maps ────────────────────────────────

export interface BrainMapAvailability {
  recordId: string;
  status: "available" | "none-found" | "not-checked" | "error";
  collection?: {
    id: number;
    name: string;
    url: string;
    doi?: string;
  };
  images?: {
    id: number;
    name: string;
    url: string;
    mapType?: string;
    modality?: string;
    template?: string;
    cognitiveParadigm?: string;
  }[];
  /** Why the map is or isn't drawn on this app's 3D model. */
  renderNote: string;
  error?: string;
}

export interface ServerStatus {
  aiConfigured: boolean;
  model: string;
  ncbiKeyConfigured: boolean;
  librarySize: number;
  brainModel: { kind: "schematic-placeholder" | "anatomical-mesh"; attribution?: string };
}
