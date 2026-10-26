// Tests for the extra research databases (Europe PMC, OpenAlex, Semantic Scholar)
// and multi-source search. All fixtures are SYNTHETIC and shaped like each API's
// documented response format; no real papers are described.

import { describe, expect, it, vi } from "vitest";
import { buildEuropePmcQuery, normalizeEuropePmc, parseEpmcAbstract, searchEuropePmc } from "../server/research/sources/europepmc.js";
import { buildOpenAlexFilter, normalizeOpenAlex, rebuildAbstract } from "../server/research/sources/openalex.js";
import { normalizeSemanticScholar } from "../server/research/sources/semanticscholar.js";
import { searchSources } from "../server/research/sources/index.js";
import { dedupeRecords } from "../server/research/dedupe.js";
import { answerQuestion } from "../server/ai/engine.js";
import type { ResearchRecord } from "../shared/types.js";
import { tempLibrary } from "./helpers.js";

const EPMC_ARTICLE = {
  id: "90000701",
  source: "MED",
  pmid: "90000701",
  doi: "10.9999/TEST.EPMC",
  title: "[TEST FIXTURE] Sleep deprivation in <i>adolescents</i>.",
  authorList: { author: [{ fullName: "Testperson A", firstName: "Alex", lastName: "Testperson" }] },
  journalInfo: { journal: { title: "Journal of Test Sleep" } },
  pubYear: "2023",
  firstPublicationDate: "2023-02-01",
  abstractText: "<h4>Background</h4>Test background.<h4>Results</h4>Accuracy &amp; memory decreased in 60 adolescents.",
  pubTypeList: { pubType: ["Journal Article", "research-article"] },
  meshHeadingList: { meshHeading: [{ descriptorName: "Humans" }, { descriptorName: "Adolescent" }, { descriptorName: "Male" }] },
};
const EPMC_PREPRINT = {
  id: "PPR900001",
  source: "PPR",
  doi: "10.9999/test.preprint",
  title: "[TEST FIXTURE] A preprint about caffeine and attention",
  authorList: { author: [{ fullName: "Fixture S", lastName: "Fixture", firstName: "Sam" }] },
  pubYear: "2025",
  abstractText: "Caffeine improved attention in 30 young adults.",
  pubTypeList: { pubType: ["Preprint"] },
};
const OPENALEX_WORK = {
  id: "https://openalex.org/W9000000001",
  doi: "https://doi.org/10.9999/TEST.OA",
  title: "[TEST FIXTURE] Video games and visual attention",
  publication_year: 2022,
  publication_date: "2022-05-10",
  type: "article",
  ids: { pmid: "https://pubmed.ncbi.nlm.nih.gov/90000702" },
  authorships: [{ author: { display_name: "Alex Testperson" } }],
  primary_location: { source: { display_name: "Test Journal of Play" }, version: "publishedVersion" },
  abstract_inverted_index: { Video: [0], games: [1], improved: [2], attention: [3], "in": [4], adolescents: [5] },
};
const S2_PAPER = {
  paperId: "abcdef9000000000000000000000000000000001",
  title: "[TEST FIXTURE] Meditation and the insula: a meta-analysis",
  abstract: "Pooled test data from studies of meditation and the insula.",
  year: 2021,
  venue: "Test Reviews",
  publicationTypes: ["Review", "MetaAnalysis"],
  externalIds: { DOI: "10.9999/TEST.S2" },
  authors: [{ name: "Sam Fixture" }],
  url: "https://www.semanticscholar.org/paper/abcdef9000000000000000000000000000000001",
};

describe("Europe PMC", () => {
  it("parses structured HTML abstracts into labeled sections", () => {
    expect(parseEpmcAbstract(EPMC_ARTICLE.abstractText)).toEqual([
      { label: "BACKGROUND", text: "Test background." },
      { label: "RESULTS", text: "Accuracy & memory decreased in 60 adolescents." },
    ]);
  });

  it("normalizes records with MeSH-based age and species", () => {
    const r = normalizeEuropePmc(EPMC_ARTICLE)!;
    expect(r.id).toBe("pmid:90000701");
    expect(r.title).toBe("[TEST FIXTURE] Sleep deprivation in adolescents");
    expect(r.doi).toBe("10.9999/test.epmc");
    expect(r.source).toBe("europepmc");
    expect(r.ageGroups).toMatchObject({ value: ["adolescent"], provenance: "pubmed-indexing" });
    expect(r.peerReview?.value).toBe("peer-reviewed");
    expect(r.reportedFindings?.provenance).toBe("source");
    expect(r.sourceUrl).toBe("https://europepmc.org/article/MED/90000701");
  });

  it("labels preprints as not peer reviewed", () => {
    const r = normalizeEuropePmc(EPMC_PREPRINT)!;
    expect(r.category.value).toBe("preprint");
    expect(r.peerReview?.value).toBe("preprint");
    expect(r.id).toBe("doi:10.9999/test.preprint");
    expect(r.ageGroups.provenance).toBe("keyword-derived"); // no MeSH for preprints
  });

  it("builds queries with age, year and neuroscience filters", () => {
    const q = buildEuropePmcQuery("caffeine", { ageGroups: ["adolescent"], yearFrom: 2020, neuroFocus: true });
    expect(q).toContain('MESH:"Adolescent"');
    expect(q).toContain("PUB_YEAR:[2020 TO 3000]");
    expect(q).toContain("SRC:PPR");
    expect(q).toMatch(/neur\*/);
  });

  it("reports malformed responses as errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html>oops</html>"));
    await expect(searchEuropePmc("x", {}, 5, { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow(/unreadable/);
  });
});

describe("OpenAlex", () => {
  it("rebuilds inverted-index abstracts", () => {
    expect(rebuildAbstract(OPENALEX_WORK.abstract_inverted_index)).toBe("Video games improved attention in adolescents");
    expect(rebuildAbstract(null)).toBe("");
  });

  it("normalizes works, preferring PMID as the ID and keeping DOI", () => {
    const r = normalizeOpenAlex(OPENALEX_WORK)!;
    expect(r.id).toBe("pmid:90000702");
    expect(r.doi).toBe("10.9999/test.oa");
    expect(r.authors[0]).toMatchObject({ fullName: "Alex Testperson", lastName: "Testperson" });
    expect(r.ageGroups).toMatchObject({ value: ["adolescent"], provenance: "keyword-derived" });
    expect(r.species.provenance).toBe("keyword-derived");
    expect(r.sourceUrl).toBe("https://openalex.org/W9000000001");
  });

  it("restricts to medicine, neuroscience and psychology works with abstracts", () => {
    const f = buildOpenAlexFilter({ yearFrom: 2020, categories: ["review"] });
    expect(f).toContain("has_abstract:true");
    expect(f).toContain("primary_topic.field.id:27|28|32");
    expect(f).toContain("type:review");
    expect(f).toContain("publication_year:2020-3000");
  });
});

describe("Semantic Scholar", () => {
  it("normalizes papers and maps publication types", () => {
    const r = normalizeSemanticScholar(S2_PAPER)!;
    expect(r.id).toBe("doi:10.9999/test.s2");
    expect(r.category.value).toBe("meta-analysis");
    expect(r.sampleSize).toBeUndefined(); // never for syntheses
    expect(r.regionsMentioned.value).toContain("insula");
  });

  it("skips records without an id or title", () => {
    expect(normalizeSemanticScholar({ title: "" })).toBeNull();
    expect(normalizeOpenAlex({ id: "" })).toBeNull();
    expect(normalizeEuropePmc({ title: "x" })).toBeNull();
  });
});

describe("Multi-source search", () => {
  const epmc = normalizeEuropePmc(EPMC_ARTICLE)!;
  const oa = normalizeOpenAlex(OPENALEX_WORK)!;
  const s2 = normalizeSemanticScholar(S2_PAPER)!;
  const ok = (records: ResearchRecord[]) => vi.fn().mockResolvedValue({ records, total: records.length, query: "q" });

  it("merges the same paper found in two databases and remembers both", () => {
    const sameAsEpmc = { ...oa, id: epmc.id, pmid: epmc.pmid, doi: epmc.doi, source: "openalex" as const, foundIn: ["openalex" as const] };
    const merged = dedupeRecords([epmc, sameAsEpmc]);
    expect(merged).toHaveLength(1);
    expect(merged[0].foundIn?.sort()).toEqual(["europepmc", "openalex"]);
  });

  it("searches sources in parallel and keeps going when one fails", async () => {
    const res = await searchSources(
      { europepmc: ok([epmc]), openalex: vi.fn().mockRejectedValue(new Error("HTTP 503")), semanticscholar: ok([s2]) },
      undefined,
      "q",
      [{ filters: {} }],
      5,
    );
    expect(res.records.map((r) => r.source).sort()).toEqual(["europepmc", "semanticscholar"]);
    expect(res.coverage.find((c) => c.source === "openalex")).toMatchObject({ searched: false, error: "HTTP 503" });
  });

  it("only runs age-filtered searches on sources with age indexing", async () => {
    const pubmed = ok([]);
    const openalex = ok([]);
    await searchSources({ pubmed, openalex }, undefined, "q", [{ filters: { ageGroups: ["adolescent"] }, onlyAgeCapable: true }, { filters: {} }], 5);
    expect(pubmed).toHaveBeenCalledTimes(2);
    expect(openalex).toHaveBeenCalledTimes(1);
    expect(openalex.mock.calls[0][1].ageGroups).toBeUndefined();
  });

  it("respects the user's choice of sources", async () => {
    const pubmed = ok([]);
    const openalex = ok([]);
    const res = await searchSources({ pubmed, openalex }, ["openalex"], "q", [{ filters: {} }], 5);
    expect(pubmed).not.toHaveBeenCalled();
    expect(res.coverage.map((c) => c.source)).toEqual(["openalex"]);
  });

  it("feeds studies from every source into the research engine with honest coverage", async () => {
    const ans = await answerQuestion(
      { question: "Does meditation change the insula?", character: { name: "Leo", age: 16 } },
      {
        library: tempLibrary([]),
        sources: { europepmc: ok([]), semanticscholar: ok([s2]), openalex: vi.fn().mockRejectedValue(new Error("timeout")) },
        aiConfigured: () => false,
      },
    );
    expect(ans.status).toBe("retrieval-only");
    expect(ans.evidence.map((r) => r.id)).toEqual([s2.id]);
    expect(ans.coverage.filter((c) => c.source !== "local-library").map((c) => [c.source, c.searched])).toEqual([
      ["europepmc", true],
      ["openalex", false],
      ["semanticscholar", true],
      ["web", false],
    ]);
    expect(ans.coverage.find((c) => c.source === "web")?.error).toMatch(/AI engine/);
  });
});

describe("OpenAlex resilience", () => {
  it("retries without the field filter if OpenAlex rejects it", async () => {
    const { searchOpenAlex } = await import("../server/research/sources/openalex.js");
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad filter", { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ meta: { count: 1 }, results: [OPENALEX_WORK] })));
    const res = await searchOpenAlex("video games", {}, 5, { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(res.records).toHaveLength(1);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("primary_topic.field.id");
    expect(String(fetchImpl.mock.calls[1][0])).not.toContain("primary_topic.field.id");
  });
});
