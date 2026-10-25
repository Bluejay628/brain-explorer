import { describe, expect, it } from "vitest";
import { bibliography, citeStudy, citeWeb } from "../shared/citations.js";
import type { WebSource } from "../shared/types.js";
import { makeRecord } from "./helpers.js";

const ONE = makeRecord({
  pmid: "90000801",
  title: "[TEST FIXTURE] Sleep and memory in teens",
  authors: [{ lastName: "Testperson", foreName: "Alex Jean-Paul" }],
  journal: "Journal of Test Sleep",
  publicationYear: 2023,
  doi: "10.9999/test.cite",
});

describe("APA 7", () => {
  it("formats a single-author article with DOI and italic journal", () => {
    const c = citeStudy(ONE, "apa");
    expect(c.text).toBe("Testperson, A. J.-P. (2023). [TEST FIXTURE] Sleep and memory in teens. Journal of Test Sleep. https://doi.org/10.9999/test.cite");
    expect(c.html).toContain("<i>Journal of Test Sleep</i>");
  });

  it("joins multiple authors with an ampersand and handles group authors", () => {
    const r = { ...ONE, authors: [{ lastName: "Testperson", foreName: "Alex" }, { fullName: "Sam Fixture" }, { collective: "Test Consortium" }] };
    expect(citeStudy(r, "apa").text.startsWith("Testperson, A., Fixture, S., & Test Consortium. (2023).")).toBe(true);
  });

  it("uses n.d., title-first, link fallback and [Preprint] when data is missing", () => {
    const r = {
      ...ONE,
      authors: [],
      publicationYear: undefined,
      doi: undefined,
      journal: undefined,
      peerReview: { value: "preprint" as const, provenance: "source" as const },
    };
    expect(citeStudy(r, "apa").text).toBe("[TEST FIXTURE] Sleep and memory in teens [Preprint]. (n.d.). https://pubmed.ncbi.nlm.nih.gov/90000801/");
  });

  it("truncates 21+ authors as APA requires", () => {
    const authors = Array.from({ length: 22 }, (_, i) => ({ lastName: `Author${i + 1}`, foreName: "X" }));
    const t = citeStudy({ ...ONE, authors }, "apa").text;
    expect(t).toContain("Author19, X., . . . Author22, X.");
    expect(t).not.toContain("Author20");
  });
});

describe("MLA 9", () => {
  it("formats one, two and many authors", () => {
    expect(citeStudy(ONE, "mla").text).toBe('Testperson, Alex Jean-Paul. "[TEST FIXTURE] Sleep and memory in teens." Journal of Test Sleep, 2023, doi:10.9999/test.cite.');
    const two = { ...ONE, authors: [{ lastName: "Testperson", foreName: "Alex" }, { lastName: "Fixture", foreName: "Sam" }] };
    expect(citeStudy(two, "mla").text.startsWith("Testperson, Alex, and Sam Fixture.")).toBe(true);
    const many = { ...ONE, authors: [...two.authors, { lastName: "Third", foreName: "T" }] };
    expect(citeStudy(many, "mla").text.startsWith("Testperson, Alex, et al.")).toBe(true);
  });
});

describe("Web pages and bibliographies", () => {
  const web: WebSource = {
    id: "web:1", url: "https://www.nih.gov/test", title: "[TEST] Sleep basics", domain: "nih.gov", kind: "government",
    pageAge: "March 3, 2024", excerpts: [], retrievedAt: "2026-10-25T12:00:00Z",
  };

  it("cites a web page with organization author and retrieval date", () => {
    expect(citeWeb(web, "apa").text).toBe("National Institutes of Health. (2024). [TEST] Sleep basics. Retrieved October 25, 2026, from https://www.nih.gov/test");
    expect(citeWeb(web, "mla").text).toBe('"[TEST] Sleep basics." National Institutes of Health, 2024, https://www.nih.gov/test. Accessed 25 Oct. 2026.');
  });

  it("sorts a bibliography alphabetically with hanging indents in HTML", () => {
    const b = bibliography([citeWeb(web, "apa"), citeStudy(ONE, "apa")]);
    expect(b.text.indexOf("National Institutes")).toBeLessThan(b.text.indexOf("Testperson"));
    expect(b.html).toContain("text-indent:-2em");
  });
});
