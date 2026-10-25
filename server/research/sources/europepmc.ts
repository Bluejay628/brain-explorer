// Europe PMC REST API (EMBL-EBI). Free, no key.
// Docs: https://europepmc.org/RestfulWebService
// Covers PubMed/MEDLINE, PubMed Central full texts, other life-science literature and preprints.

import type { AbstractSection, Author, ResearchRecord, SearchFilters } from "../../../shared/types.js";
import { buildRecord } from "../normalize.js";
import { ExternalApiError, politeFetch, RateLimiter, type FetchOptions } from "../http.js";
import type { SourceSearchResult } from "./types.js";

const BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";
const limiter = new RateLimiter(250);

const AGE_MESH: Record<string, string> = {
  child: '"Child"',
  adolescent: '"Adolescent"',
  "young-adult": '"Young Adult"',
  adult: '"Adult"',
  "middle-aged": '"Middle Aged"',
  "older-adult": '"Aged"',
};
const PUB_TYPE: Record<string, string> = {
  "meta-analysis": '"meta-analysis"',
  "systematic-review": '"systematic review"',
  review: '"review"',
  "randomized-controlled-trial": '"randomized controlled trial"',
  "clinical-trial": '"clinical trial"',
  "case-report": '"case reports"',
};

export const EPMC_NEURO_FOCUS = "(brain OR neur* OR cognit* OR cortex OR memory OR emotion* OR hormon* OR \"mental health\")";

export function buildEuropePmcQuery(query: string, f: SearchFilters = {}): string {
  const q = query.replace(/[\[\]{}<>\\":]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
  const parts = [`(${q})`, "(SRC:MED OR SRC:PMC OR SRC:PPR)"];
  if (f.yearFrom || f.yearTo) parts.push(`(PUB_YEAR:[${f.yearFrom ?? 1800} TO ${f.yearTo ?? 3000}])`);
  const ages = (f.ageGroups ?? []).map((a) => `MESH:${AGE_MESH[a]}`);
  if (ages.length) parts.push(`(${ages.join(" OR ")})`);
  const types = (f.categories ?? []).map((c) => PUB_TYPE[c]).filter(Boolean).map((t) => `PUB_TYPE:${t}`);
  if (types.length) parts.push(`(${types.join(" OR ")})`);
  if (f.humansOnly) parts.push('MESH:"Humans"');
  if (f.neuroFocus) parts.push(EPMC_NEURO_FOCUS);
  return parts.join(" AND ");
}

function decodeEntities(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

/** Europe PMC abstracts are HTML; structured ones use <h4>Label</h4> headings. */
export function parseEpmcAbstract(html: string | undefined): AbstractSection[] {
  if (!html) return [];
  const clean = (t: string) => decodeEntities(t.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const parts = html.split(/<h4>(.*?)<\/h4>/i);
  if (parts.length === 1) {
    const text = clean(html);
    return text ? [{ text }] : [];
  }
  const sections: AbstractSection[] = [];
  if (clean(parts[0])) sections.push({ text: clean(parts[0]) });
  for (let i = 1; i < parts.length; i += 2) {
    const text = clean(parts[i + 1] ?? "");
    if (text) sections.push({ label: clean(parts[i]).toUpperCase(), text });
  }
  return sections;
}

export function normalizeEuropePmc(r: any, retrievedAt = new Date().toISOString()): ResearchRecord | null {
  const title = decodeEntities(String(r?.title ?? "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").replace(/\.$/, "").trim();
  if (!title || !r?.id || !r?.source) return null;
  const pmid = /^\d+$/.test(String(r.pmid ?? "")) ? String(r.pmid) : undefined;
  const doi = r.doi ? String(r.doi).toLowerCase() : undefined;
  const src = String(r.source);
  const authors: Author[] = (r.authorList?.author ?? []).map((a: any) =>
    a.collectiveName ? { collective: String(a.collectiveName) } : { lastName: a.lastName, foreName: a.firstName, fullName: a.fullName },
  );
  const pubTypes: string[] = (r.pubTypeList?.pubType ?? []).map(String);
  const isPreprint = src === "PPR" || pubTypes.some((t) => /preprint/i.test(t));
  const year = Number(r.pubYear) || undefined;
  return buildRecord({
    id: pmid ? `pmid:${pmid}` : doi ? `doi:${doi}` : `europepmc:${src.toLowerCase()}:${String(r.id).toLowerCase()}`,
    pmid,
    doi,
    pmcid: r.pmcid ? String(r.pmcid) : undefined,
    title,
    authors,
    journal: r.journalInfo?.journal?.title ?? r.bookOrReportDetails?.publisher ?? (isPreprint ? "Preprint" : undefined),
    publicationDate: r.firstPublicationDate ?? (year ? String(year) : undefined),
    publicationYear: year,
    abstract: parseEpmcAbstract(r.abstractText),
    publicationTypes: pubTypes,
    meshTerms: (r.meshHeadingList?.meshHeading ?? []).map((m: any) => String(m.descriptorName)).filter(Boolean),
    keywords: (r.keywordList?.keyword ?? []).map(String),
    sourceUrl: `https://europepmc.org/article/${src}/${r.id}`,
    source: "europepmc",
    retrievedAt,
    isPreprint,
  });
}

export async function searchEuropePmc(query: string, filters: SearchFilters = {}, limit = 12, fetchOpts: FetchOptions = {}): Promise<SourceSearchResult> {
  const q = buildEuropePmcQuery(query, filters);
  const params = new URLSearchParams({ query: q, format: "json", resultType: "core", pageSize: String(Math.min(Math.max(limit, 1), 50)) });
  const body = await politeFetch(`${BASE}?${params}`, { limiter, ...fetchOpts });
  let json: any;
  try {
    json = JSON.parse(body);
  } catch {
    throw new ExternalApiError("Europe PMC returned an unreadable response");
  }
  const results: any[] = json?.resultList?.result;
  if (!Array.isArray(results)) throw new ExternalApiError("Europe PMC response was missing results");
  const now = new Date().toISOString();
  const records = results.map((r) => normalizeEuropePmc(r, now)).filter((r): r is ResearchRecord => !!r);
  return { records, total: Number(json.hitCount) || records.length, query: q };
}
