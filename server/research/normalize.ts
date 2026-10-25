// Converts raw PubMed XML (from EFetch) into Brain Explorer's ResearchRecord format.
//
// Rules followed here:
//  - Copy bibliographic facts exactly as PubMed reports them.
//  - Anything inferred by keyword rules is tagged provenance "keyword-derived".
//  - Missing data stays missing (undefined / empty) — it is never guessed.

import { XMLParser } from "fast-xml-parser";
import type {
  AbstractSection,
  AgeGroup,
  Author,
  EvidenceMethod,
  PublicationCategory,
  ResearchRecord,
  SourceId,
} from "../../shared/types.js";
import { findRegionMentions } from "../../shared/regions.js";

const ARRAY_TAGS = new Set([
  "PubmedArticle",
  "Author",
  "AbstractText",
  "PublicationType",
  "MeshHeading",
  "Keyword",
  "KeywordList",
  "ArticleId",
  "ELocationID",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false, // keep PMIDs etc. as strings
  isArray: (name) => ARRAY_TAGS.has(name),
});

// PubMed titles/abstracts can contain inline formatting tags; flatten them to text.
function stripInlineMarkup(xml: string): string {
  return xml.replace(/<\/?(i|b|u|sup|sub|em|strong|mml:[a-z]+)(\s[^>]*)?>/gi, "");
}

/** Extract the text of a node that may be a string or {"#text": ...}. */
function text(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object" && "#text" in (node as object)) return String((node as { "#text": unknown })["#text"]);
  return "";
}

function squash(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

const MONTHS: Record<string, string> = {
  jan: "Jan", feb: "Feb", mar: "Mar", apr: "Apr", may: "May", jun: "Jun",
  jul: "Jul", aug: "Aug", sep: "Sep", oct: "Oct", nov: "Nov", dec: "Dec",
};

// ───────────────────────── classification helpers ─────────────────────────

export function categorize(publicationTypes: string[]): PublicationCategory {
  // Lower-case and normalize the spellings other sources use ("JournalArticle", "research-article", "MetaAnalysis").
  const t = publicationTypes.map((p) =>
    p.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[-_]/g, " ").replace(/^meta ?analysis$/, "meta-analysis"),
  );
  if (t.some((p) => p === "preprint" || p === "posted content")) return "preprint";
  const has = (s: string) => t.some((p) => p === s);
  if (has("meta-analysis")) return "meta-analysis";
  if (has("systematic review")) return "systematic-review";
  if (has("review") || has("scoping review")) return "review";
  if (has("randomized controlled trial")) return "randomized-controlled-trial";
  if (t.some((p) => p.startsWith("clinical trial") || p === "controlled clinical trial")) return "clinical-trial";
  if (has("case reports")) return "case-report";
  if (t.some((p) => ["editorial", "comment", "letter", "news", "published erratum", "retraction of publication"].includes(p)))
    return "editorial-or-comment";
  if (has("journal article") || has("research article") || has("article") || has("comparative study") || t.some((p) => p.startsWith("research support"))) return "original-research";
  return "other";
}

const METHOD_RULES: [EvidenceMethod, RegExp][] = [
  ["functional-mri", /\b(fmri|functional magnetic resonance|functional mri|bold signal|bold response)\b/i],
  ["structural-mri", /\b(voxel-based morphometry|vbm|cortical thickness|gray matter volume|grey matter volume|structural mri|structural magnetic resonance|brain volume)\b/i],
  ["diffusion-connectivity", /\b(diffusion tensor|dti|tractography|white matter integrity|fractional anisotropy)\b/i],
  ["functional-connectivity", /\b(functional connectivity|resting[- ]state)\b/i],
  ["eeg-meg", /\b(eeg|electroencephalograph\w*|meg|magnetoencephalograph\w*|event-related potential|erp)\b/i],
  ["pet", /\b(positron emission tomography|pet imaging|pet scan)\b/i],
  ["lesion", /\b(lesion|lesions|patients with damage)\b/i],
  ["brain-stimulation", /\b(tms|transcranial magnetic|tdcs|transcranial direct current|deep brain stimulation)\b/i],
  ["animal-model", /\b(mice|mouse|rats?|rodents?|macaques?|monkeys?|zebrafish|drosophila)\b/i],
  ["computational", /\b(computational model|neural network model|simulation)\b/i],
  ["behavioral", /\b(behavioral|behavioural|reaction times?|task performance|accuracy|questionnaire|cognitive test)\b/i],
];

export function detectMethods(haystack: string, mesh: string[]): EvidenceMethod[] {
  const meshText = mesh.join(" ; ");
  const found = new Set<EvidenceMethod>();
  for (const [method, re] of METHOD_RULES) if (re.test(haystack)) found.add(method);
  if (/Magnetic Resonance Imaging/i.test(meshText) && /functional|fMRI/i.test(haystack)) found.add("functional-mri");
  if (/Electroencephalography/i.test(meshText)) found.add("eeg-meg");
  if (/Diffusion Tensor Imaging/i.test(meshText)) found.add("diffusion-connectivity");
  if (/Positron-Emission Tomography/i.test(meshText)) found.add("pet");
  return [...found];
}

const AGE_MESH: Record<string, AgeGroup> = {
  "infant": "child",
  "child, preschool": "child",
  "child": "child",
  "adolescent": "adolescent",
  "young adult": "young-adult",
  "adult": "adult",
  "middle aged": "middle-aged",
  "aged": "older-adult",
  "aged, 80 and over": "older-adult",
};

export function ageGroupsFromMesh(mesh: string[]): AgeGroup[] {
  const out = new Set<AgeGroup>();
  for (const m of mesh) {
    const g = AGE_MESH[m.toLowerCase()];
    if (g) out.add(g);
  }
  return [...out];
}

const SPECIES_MESH = ["Humans", "Animals", "Mice", "Rats", "Macaca mulatta", "Macaca", "Primates", "Zebrafish", "Drosophila"];

/**
 * Extract a single, unambiguous total sample size from abstract text.
 * Returns undefined when no clear statement exists or when several different
 * counts are reported (e.g. subgroups) — we would rather show "Not reported"
 * than a wrong number.
 */
export function extractSampleSize(abstract: string): number | undefined {
  const candidates = new Set<number>();
  const toNum = (s: string) => Number(s.replace(/,/g, ""));
  const patterns = [
    /\b[Nn]\s*=\s*(\d{1,3}(?:,\d{3})+|\d+)\b/g,
    /\b(\d{1,3}(?:,\d{3})+|\d+)\s+(?:(?:healthy|young|older|adult|adolescent|typically developing|right-handed|female|male|human)\s+){0,3}(?:participants|subjects|volunteers|individuals|adults|adolescents|children|students|patients)\b/g,
  ];
  for (const re of patterns) {
    for (const m of abstract.matchAll(re)) {
      const n = toNum(m[1]);
      // Ignore implausible values (years, tiny counts that are likely subgroup trial numbers).
      if (n >= 2 && n < 1_000_000 && !(n >= 1900 && n <= 2100)) candidates.add(n);
    }
  }
  return candidates.size === 1 ? [...candidates][0] : undefined;
}

// ─────────────────────────────── parsing ───────────────────────────────

export function parsePubmedXml(xml: string, retrievedAt = new Date().toISOString()): ResearchRecord[] {
  let doc: any;
  try {
    doc = parser.parse(stripInlineMarkup(xml));
  } catch {
    throw new Error("PubMed returned malformed XML");
  }
  const articles: any[] = doc?.PubmedArticleSet?.PubmedArticle ?? [];
  const records: ResearchRecord[] = [];
  for (const a of articles) {
    const rec = normalizeArticle(a, retrievedAt);
    if (rec) records.push(rec);
  }
  return records;
}

function normalizeArticle(a: any, retrievedAt: string): ResearchRecord | null {
  const citation = a?.MedlineCitation;
  const article = citation?.Article;
  const pmid = squash(text(citation?.PMID));
  const title = squash(text(article?.ArticleTitle)).replace(/^\[(.*)\]\.?$/, "$1");
  // A record without an identifier or a title cannot be traced; skip it.
  if (!pmid || !/^\d+$/.test(pmid) || !title) return null;

  const authors: Author[] = (article?.AuthorList?.Author ?? [])
    .map((au: any): Author => ({
      lastName: text(au.LastName) || undefined,
      foreName: text(au.ForeName) || undefined,
      collective: text(au.CollectiveName) || undefined,
    }))
    .filter((au: Author) => au.lastName || au.collective);

  const abstract: AbstractSection[] = (article?.Abstract?.AbstractText ?? [])
    .map((s: any) => ({
      label: (typeof s === "object" && s["@_Label"]) ? String(s["@_Label"]) : undefined,
      text: squash(text(s)),
    }))
    .filter((s: AbstractSection) => s.text);

  const pubDate = article?.Journal?.JournalIssue?.PubDate ?? {};
  const year = text(pubDate.Year) || (text(pubDate.MedlineDate).match(/\d{4}/)?.[0] ?? "");
  const month = MONTHS[text(pubDate.Month).slice(0, 3).toLowerCase()] ?? text(pubDate.Month);
  const day = text(pubDate.Day);
  const publicationDate = text(pubDate.MedlineDate) || [year, month, day].filter(Boolean).join(" ") || undefined;

  const ids: any[] = a?.PubmedData?.ArticleIdList?.ArticleId ?? [];
  const idOf = (type: string) => squash(text(ids.find((i) => i?.["@_IdType"] === type)));
  const eloc: any[] = article?.ELocationID ?? [];
  const doi =
    (idOf("doi") || squash(text(eloc.find((e) => e?.["@_EIdType"] === "doi"))) || "").toLowerCase() || undefined;
  const pmcid = idOf("pmc") || undefined;

  const publicationTypes: string[] = (article?.PublicationTypeList?.PublicationType ?? []).map((p: any) => squash(text(p)));
  const meshTerms: string[] = (citation?.MeshHeadingList?.MeshHeading ?? []).map((m: any) => squash(text(m.DescriptorName)));
  const keywords: string[] = (citation?.KeywordList ?? []).flatMap((kl: any) => (kl?.Keyword ?? []).map((k: any) => squash(text(k))));

  return buildRecord({
    id: `pmid:${pmid}`,
    pmid,
    doi,
    pmcid,
    title,
    authors,
    journal: squash(text(article?.Journal?.Title)) || undefined,
    publicationDate,
    publicationYear: year ? Number(year) : undefined,
    abstract,
    publicationTypes,
    meshTerms,
    keywords,
    sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    source: "pubmed",
    retrievedAt,
  });
}

// ─────────────────────── shared record builder (all sources) ───────────────────────

export interface RecordInput {
  id: string;
  pmid?: string;
  doi?: string;
  pmcid?: string;
  title: string;
  authors: Author[];
  journal?: string;
  publicationDate?: string;
  publicationYear?: number;
  abstract: AbstractSection[];
  publicationTypes: string[];
  /** MeSH terms (PubMed / Europe PMC only). Empty for sources without MeSH indexing. */
  meshTerms: string[];
  keywords: string[];
  sourceUrl: string;
  source: SourceId;
  retrievedAt: string;
  /** Set when the source itself says the work is a preprint. */
  isPreprint?: boolean;
}

const SOURCE_NAME: Record<SourceId, string> = { pubmed: "PubMed", europepmc: "Europe PMC", openalex: "OpenAlex", semanticscholar: "Semantic Scholar" };

/** Keyword fallbacks for sources without MeSH indexing (clearly labeled as keyword-derived). */
function speciesFromText(t: string): string[] {
  const out: string[] = [];
  if (/\b(participants|patients|volunteers|adolescents|children|adults|students|individuals|humans?)\b/i.test(t)) out.push("Humans");
  if (/\b(mice|mouse)\b/i.test(t)) out.push("Mice");
  if (/\brats?\b/i.test(t)) out.push("Rats");
  if (/\b(macaques?|monkeys?)\b/i.test(t)) out.push("Primates");
  return out;
}
function agesFromText(t: string): AgeGroup[] {
  const out = new Set<AgeGroup>();
  if (/\b(children|child|kids|pediatric|paediatric)\b/i.test(t)) out.add("child");
  if (/\b(adolescen\w*|teen\w*|youths?)\b/i.test(t)) out.add("adolescent");
  if (/\byoung adults?\b/i.test(t)) out.add("young-adult");
  if (/\b(older adults?|elderly|aged \d{2,} and older)\b/i.test(t)) out.add("older-adult");
  return [...out];
}

export function buildRecord(input: RecordInput): ResearchRecord {
  const { title, abstract, publicationTypes, meshTerms, keywords, doi, source } = input;
  const sourceName = SOURCE_NAME[source];
  const hasMesh = meshTerms.length > 0;
  const abstractText = abstract.map((s) => s.text).join(" ");
  const haystack = `${title} ${abstractText} ${keywords.join(" ")}`;
  const category = input.isPreprint ? "preprint" : categorize(publicationTypes);

  const findingsSections = abstract.filter((s) => s.label && /^(results?|findings|conclusions?|interpretation)$/i.test(s.label));
  const limitSections = abstract.filter((s) => s.label && /limitation/i.test(s.label));
  const limitSentences = limitSections.length ? [] : (abstractText.match(/[^.]*\blimitations?\b[^.]*\./gi) ?? []).map(squash);

  const isSynthesis = ["meta-analysis", "systematic-review", "review"].includes(category);
  const n = isSynthesis ? undefined : extractSampleSize(abstractText);

  return {
    id: input.id,
    pmid: input.pmid,
    doi,
    pmcid: input.pmcid,
    title,
    authors: input.authors,
    journal: input.journal,
    publicationDate: input.publicationDate,
    publicationYear: input.publicationYear,
    abstract,
    publicationTypes,
    category: {
      value: category,
      provenance: source === "pubmed" || source === "europepmc" ? "pubmed-indexing" : "source",
      note: input.isPreprint
        ? `${sourceName} lists this as a preprint — it has not been peer reviewed.`
        : `From ${sourceName} publication type: ${publicationTypes.join(", ") || "none listed"}`,
    },
    methods: {
      value: detectMethods(haystack, meshTerms),
      provenance: "keyword-derived",
      note: "Detected from words in the title, abstract and MeSH terms. May be incomplete or wrong — check the paper.",
    },
    species: hasMesh
      ? { value: meshTerms.filter((m) => SPECIES_MESH.includes(m)), provenance: "pubmed-indexing", note: "From MeSH indexing." }
      : { value: speciesFromText(haystack), provenance: "keyword-derived", note: `${sourceName} has no species indexing; detected from abstract words — verify.` },
    ageGroups: hasMesh
      ? { value: ageGroupsFromMesh(meshTerms), provenance: "pubmed-indexing", note: "From MeSH age-group indexing. Absence does not mean an age group was excluded." }
      : { value: agesFromText(haystack), provenance: "keyword-derived", note: `${sourceName} has no age indexing; detected from abstract words — verify.` },
    sampleSize:
      n !== undefined
        ? { value: n, provenance: "keyword-derived", note: "Auto-extracted from a sample-size statement in the abstract. Verify in the paper." }
        : undefined,
    meshTerms,
    keywords,
    regionsMentioned: {
      value: findRegionMentions(`${title} ${abstractText}`),
      provenance: "keyword-derived",
      note: "Region names that appear in the title or abstract. A mention is not a finding about that region.",
    },
    reportedFindings: findingsSections.length
      ? { value: findingsSections.map((s) => s.text).join(" "), provenance: "source", note: "Verbatim from the abstract's results/conclusions section." }
      : undefined,
    reportedLimitations: limitSections.length
      ? { value: limitSections.map((s) => s.text).join(" "), provenance: "source", note: "Verbatim from the abstract's limitations section." }
      : limitSentences.length
        ? { value: limitSentences.join(" "), provenance: "keyword-derived", note: "Sentences in the abstract that mention limitations." }
        : undefined,
    sourceUrl: input.sourceUrl,
    doiUrl: doi ? `https://doi.org/${doi}` : undefined,
    source,
    foundIn: [source],
    peerReview: input.isPreprint
      ? { value: "preprint", provenance: "source", note: `${sourceName} marks this as a preprint (not yet peer reviewed).` }
      : category === "editorial-or-comment" || category === "other"
        ? { value: "unknown", provenance: "source" }
        : { value: "peer-reviewed", provenance: source === "pubmed" ? "pubmed-indexing" : "source", note: `Indexed by ${sourceName} as a journal publication.` },
    retrievedAt: input.retrievedAt,
    verification: `retrieved-from-${source}`,
  };
}
