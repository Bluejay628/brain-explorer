import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ResearchRecord } from "../shared/types.js";
import { Library } from "../server/research/library.js";

/** Build a SYNTHETIC record for tests. Never use these outside tests. */
export function makeRecord(over: Partial<ResearchRecord> & { pmid: string }): ResearchRecord {
  return {
    id: `pmid:${over.pmid}`,
    title: `[TEST FIXTURE] record ${over.pmid}`,
    authors: [{ lastName: "Testperson", foreName: "Alex" }],
    abstract: [{ text: "Synthetic abstract." }],
    publicationTypes: ["Journal Article"],
    category: { value: "original-research", provenance: "pubmed-indexing" },
    methods: { value: [], provenance: "keyword-derived" },
    species: { value: ["Humans"], provenance: "pubmed-indexing" },
    ageGroups: { value: [], provenance: "pubmed-indexing" },
    meshTerms: [],
    keywords: [],
    regionsMentioned: { value: [], provenance: "keyword-derived" },
    sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${over.pmid}/`,
    source: "pubmed",
    retrievedAt: "2026-01-01T00:00:00.000Z",
    verification: "retrieved-from-pubmed",
    publicationYear: 2022,
    ...over,
  };
}

export function tempLibrary(records: ResearchRecord[] = []): Library {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brain-explorer-test-"));
  const lib = new Library(dir);
  lib.upsert(records);
  return lib;
}

export const SLEEP_WM = makeRecord({
  pmid: "90000101",
  title: "[TEST FIXTURE] Sleep restriction impairs working memory in young adults",
  abstract: [{ label: "RESULTS", text: "Sleep restriction reduced working memory accuracy. Prefrontal cortex activation changed." }],
  methods: { value: ["functional-mri"], provenance: "keyword-derived" },
  regionsMentioned: { value: ["prefrontal-cortex"], provenance: "keyword-derived" },
  doi: "10.9999/test.0101",
});

export const SLEEP_WM_2 = makeRecord({
  pmid: "90000102",
  title: "[TEST FIXTURE] Total sleep deprivation and working memory performance",
  abstract: [{ text: "Sleep deprivation had mixed effects on working memory tasks." }],
  methods: { value: ["behavioral"], provenance: "keyword-derived" },
});

export const UNRELATED = makeRecord({
  pmid: "90000103",
  title: "[TEST FIXTURE] Cerebellar contributions to balance in older adults",
  abstract: [{ text: "Balance training and the cerebellum." }],
  regionsMentioned: { value: ["cerebellum"], provenance: "keyword-derived" },
});
