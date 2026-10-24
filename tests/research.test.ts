import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parsePubmedXml, categorize, extractSampleSize } from "../server/research/normalize.js";
import { dedupeRecords } from "../server/research/dedupe.js";
import { buildPubmedQuery, esearch } from "../server/research/pubmed.js";
import { combinedSearch } from "../server/research/search.js";
import { lookupBrainMaps } from "../server/maps/neurovault.js";
import { makeRecord, tempLibrary, SLEEP_WM, UNRELATED } from "./helpers.js";

const xml = fs.readFileSync(path.join(import.meta.dirname, "fixtures/pubmed-sample.xml"), "utf8");

describe("PubMed XML normalization", () => {
  const records = parsePubmedXml(xml, "2026-01-01T00:00:00.000Z");

  it("skips records without a PMID", () => {
    expect(records.map((r) => r.pmid)).toEqual(["90000001", "90000002", "90000003"]);
  });

  it("copies bibliographic metadata and strips inline markup", () => {
    const r = records[0];
    expect(r.title).toBe("[TEST FIXTURE] Sleep restriction and working memory: an fMRI study");
    expect(r.doi).toBe("10.9999/test.0001");
    expect(r.journal).toBe("Journal of Test Neuroscience");
    expect(r.publicationDate).toBe("2022 Mar 15");
    expect(r.publicationYear).toBe(2022);
    expect(r.authors[0]).toEqual({ lastName: "Testperson", foreName: "Alex", collective: undefined });
    expect(r.sourceUrl).toBe("https://pubmed.ncbi.nlm.nih.gov/90000001/");
    expect(r.abstract.map((s) => s.label)).toEqual(["BACKGROUND", "METHODS", "RESULTS", "CONCLUSIONS"]);
  });

  it("labels derived fields with their provenance", () => {
    const r = records[0];
    expect(r.methods.provenance).toBe("keyword-derived");
    expect(r.methods.value).toContain("functional-mri");
    expect(r.ageGroups).toMatchObject({ value: ["young-adult"], provenance: "pubmed-indexing" });
    expect(r.species.value).toEqual(["Humans"]);
    expect(r.sampleSize).toMatchObject({ value: 48, provenance: "keyword-derived" });
    expect(r.reportedFindings?.provenance).toBe("source");
    expect(r.regionsMentioned.value).toContain("prefrontal-cortex");
  });

  it("handles MedlineDate, collective authors and meta-analyses", () => {
    const r = records[1];
    expect(r.publicationYear).toBe(2019);
    expect(r.publicationDate).toBe("2019 Nov-Dec");
    expect(r.authors[0].collective).toBe("Test Consortium");
    expect(r.category.value).toBe("meta-analysis");
    // Sample sizes are not extracted for syntheses (would conflate studies and participants).
    expect(r.sampleSize).toBeUndefined();
    expect(r.reportedLimitations?.value).toMatch(/heterogeneity/);
  });

  it("leaves missing data missing instead of guessing", () => {
    const r = records[2];
    expect(r.abstract).toEqual([]);
    expect(r.authors).toEqual([]);
    expect(r.doi).toBeUndefined();
    expect(r.sampleSize).toBeUndefined();
    expect(r.reportedFindings).toBeUndefined();
    expect(r.reportedLimitations).toBeUndefined();
    expect(r.ageGroups.value).toEqual([]);
    expect(r.category.value).toBe("editorial-or-comment");
  });

  it("rejects malformed XML", () => {
    expect(() => parsePubmedXml("<PubmedArticleSet><oops")).toThrow();
  });

  it("does not guess sample size when several counts are reported", () => {
    expect(extractSampleSize("We tested 40 adults and 22 adolescents.")).toBeUndefined();
    expect(extractSampleSize("Participants (N = 120) completed the task.")).toBe(120);
    expect(extractSampleSize("Data from 2019 were analysed.")).toBeUndefined();
  });

  it("distinguishes reviews from original research", () => {
    expect(categorize(["Journal Article", "Review"])).toBe("review");
    expect(categorize(["Journal Article", "Systematic Review"])).toBe("systematic-review");
    expect(categorize(["Journal Article"])).toBe("original-research");
  });
});

describe("Deduplication", () => {
  it("merges records sharing a PMID, DOI (any case) or title+year", () => {
    const a = makeRecord({ pmid: "90000201", doi: "10.9999/abc" });
    const b = { ...makeRecord({ pmid: "90000201" }), abstract: [] };
    const c = makeRecord({ pmid: "90000202", doi: "10.9999/ABC".toLowerCase() });
    const d = makeRecord({ pmid: "90000203", title: "Same title" });
    const e = { ...makeRecord({ pmid: "90000203", title: "Same Title!" }), pmid: undefined, id: "x" };
    const out = dedupeRecords([a, b, c, d, e]);
    expect(out).toHaveLength(2);
    expect(out[0].abstract.length).toBe(1); // kept the more complete version
  });
});

describe("PubMed query building and API handling", () => {
  it("only adds filters that were requested", () => {
    expect(buildPubmedQuery("working memory")).toBe("(working memory)");
    expect(buildPubmedQuery("stress", { yearFrom: 2020, categories: ["meta-analysis"], ageGroups: ["adolescent"] })).toBe(
      '(stress) AND ("2020"[dp] : "3000"[dp]) AND (meta-analysis[pt]) AND (adolescent[mh])',
    );
  });

  it("supports PMID and DOI lookups and strips query syntax", () => {
    expect(buildPubmedQuery("12345678")).toBe("12345678[pmid]");
    expect(buildPubmedQuery("10.1000/xyz123")).toBe('"10.1000/xyz123"[doi]');
    expect(buildPubmedQuery("memory[mh] <script>")).toBe("(memory mh script)");
  });

  it("retries on rate limiting, then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ esearchresult: { count: "2", idlist: ["1", "2"] } })));
    const r = await esearch("x", 5, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.pmids).toEqual(["1", "2"]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports malformed responses as errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>not json</html>"));
    await expect(esearch("x", 5, { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow(/unreadable/);
  });
});

describe("Combined search coverage", () => {
  it("reports PubMed as not searched when it fails, and still returns local results", async () => {
    const lib = tempLibrary([SLEEP_WM, UNRELATED]);
    const failing = vi.fn().mockRejectedValue(new Error("network down"));
    const { results, coverage } = await combinedSearch(lib, { query: "sleep working memory", includePubMed: true }, failing);
    expect(results.map((r) => r.id)).toEqual([SLEEP_WM.id]);
    expect(coverage.find((c) => c.source === "pubmed")).toMatchObject({ searched: false, error: "network down" });
  });

  it("finds studies by author, PMID and DOI", async () => {
    const lib = tempLibrary([SLEEP_WM, UNRELATED]);
    expect(lib.search("90000101")[0].record.id).toBe(SLEEP_WM.id);
    expect(lib.search("10.9999/test.0101")[0].record.id).toBe(SLEEP_WM.id);
    expect(lib.search("Testperson").length).toBe(2);
  });

  it("applies filters, excluding records whose metadata can't confirm them", () => {
    const lib = tempLibrary([SLEEP_WM, makeRecord({ pmid: "90000301", title: "sleep working memory", publicationYear: undefined })]);
    expect(lib.search("sleep working memory", { yearFrom: 2020 }).map((s) => s.record.id)).toEqual([SLEEP_WM.id]);
  });
});

describe("NeuroVault brain-map lookup", () => {
  it("never claims a map without a DOI", async () => {
    const r = await lookupBrainMaps(makeRecord({ pmid: "90000401" }));
    expect(r.status).toBe("not-checked");
  });

  it("only accepts a collection whose DOI exactly matches", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [{ id: 5, name: "Other paper", DOI: "10.9999/different" }] })),
    );
    const r = await lookupBrainMaps(makeRecord({ pmid: "90000402", doi: "10.9999/mine" }), { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.status).toBe("none-found");
    expect(r.images).toBeUndefined();
  });

  it("reports errors as errors, not as 'no map'", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const r = await lookupBrainMaps(makeRecord({ pmid: "90000403", doi: "10.9999/x" }), { fetchImpl: fetchImpl as unknown as typeof fetch, retries: 0 });
    expect(r.status).toBe("error");
  });
});
