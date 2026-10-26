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
  | "preprint"
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
  /** Full display name when a source doesn't split first/last names. */
  fullName?: string;
}

/** External research databases Brain Explorer can search. */
export type SourceId = "pubmed" | "europepmc" | "openalex" | "semanticscholar";

export const SOURCE_INFO: Record<SourceId, { name: string; description: string; supportsAgeFilter: boolean }> = {
  pubmed: { name: "PubMed", description: "U.S. National Library of Medicine — ~38M biomedical citations with expert MeSH indexing.", supportsAgeFilter: true },
  europepmc: { name: "Europe PMC", description: "PubMed plus extra life-science journals, open full texts and preprints (EMBL-EBI).", supportsAgeFilter: true },
  openalex: { name: "OpenAlex", description: "Open index of ~250M scholarly works across all publishers; limited here to medicine, neuroscience and psychology.", supportsAgeFilter: false },
  semanticscholar: { name: "Semantic Scholar", description: "AI2's index of ~200M papers; limited here to medicine, biology and psychology.", supportsAgeFilter: false },
};
export const ALL_SOURCES = Object.keys(SOURCE_INFO) as SourceId[];

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
  /** Raw publication types as reported by the source, e.g. ["Journal Article", "Review"]. */
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
  /** The database this record was first retrieved from. */
  source: SourceId;
  /** Every database the same paper was found in (after de-duplication). */
  foundIn?: SourceId[];
  /** Whether the paper has been through peer review, when the source says so. */
  peerReview?: Derived<"peer-reviewed" | "preprint" | "unknown">;
  retrievedAt: string; // ISO timestamp
  verification: VerificationStatus;
}

export type VerificationStatus =
  | `retrieved-from-${SourceId}` // fetched live from the source's official API and parsed
  | "manually-reviewed"; // a human checked this record against the original paper

/** Filters a user can apply in the Research Library. */
export interface SearchFilters {
  yearFrom?: number;
  yearTo?: number;
  categories?: PublicationCategory[];
  methods?: EvidenceMethod[];
  ageGroups?: AgeGroup[];
  humansOnly?: boolean;
  /** Server-side only: restrict external searches to brain/behavior research. */
  neuroFocus?: boolean;
}

export interface SearchRequest {
  query: string;
  filters?: SearchFilters;
  /** Also search external databases live (otherwise local library only). */
  includePubMed?: boolean;
  /** Which external databases to search (default: all). */
  sources?: SourceId[];
  limit?: number;
}

export interface SourceCoverage {
  source: "local-library" | SourceId | "web";
  searched: boolean;
  query?: string;
  resultCount: number;
  /** Total matching records reported by the source. */
  totalAvailable?: number;
  error?: string;
}

/** A web page found by the AI's web search tool on a trusted domain. */
export interface WebSource {
  /** "web:1", "web:2", … — the only IDs the AI may cite for web pages. */
  id: string;
  url: string;
  title: string;
  /** e.g. "nih.gov" */
  domain: string;
  kind: "government" | "health-organization" | "journal" | "university" | "other";
  /** Page date as reported by the search engine, if any. */
  pageAge?: string;
  /** Verbatim excerpts from the page, as returned by the web search tool. */
  excerpts: string[];
  retrievedAt: string;
}

export interface SearchResponse {
  results: ResearchRecord[];
  coverage: SourceCoverage[];
}

// ─────────────────────────── AI research answers ───────────────────────────

export interface CharacterProfile {
  name: string;
  /** Age in years (3–90). */
  age: number;
}

export interface ExtractedIntent {
  topic: string;
  /** Topic rewritten with scientific terms (e.g. "all-nighter" → "sleep deprivation"). */
  scientificTopic: string;
  /** True only when the user asked about hormones. */
  includeHormones: boolean;
  /** Age group whose studies are prioritized for the character (not a hard filter). */
  preferredAgeGroup?: AgeGroup;
  task: "explain" | "find-studies" | "compare" | "limitations" | "region-function";
  /** Filters actually stated by the user. Unstated filters are left undefined. */
  filters: SearchFilters;
  regions: string[];
  /** Plain-language notes on how the request was interpreted. */
  interpretationNotes: string[];
}

export type ClaimType = "reported-finding" | "interpretation" | "hypothesis" | "open-question" | "textbook-background";

export interface CitedClaim {
  text: string;
  /** Record IDs ("pmid:123") or textbook background IDs ("region:hippocampus") — validated. */
  citations: string[];
  /** What kind of statement this is. */
  claimType: ClaimType;
}

export interface StudentParagraph extends CitedClaim {
  heading: string;
}

export interface HormoneNote {
  hormone: string;
  role: string;
  citations: string[];
}

/** How well a study's population matches the character (computed by the server, not the AI). */
export interface PopulationMatch {
  age: "same-age-group" | "different-age-group" | "not-indexed";
  species: "human" | "animal" | "not-indexed";
  includesMales: boolean | null;
  note: string;
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
  /** Short, plain-language paragraphs for students ("What happens in his brain"). */
  studentExplanation: StudentParagraph[];
  /** Only present when the user asked about hormones. */
  hormones: HormoneNote[];
  keyTerms: { term: string; definition: string }[];
  confidence: { level: "strong" | "moderate" | "limited" | "insufficient"; reason: string };
  mainFindings: CitedClaim[];
  mixedOrContradictory: CitedClaim[];
  limitations: string[];
  uncertainty: string;
  supportingStudies: StudyAssessment[];
  regions: { name: string; citations: string[] }[];
  character?: CharacterProfile & { ageGroup: AgeGroup };
  /** Per-record population match with the character. */
  populationMatch: Record<string, PopulationMatch>;
  /** Textbook background entries the AI was allowed to cite (from the region dictionary). */
  background: { id: string; name: string }[];
  /** All records retrieved for this question, so users can inspect them. */
  evidence: ResearchRecord[];
  /** Pages from trusted websites found by web search (only when studies were thin). */
  webSources: WebSource[];
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
  aiCallsToday?: { used: number; limit: number };
  brainModel: { kind: "schematic-placeholder" | "anatomical-mesh"; attribution?: string };
}
