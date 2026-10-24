// The local research library: a JSON file of real PubMed records cached on the
// server (data/library.json). Simple on purpose — no database to install.
// Records only ever enter this file after being fetched from PubMed.

import fs from "node:fs";
import path from "node:path";
import type { ResearchRecord, SearchFilters } from "../../shared/types.js";
import { dedupeRecords } from "./dedupe.js";

const STOPWORDS = new Set(
  "a an and are as at be by does do for from how in into is it of on or the to what which who why with about between affect affects effect effects find show me studies study research evidence recent paper papers there any can".split(" "),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/** Very light stemming so "memories" matches "memory", "sleeping" matches "sleep". */
function stem(t: string): string {
  return t.replace(/(ies)$/, "y").replace(/(ing|ed|es|s)$/, "").slice(0, 12) || t;
}

export interface ScoredRecord {
  record: ResearchRecord;
  score: number;
  /** Fraction of query terms found in the record (0–1). */
  coverage: number;
}

export function scoreRecord(record: ResearchRecord, queryTokens: string[]): ScoredRecord {
  if (!queryTokens.length) return { record, score: 0, coverage: 0 };
  const fields = {
    title: tokenize(record.title).map(stem),
    index: tokenize([...record.meshTerms, ...record.keywords].join(" ")).map(stem),
    authors: record.authors.map((a) => (a.lastName ?? a.collective ?? "").toLowerCase()),
    abstract: tokenize(record.abstract.map((s) => s.text).join(" ")).map(stem),
  };
  let score = 0;
  let matched = 0;
  for (const raw of queryTokens) {
    const t = stem(raw);
    const inTitle = fields.title.includes(t);
    const inIndex = fields.index.includes(t);
    const inAuthors = fields.authors.includes(raw);
    const abstractHits = fields.abstract.filter((w) => w === t).length;
    if (inTitle || inIndex || inAuthors || abstractHits) matched++;
    score += (inTitle ? 3 : 0) + (inIndex ? 2 : 0) + (inAuthors ? 2 : 0) + Math.min(abstractHits, 5) * 0.5;
  }
  const coverage = matched / queryTokens.length;
  return { record, score: score * coverage, coverage };
}

export function matchesFilters(r: ResearchRecord, f: SearchFilters = {}): boolean {
  if (f.yearFrom && !(r.publicationYear && r.publicationYear >= f.yearFrom)) return false;
  if (f.yearTo && !(r.publicationYear && r.publicationYear <= f.yearTo)) return false;
  if (f.categories?.length && !f.categories.includes(r.category.value)) return false;
  if (f.methods?.length && !f.methods.some((m) => r.methods.value.includes(m))) return false;
  if (f.ageGroups?.length && !f.ageGroups.some((a) => r.ageGroups.value.includes(a))) return false;
  if (f.humansOnly && !r.species.value.includes("Humans")) return false;
  return true;
}

export class Library {
  private records: ResearchRecord[] = [];
  private readonly file: string;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, "library.json");
    this.load();
  }

  private load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf8"));
      this.records = Array.isArray(raw?.records) ? raw.records : [];
    } catch {
      this.records = []; // no library yet — run `npm run seed`
    }
  }

  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), records: this.records }, null, 1));
    fs.renameSync(tmp, this.file); // atomic replace: never leaves a half-written file
  }

  get size() {
    return this.records.length;
  }

  all(): ResearchRecord[] {
    return this.records;
  }

  get(id: string): ResearchRecord | undefined {
    const norm = id.startsWith("pmid:") ? id : `pmid:${id}`;
    return this.records.find((r) => r.id === norm || r.id === id);
  }

  /** Add or update records (deduplicated by PMID/DOI). */
  upsert(newRecords: ResearchRecord[]): number {
    if (!newRecords.length) return 0;
    const before = this.records.length;
    this.records = dedupeRecords([...this.records, ...newRecords]);
    this.save();
    return this.records.length - before;
  }

  search(query: string, filters: SearchFilters = {}, limit = 20, minCoverage = 0.5): ScoredRecord[] {
    const q = query.trim();
    // Identifier lookups
    const pmid = q.match(/^(?:pmid:?\s*)?(\d{5,9})$/i)?.[1];
    if (pmid) {
      const r = this.get(pmid);
      return r ? [{ record: r, score: 100, coverage: 1 }] : [];
    }
    if (/^10\.\d{4,9}\//.test(q)) {
      const r = this.records.find((x) => x.doi === q.toLowerCase());
      return r ? [{ record: r, score: 100, coverage: 1 }] : [];
    }
    const tokens = tokenize(q);
    const candidates = this.records.filter((r) => matchesFilters(r, filters));
    if (!tokens.length) {
      // Empty query with filters = browse, newest first.
      return candidates
        .sort((a, b) => (b.publicationYear ?? 0) - (a.publicationYear ?? 0))
        .slice(0, limit)
        .map((record) => ({ record, score: 0, coverage: 0 }));
    }
    return candidates
      .map((r) => scoreRecord(r, tokens))
      .filter((s) => s.coverage >= minCoverage && s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
