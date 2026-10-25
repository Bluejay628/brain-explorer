// Web search safeguards. Fixtures are SYNTHETIC, shaped like the Claude API's
// web search response blocks; no real pages are described.

import { describe, expect, it, vi } from "vitest";
import { extractWebSources, isTrusted, kindOf } from "../server/ai/web.js";
import { validateAnswer } from "../server/ai/validate.js";
import { answerQuestion } from "../server/ai/engine.js";
import type { ModelAnswer } from "../server/ai/schema.js";
import type { WebSource } from "../shared/types.js";
import { tempLibrary } from "./helpers.js";

const RESPONSE = [
  {
    type: "web_search_tool_result",
    content: [
      { type: "web_search_result", url: "https://www.nih.gov/test-sleep-page", title: "[TEST] Sleep and the brain", page_age: "2025-01-01" },
      { type: "web_search_result", url: "https://random-blog.example.com/sleep", title: "[TEST] Untrusted blog" },
    ],
  },
  {
    type: "text",
    text: "Sleep helps memory.",
    citations: [
      { type: "web_search_result_location", url: "https://www.nih.gov/test-sleep-page", title: "[TEST] Sleep and the brain", cited_text: "[TEST] Sleep helps the brain store memories." },
      { type: "web_search_result_location", url: "https://random-blog.example.com/sleep", title: "[TEST] Untrusted blog", cited_text: "[TEST] Blog claim." },
    ],
  },
  { type: "text", text: "Uncited sentence about https://www.cdc.gov/other." },
];

describe("Trusted web sources", () => {
  it("keeps only trusted pages that have verbatim excerpts", () => {
    const web = extractWebSources(RESPONSE, "2026-01-01T00:00:00Z");
    expect(web).toEqual([
      {
        id: "web:1",
        url: "https://www.nih.gov/test-sleep-page",
        title: "[TEST] Sleep and the brain",
        domain: "nih.gov",
        kind: "government",
        pageAge: "2025-01-01",
        excerpts: ["[TEST] Sleep helps the brain store memories."],
        retrievedAt: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("recognizes trusted domains and subdomains only", () => {
    expect(isTrusted("https://www.ncbi.nlm.nih.gov/x")).toBe(true);
    expect(isTrusted("https://nih.gov.evil.example.com/x")).toBe(false);
    expect(isTrusted("https://fakenih.gov/x")).toBe(false);
    expect(kindOf("harvard.edu")).toBe("university");
    expect(kindOf("nature.com")).toBe("journal");
  });
});

const WEB: WebSource = {
  id: "web:1", url: "https://www.nih.gov/test", title: "[TEST]", domain: "nih.gov", kind: "government", excerpts: ["[TEST] excerpt"], retrievedAt: "2026-01-01",
};

function answer(over: Partial<ModelAnswer> = {}): ModelAnswer {
  return {
    status: "answered", directAnswer: "x", studentExplanation: [], hormones: [], keyTerms: [], confidence: { level: "limited", reason: "r" },
    mainFindings: [], mixedOrContradictory: [], limitations: [], uncertainty: "", supportingStudies: [], regions: [], ...over,
  };
}

describe("Validating web citations", () => {
  it("accepts web pages that were actually returned and rejects invented ones", () => {
    const v = validateAnswer(
      answer({
        studentExplanation: [
          { heading: "h", text: "Real web.", citations: ["web:1"], claimType: "reported-finding" },
          { heading: "h", text: "Made-up web.", citations: ["web:7"], claimType: "reported-finding" },
        ],
      }),
      [],
      { webSources: [WEB] },
    );
    expect(v.status).toBe("answered");
    expect(v.studentExplanation.map((p) => p.text)).toEqual(["Real web."]);
  });
});

describe("Engine with web search", () => {
  it("searches the web when studies are thin and answers from verified pages", async () => {
    const webSearch = vi.fn().mockResolvedValue([WEB]);
    const synthesize = vi.fn().mockResolvedValue({
      model: "stub",
      answer: answer({ studentExplanation: [{ heading: "h", text: "From NIH.", citations: ["web:1"], claimType: "reported-finding" }] }),
    });
    const ans = await answerQuestion(
      { question: "What does the pineal gland do at night?" },
      { library: tempLibrary([]), pubmed: vi.fn().mockResolvedValue({ records: [], total: 0, query: "q" }), aiConfigured: () => true, webSearch, synthesize },
    );
    expect(webSearch).toHaveBeenCalledTimes(1);
    expect(synthesize.mock.calls[0][3].webSources).toEqual([WEB]);
    expect(ans.status).toBe("answered");
    expect(ans.webSources).toEqual([WEB]);
    expect(ans.coverage.find((c) => c.source === "web")).toMatchObject({ searched: true, resultCount: 1 });
  });

  it("still says insufficient evidence when the web finds nothing trustworthy either", async () => {
    const synthesize = vi.fn();
    const ans = await answerQuestion(
      { question: "Does quantum entanglement explain consciousness?" },
      { library: tempLibrary([]), pubmed: vi.fn().mockResolvedValue({ records: [], total: 0, query: "q" }), aiConfigured: () => true, webSearch: vi.fn().mockResolvedValue([]), synthesize },
    );
    expect(ans.status).toBe("insufficient-evidence");
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("respects the user's choice to turn web search off", async () => {
    const webSearch = vi.fn();
    await answerQuestion(
      { question: "What does the pineal gland do?", allowWeb: false },
      { library: tempLibrary([]), pubmed: vi.fn().mockResolvedValue({ records: [], total: 0, query: "q" }), aiConfigured: () => true, webSearch },
    );
    expect(webSearch).not.toHaveBeenCalled();
  });
});
