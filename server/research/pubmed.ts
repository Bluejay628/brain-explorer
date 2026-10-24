// PubMed / NCBI E-utilities client.
// Docs: https://www.ncbi.nlm.nih.gov/books/NBK25501/
// Usage policy: max 3 requests/second without an API key, 10/second with one.
// Every request identifies this tool (`tool` + `email`), as NCBI requests.

import { config } from "../config.js";
import type { SearchFilters, ResearchRecord, AgeGroup, EvidenceMethod, PublicationCategory } from "../../shared/types.js";
import { parsePubmedXml } from "./normalize.js";
import { politeFetch, RateLimiter, ExternalApiError, type FetchOptions } from "./http.js";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

// 400 ms ≈ 2.5 req/s without a key; 120 ms ≈ 8 req/s with one (both under the limits).
const limiter = new RateLimiter(config.ncbiApiKey ? 120 : 400);

const CATEGORY_TERMS: Partial<Record<PublicationCategory, string>> = {
  "meta-analysis": "meta-analysis[pt]",
  "systematic-review": "systematic review[pt]",
  review: "review[pt]",
  "randomized-controlled-trial": "randomized controlled trial[pt]",
  "clinical-trial": "clinical trial[pt]",
  "case-report": "case reports[pt]",
};

const AGE_TERMS: Record<AgeGroup, string> = {
  child: "child[mh]",
  adolescent: "adolescent[mh]",
  "young-adult": "young adult[mh]",
  adult: "adult[mh]",
  "middle-aged": "middle aged[mh]",
  "older-adult": "aged[mh]",
};

const METHOD_TERMS: Partial<Record<EvidenceMethod, string>> = {
  "functional-mri": '(fmri[tiab] OR "functional magnetic resonance"[tiab] OR "functional MRI"[tiab])',
  "structural-mri": '("voxel-based morphometry"[tiab] OR "cortical thickness"[tiab] OR "gray matter volume"[tiab] OR "grey matter volume"[tiab])',
  "diffusion-connectivity": '("diffusion tensor imaging"[mh] OR tractography[tiab])',
  "functional-connectivity": '("functional connectivity"[tiab] OR "resting state"[tiab])',
  "eeg-meg": "(electroencephalography[mh] OR magnetoencephalography[mh])",
  pet: '"positron-emission tomography"[mh]',
  "brain-stimulation": '("transcranial magnetic stimulation"[mh] OR "transcranial direct current stimulation"[mh])',
  "animal-model": "(animals[mh] NOT humans[mh])",
};

/** Keeps PubMed results about the brain, behavior and hormones (not, e.g., muscle or heart studies). */
export const NEURO_FOCUS =
  "(brain[mh] OR brain[tiab] OR neur*[tiab] OR cognit*[tiab] OR cortex[tiab] OR cortical[tiab] OR memory[tiab] OR emotion*[tiab] OR hormon*[tiab] OR mental health[tiab])";

/** Escape a user's free text for use inside a PubMed query. */
function sanitizeTerm(q: string): string {
  return q.replace(/[\[\]{}<>\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}

/** Build a PubMed query string from free text + structured filters. */
export function buildPubmedQuery(query: string, filters: SearchFilters = {}): string {
  const q = sanitizeTerm(query);
  const parts: string[] = [];
  // Direct identifier lookups
  if (/^\d{5,9}$/.test(q)) return `${q}[pmid]`;
  if (/^10\.\d{4,9}\/\S+$/i.test(q)) return `"${q}"[doi]`;
  if (q) parts.push(`(${q})`);

  if (filters.yearFrom || filters.yearTo) {
    parts.push(`("${filters.yearFrom ?? 1800}"[dp] : "${filters.yearTo ?? 3000}"[dp])`);
  }
  const cats = (filters.categories ?? []).map((c) => CATEGORY_TERMS[c]).filter(Boolean);
  if (cats.length) parts.push(`(${cats.join(" OR ")})`);
  const ages = (filters.ageGroups ?? []).map((a) => AGE_TERMS[a]);
  if (ages.length) parts.push(`(${ages.join(" OR ")})`);
  const methods = (filters.methods ?? []).map((m) => METHOD_TERMS[m]).filter(Boolean);
  if (methods.length) parts.push(`(${methods.join(" OR ")})`);
  if (filters.humansOnly) parts.push("humans[mh]");
  if (filters.neuroFocus) parts.push(NEURO_FOCUS);
  return parts.join(" AND ");
}

function commonParams(): URLSearchParams {
  const p = new URLSearchParams({ db: "pubmed", tool: config.ncbiTool });
  if (config.ncbiEmail) p.set("email", config.ncbiEmail);
  if (config.ncbiApiKey) p.set("api_key", config.ncbiApiKey);
  return p;
}

export interface PubmedSearchResult {
  pmids: string[];
  total: number;
  query: string;
}

export async function esearch(
  term: string,
  retmax = 20,
  fetchOpts: FetchOptions = {},
): Promise<PubmedSearchResult> {
  const p = commonParams();
  p.set("term", term);
  p.set("retmode", "json");
  p.set("retmax", String(Math.min(Math.max(retmax, 1), 100)));
  p.set("sort", "relevance");
  const body = await politeFetch(`${BASE}/esearch.fcgi?${p}`, { limiter, ...fetchOpts });
  let json: any;
  try {
    json = JSON.parse(body);
  } catch {
    throw new ExternalApiError("PubMed search returned an unreadable response");
  }
  const result = json?.esearchresult;
  if (!result || !Array.isArray(result.idlist)) throw new ExternalApiError("PubMed search response was missing results");
  if (result.ERROR) throw new ExternalApiError(`PubMed error: ${String(result.ERROR).slice(0, 200)}`);
  const pmids = result.idlist.map(String).filter((id: string) => /^\d+$/.test(id));
  return { pmids, total: Number(result.count) || 0, query: term };
}

export async function efetch(pmids: string[], fetchOpts: FetchOptions = {}): Promise<ResearchRecord[]> {
  const ids = pmids.filter((id) => /^\d+$/.test(id));
  if (!ids.length) return [];
  const p = commonParams();
  p.set("id", ids.join(","));
  p.set("retmode", "xml");
  const xml = await politeFetch(`${BASE}/efetch.fcgi?${p}`, { limiter, ...fetchOpts });
  return parsePubmedXml(xml);
}

export async function searchPubmed(
  query: string,
  filters: SearchFilters = {},
  limit = 15,
  fetchOpts: FetchOptions = {},
): Promise<{ records: ResearchRecord[]; total: number; query: string }> {
  const term = buildPubmedQuery(query, filters);
  if (!term) return { records: [], total: 0, query: term };
  const { pmids, total } = await esearch(term, limit, fetchOpts);
  const records = await efetch(pmids, fetchOpts);
  // Keep PubMed's relevance order.
  const order = new Map(pmids.map((id, i) => [id, i]));
  records.sort((a, b) => (order.get(a.pmid!) ?? 0) - (order.get(b.pmid!) ?? 0));
  return { records, total, query: term };
}
