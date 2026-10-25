// Scientific-integrity tests: citation validity, unsupported claims,
// unsupported brain-map/region claims, and insufficient-evidence behavior.

import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { extractIntent } from "../server/ai/intent.js";
import { validateAnswer } from "../server/ai/validate.js";
import { answerQuestion } from "../server/ai/engine.js";
import { createApp } from "../server/app.js";
import type { ModelAnswer } from "../server/ai/schema.js";
import { SLEEP_WM, SLEEP_WM_2, UNRELATED, tempLibrary } from "./helpers.js";

const NOW = new Date("2026-06-01");

function modelAnswer(over: Partial<ModelAnswer> = {}): ModelAnswer {
  return {
    status: "answered",
    directAnswer: "Sleep restriction is associated with lower working memory accuracy.",
    studentExplanation: [{ heading: "Memory gets harder", text: "Studies found lower accuracy.", citations: [SLEEP_WM.id], claimType: "reported-finding" }],
    hormones: [],
    keyTerms: [{ term: "Working memory", definition: "Holding information in mind for a short time." }],
    confidence: { level: "limited", reason: "Few small studies." },
    mainFindings: [{ text: "Accuracy decreased.", citations: [SLEEP_WM.id], claimType: "reported-finding" }],
    mixedOrContradictory: [],
    limitations: ["Small samples."],
    uncertainty: "Long-term effects unknown.",
    supportingStudies: [{ recordId: SLEEP_WM.id, relevance: "Direct test", evidenceNote: "fMRI" }],
    regions: [],
    ...over,
  };
}

describe("Intent extraction", () => {
  it("does not silently add age or date filters", () => {
    const i = extractIntent("How does sleep restriction affect working memory?", { now: NOW });
    expect(i.filters).toEqual({});
    expect(i.task).toBe("explain");
    expect(i.topic).toBe("sleep restriction working memory");
  });

  it("recognizes 'recent' and explains the interpretation", () => {
    const i = extractIntent("Find recent studies on stress and memory.", { now: NOW });
    expect(i.task).toBe("find-studies");
    expect(i.filters.yearFrom).toBe(2021);
    expect(i.interpretationNotes.join(" ")).toMatch(/publication date/);
  });

  it("handles comparisons across age groups without treating 'older adults' as 'adults'", () => {
    const i = extractIntent("Compare adolescent and adult findings on working memory.", { now: NOW });
    expect(i.task).toBe("compare");
    expect(i.filters.ageGroups).toEqual(["adolescent", "adult"]);
    expect(extractIntent("memory in older adults").filters.ageGroups).toEqual(["older-adult"]);
  });

  it("resolves 'this brain region' to the selected region", () => {
    const i = extractIntent("What evidence connects this brain region to attention?", { selectedRegionId: "parietal-lobe" });
    expect(i.regions).toEqual(["parietal-lobe"]);
    expect(i.task).toBe("region-function");
    expect(i.topic).toContain("parietal");
  });

  it("detects fMRI and limitations requests", () => {
    expect(extractIntent("Show me functional MRI studies about working memory.").filters.methods).toEqual(["functional-mri"]);
    expect(extractIntent("What are the limitations of the evidence on sleep and memory?").task).toBe("limitations");
  });
});

describe("Citation validation", () => {
  it("removes citations to records that were not retrieved", () => {
    const v = validateAnswer(
      modelAnswer({
        mainFindings: [
          { text: "Real.", citations: [SLEEP_WM.id, "pmid:11111111"], claimType: "reported-finding" },
          { text: "Fabricated.", citations: ["pmid:22222222"], claimType: "reported-finding" },
        ],
        supportingStudies: [{ recordId: "pmid:33333333", relevance: "", evidenceNote: "" }],
      }),
      [SLEEP_WM],
    );
    expect(v.mainFindings).toEqual([{ text: "Real.", citations: [SLEEP_WM.id], claimType: "reported-finding" }]);
    expect(v.supportingStudies).toEqual([]);
    expect(v.validationNotes.join(" ")).toMatch(/3 source\(s\)/);
  });

  it("accepts bare PMIDs and normalizes them", () => {
    const v = validateAnswer(modelAnswer({ mainFindings: [{ text: "x", citations: ["90000101"], claimType: "reported-finding" }] }), [SLEEP_WM]);
    expect(v.mainFindings[0].citations).toEqual([SLEEP_WM.id]);
  });

  it("downgrades to insufficient evidence when no finding is supported", () => {
    const v = validateAnswer(
      modelAnswer({ mainFindings: [{ text: "x", citations: ["pmid:99999999"], claimType: "interpretation" }], studentExplanation: [] }),
      [SLEEP_WM],
    );
    expect(v.status).toBe("insufficient-evidence");
    expect(v.mainFindings).toEqual([]);
  });

  it("flags and scrubs unretrieved PMIDs written into free text", () => {
    const v = validateAnswer(modelAnswer({ directAnswer: "As shown (PMID: 12345678), sleep matters." }), [SLEEP_WM]);
    expect(v.directAnswer).not.toContain("12345678");
    expect(v.validationNotes.length).toBeGreaterThan(0);
  });

  it("rejects region claims not supported by the cited study's text", () => {
    const v = validateAnswer(
      modelAnswer({
        regions: [
          { name: "prefrontal-cortex", citations: [SLEEP_WM.id] }, // mentioned → kept
          { name: "amygdala", citations: [SLEEP_WM.id] }, // not mentioned → removed
          { name: "made-up-gyrus", citations: [SLEEP_WM.id] }, // not a real dictionary region → removed
        ],
      }),
      [SLEEP_WM],
    );
    expect(v.regions).toEqual([{ name: "prefrontal-cortex", citations: [SLEEP_WM.id] }]);
  });
});

describe("Research engine", () => {
  it("returns insufficient evidence without calling the AI when nothing relevant is found", async () => {
    const synthesize = vi.fn();
    const ans = await answerQuestion(
      { question: "Does quantum entanglement explain consciousness?" },
      { library: tempLibrary([SLEEP_WM, UNRELATED]), pubmed: vi.fn().mockResolvedValue({ records: [], total: 0, query: "q" }), synthesize, aiConfigured: () => true },
    );
    expect(ans.status).toBe("insufficient-evidence");
    expect(synthesize).not.toHaveBeenCalled();
    expect(ans.evidence).toEqual([]);
    expect(ans.coverage.find((c) => c.source === "pubmed")?.searched).toBe(true);
  });

  it("says honestly when PubMed could not be searched", async () => {
    const ans = await answerQuestion(
      { question: "How does meditation change the insula?" },
      { library: tempLibrary([]), pubmed: vi.fn().mockRejectedValue(new Error("HTTP 503")), aiConfigured: () => false },
    );
    expect(ans.directAnswer).toMatch(/Could not be searched: PubMed \(HTTP 503\)/);
    expect(ans.coverage.find((c) => c.source === "pubmed")).toMatchObject({ searched: false });
  });

  it("returns retrieved evidence in retrieval-only mode when AI is not configured", async () => {
    const ans = await answerQuestion(
      { question: "How does sleep restriction affect working memory?", allowPubMed: false },
      { library: tempLibrary([SLEEP_WM, SLEEP_WM_2, UNRELATED]), aiConfigured: () => false },
    );
    expect(ans.status).toBe("retrieval-only");
    expect(ans.evidence.map((r) => r.id).sort()).toEqual([SLEEP_WM.id, SLEEP_WM_2.id]);
    expect(ans.mainFindings).toEqual([]);
  });

  it("validates AI output and only reports brain maps found by the server", async () => {
    const brainMaps = vi.fn().mockResolvedValue({ recordId: SLEEP_WM.id, status: "none-found", renderNote: "none" });
    const ans = await answerQuestion(
      { question: "How does sleep restriction affect working memory?", allowPubMed: false },
      {
        library: tempLibrary([SLEEP_WM, SLEEP_WM_2]),
        aiConfigured: () => true,
        synthesize: vi.fn().mockResolvedValue({
          model: "test-model",
          answer: modelAnswer({ mainFindings: [{ text: "Fake", citations: ["pmid:12121212"], claimType: "reported-finding" }, { text: "Real", citations: [SLEEP_WM.id], claimType: "reported-finding" }] }),
        }),
        brainMaps,
      },
    );
    expect(ans.status).toBe("answered");
    expect(ans.mainFindings.map((c) => c.text)).toEqual(["Real"]);
    expect(brainMaps).toHaveBeenCalledTimes(1); // only the cited fMRI study is checked
    expect(ans.brainMaps[0].status).toBe("none-found");
  });

  it("does not search PubMed when the library already has enough evidence", async () => {
    const recs = Array.from({ length: 6 }, (_, i) => ({ ...SLEEP_WM, id: `pmid:9000050${i}`, pmid: `9000050${i}`, doi: undefined, title: `${SLEEP_WM.title} ${i}` }));
    const pubmed = vi.fn();
    await answerQuestion({ question: "sleep restriction working memory" }, { library: tempLibrary(recs), pubmed, aiConfigured: () => false });
    expect(pubmed).not.toHaveBeenCalled();
  });
});

describe("API security and validation", () => {
  it("never exposes API keys in /api/status", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-should-never-leak";
    const app = createApp({ library: tempLibrary([]), aiConfigured: () => true });
    const res = await request(app).get("/api/status");
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain("sk-ant");
    expect(res.body.aiConfigured).toBe(true);
  });

  it("rejects invalid input", async () => {
    const app = createApp({ library: tempLibrary([]) });
    expect((await request(app).post("/api/ask").send({ question: "" })).status).toBe(400);
    expect((await request(app).post("/api/ask").send({ question: "x".repeat(600) })).status).toBe(400);
    expect((await request(app).post("/api/search").send({ query: "x", filters: { yearFrom: "drop table" } })).status).toBe(400);
    expect((await request(app).get("/api/studies/not-an-id")).status).toBe(404);
  });
});
