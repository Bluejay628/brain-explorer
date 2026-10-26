// Tests for the character mode: age-aware retrieval, population labels,
// hormone gating, textbook background, and the region hierarchy.

import { describe, expect, it, vi } from "vitest";
import { extractIntent } from "../server/ai/intent.js";
import { validateAnswer } from "../server/ai/validate.js";
import { answerQuestion } from "../server/ai/engine.js";
import { ageGroupForAge, populationMatch, toScientificTopic } from "../server/ai/neuro.js";
import { buildPubmedQuery } from "../server/research/pubmed.js";
import { REGIONS, REGION_BY_ID, meshKeysOf, findRegionMentions } from "../shared/regions.js";
import type { ModelAnswer } from "../server/ai/schema.js";
import { SLEEP_WM, SLEEP_WM_2, makeRecord, tempLibrary } from "./helpers.js";

const LEO = { name: "Leo", age: 16 };
const TEEN_SLEEP = makeRecord({
  pmid: "90000601",
  title: "[TEST FIXTURE] Sleep deprivation and working memory in adolescents",
  abstract: [{ text: "Sleep deprivation reduced working memory in adolescents. Hippocampus activity changed." }],
  ageGroups: { value: ["adolescent"], provenance: "pubmed-indexing" },
  meshTerms: ["Humans", "Male", "Adolescent"],
  regionsMentioned: { value: ["hippocampus"], provenance: "keyword-derived" },
});
const MOUSE_SLEEP = makeRecord({
  pmid: "90000602",
  title: "[TEST FIXTURE] Sleep deprivation and memory in mice",
  abstract: [{ text: "Sleep deprivation impaired memory in mice." }],
  species: { value: ["Animals", "Mice"], provenance: "pubmed-indexing" },
});

function answer(over: Partial<ModelAnswer> = {}): ModelAnswer {
  return {
    status: "answered",
    directAnswer: "x",
    studentExplanation: [],
    hormones: [],
    keyTerms: [],
    confidence: { level: "moderate", reason: "r" },
    mainFindings: [{ text: "Real.", citations: [TEEN_SLEEP.id], claimType: "reported-finding" }],
    mixedOrContradictory: [],
    limitations: [],
    uncertainty: "",
    supportingStudies: [],
    regions: [],
    ...over,
  };
}

describe("Character intent", () => {
  it("strips the character from the search topic and translates everyday words", () => {
    const i = extractIntent("What happens in the brain of a 16-year-old boy who pulled an all-nighter?", { character: LEO });
    expect(i.topic).toBe("pulled all-nighter");
    expect(i.scientificTopic).toBe("sleep deprivation");
    expect(i.preferredAgeGroup).toBe("adolescent");
    expect(i.filters.ageGroups).toBeUndefined(); // a preference, not a hard filter
  });

  it("only includes hormones when asked", () => {
    expect(extractIntent("What happens when Leo is stressed?", { character: LEO }).includeHormones).toBe(false);
    expect(extractIntent("What happens to Leo's cortisol when he is stressed?", { character: LEO }).includeHormones).toBe(true);
    expect(extractIntent("What happens when Leo is stressed?", { character: LEO, includeHormones: true }).includeHormones).toBe(true);
  });

  it("maps ages to PubMed age groups", () => {
    expect([3, 12, 13, 16, 18, 19, 24, 30, 50, 70, 90].map(ageGroupForAge)).toEqual([
      "child", "child", "adolescent", "adolescent", "adolescent", "young-adult", "young-adult", "adult", "middle-aged", "older-adult", "older-adult",
    ]);
    expect(toScientificTopic("gaming late scrolling phone")).toBe("video games late screen time screen time");
  });
});

describe("Population match", () => {
  it("labels same-age, different-age, animal and unindexed studies", () => {
    expect(populationMatch(TEEN_SLEEP, "adolescent", "Leo")).toMatchObject({ age: "same-age-group", species: "human", includesMales: true });
    expect(populationMatch(SLEEP_WM, "adolescent", "Leo").age).toBe("not-indexed");
    expect(populationMatch(makeRecord({ pmid: "90000603", ageGroups: { value: ["adult"], provenance: "pubmed-indexing" } }), "adolescent", "Leo").age).toBe("different-age-group");
    expect(populationMatch(MOUSE_SLEEP, "adolescent", "Leo").species).toBe("animal");
  });
});

describe("Validation of student answers", () => {
  const bg = ["region:hippocampus"];

  it("allows textbook background citations but never as research findings", () => {
    const v = validateAnswer(
      answer({ studentExplanation: [{ heading: "h", text: "The hippocampus is in the temporal lobe.", citations: ["region:hippocampus"], claimType: "reported-finding" }] }),
      [TEEN_SLEEP],
      { backgroundIds: bg },
    );
    expect(v.studentExplanation[0].claimType).toBe("textbook-background");
  });

  it("rejects background IDs that were not supplied", () => {
    const v = validateAnswer(
      answer({ studentExplanation: [{ heading: "h", text: "t", citations: ["region:amygdala"], claimType: "textbook-background" }] }),
      [TEEN_SLEEP],
      { backgroundIds: bg },
    );
    expect(v.studentExplanation).toEqual([]);
  });

  it("drops hormone notes when hormones weren't asked about, and uncited ones when they were", () => {
    const hormones = [
      { hormone: "Cortisol", role: "r", citations: [TEEN_SLEEP.id] },
      { hormone: "Made-up", role: "r", citations: ["pmid:11111111"] },
    ];
    expect(validateAnswer(answer({ hormones }), [TEEN_SLEEP]).hormones).toEqual([]);
    expect(validateAnswer(answer({ hormones }), [TEEN_SLEEP], { includeHormones: true }).hormones.map((h) => h.hormone)).toEqual(["Cortisol"]);
  });

  it("accepts a parent region when a cited study mentions one of its subdivisions", () => {
    const ofc = makeRecord({ pmid: "90000604", regionsMentioned: { value: ["lateral-orbitofrontal"], provenance: "keyword-derived" } });
    const v = validateAnswer(answer({ regions: [{ name: "prefrontal-cortex", citations: [ofc.id] }] }), [ofc, TEEN_SLEEP]);
    expect(v.regions).toEqual([{ name: "prefrontal-cortex", citations: [ofc.id] }]);
  });
});

describe("Character research engine", () => {
  it("searches PubMed for the character's age group first, with the neuroscience focus", async () => {
    const pubmed = vi.fn().mockResolvedValue({ records: [], total: 0, query: "q" });
    await answerQuestion({ question: "What happens when Leo pulls an all-nighter?", character: LEO }, { library: tempLibrary([]), pubmed, aiConfigured: () => false });
    expect(pubmed).toHaveBeenCalledTimes(2);
    expect(pubmed.mock.calls[0][0]).toBe("sleep deprivation");
    expect(pubmed.mock.calls[0][1]).toMatchObject({ ageGroups: ["adolescent"], neuroFocus: true });
    expect(pubmed.mock.calls[1][1].ageGroups).toBeUndefined();
  });

  it("ranks age-matched studies first and labels every study's population", async () => {
    const ans = await answerQuestion(
      { question: "What happens to working memory after sleep deprivation?", character: LEO, allowPubMed: false },
      { library: tempLibrary([SLEEP_WM_2, TEEN_SLEEP, MOUSE_SLEEP]), aiConfigured: () => false },
    );
    expect(ans.evidence[0].id).toBe(TEEN_SLEEP.id);
    expect(ans.populationMatch[TEEN_SLEEP.id].age).toBe("same-age-group");
    expect(ans.character).toMatchObject({ name: "Leo", age: 16, ageGroup: "adolescent" });
  });

  it("passes textbook background and population labels to the AI", async () => {
    const synthesize = vi.fn().mockResolvedValue({ model: "stub", answer: answer() });
    const ans = await answerQuestion(
      { question: "How does sleep deprivation affect Leo's hippocampus?", character: LEO, allowPubMed: false, includeHormones: true },
      { library: tempLibrary([TEEN_SLEEP]), aiConfigured: () => true, synthesize, brainMaps: vi.fn() },
    );
    const extras = synthesize.mock.calls[0][3];
    expect(extras.background.map((r: { id: string }) => r.id)).toEqual(expect.arrayContaining(["hippocampus", "hypothalamus", "pituitary-gland"]));
    expect(extras.populationMatch[TEEN_SLEEP.id].age).toBe("same-age-group");
    expect(ans.background.map((b) => b.id)).toContain("region:hippocampus");
  });
});

describe("Region hierarchy", () => {
  it("has unique ids, valid parents, and mesh keys for every subdivision", () => {
    expect(new Set(REGIONS.map((r) => r.id)).size).toBe(REGIONS.length);
    for (const r of REGIONS) {
      if (r.parent) expect(REGION_BY_ID.has(r.parent)).toBe(true);
      if (r.kind === "subdivision") expect(r.meshKeys?.length).toBeGreaterThan(0);
    }
    expect(meshKeysOf("prefrontal-cortex")).toEqual(expect.arrayContaining(["rostralmiddlefrontal", "medialorbitofrontal", "frontalpole"]));
    expect(meshKeysOf("basal-ganglia")).toEqual(expect.arrayContaining(["caudate", "putamen", "pallidum", "nucleus-accumbens"]));
  });

  it("detects subdivision names without matching inside other words", () => {
    expect(findRegionMentions("activity in the precuneus")).toEqual(["precuneus"]);
    expect(findRegionMentions("the fusiform face area responded")).toContain("fusiform-gyrus");
  });

  it("restricts PubMed to neuroscience when asked", () => {
    expect(buildPubmedQuery("caffeine", { neuroFocus: true })).toMatch(/^\(caffeine\) AND \(brain\[mh\]/);
  });
});
