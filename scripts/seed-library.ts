// Fills data/library.json with real research records (PubMed, Europe PMC, OpenAlex,
// Semantic Scholar) for a starter set of topics.
// Run with:  npm run seed
// Safe to re-run: records are deduplicated by PMID/DOI.
//
// Every record comes straight from each database's official API. Nothing is
// written by hand or by AI. To add a specific paper, add its PMID to EXTRA_PMIDS.

import type { AgeGroup } from "../shared/types.js";
import { config } from "../server/config.js";
import { Library } from "../server/research/library.js";
import { efetch } from "../server/research/pubmed.js";
import { DEFAULT_SOURCES, searchSources } from "../server/research/sources/index.js";
import { DAYS, SCENARIOS } from "../src/character/scenarios.js";

const TOPICS: { query: string; humansOnly?: boolean; ageGroups?: AgeGroup[] }[] = [
  { query: "sleep deprivation working memory", humansOnly: true },
  { query: "sleep memory consolidation hippocampus" },
  { query: "stress memory hippocampus cortisol" },
  { query: "working memory prefrontal cortex fMRI", humansOnly: true },
  { query: "working memory meta-analysis neuroimaging" },
  { query: "adolescent brain development prefrontal cortex", humansOnly: true },
  { query: "attention parietal cortex fMRI", humansOnly: true },
  { query: "amygdala emotion processing", humansOnly: true },
  { query: "aerobic exercise hippocampus volume", humansOnly: true },
  { query: "cerebellum motor learning" },
  { query: "reward nucleus accumbens dopamine", humansOnly: true },
  { query: "language Broca area fMRI", humansOnly: true },
];

// Every character situation and daily moment, searched in general and for the life stages it fits.
const STAGE_GROUPS: Record<string, AgeGroup> = { child: "child", teen: "adolescent", adult: "adult", "older-adult": "older-adult" };
const seen = new Set<string>();
for (const s of SCENARIOS) {
  for (const stage of s.stages ?? ["child", "teen", "adult", "older-adult"]) {
    const key = `${s.focus}|${stage}`;
    if (!seen.has(key)) TOPICS.push({ query: s.focus, ageGroups: [STAGE_GROUPS[stage]] }), seen.add(key);
  }
  TOPICS.push({ query: s.focus });
}
for (const [stage, events] of Object.entries(DAYS)) {
  for (const e of events) {
    const key = `${e.focus}|${stage}`;
    if (!seen.has(key)) TOPICS.push({ query: e.focus, ageGroups: [STAGE_GROUPS[stage]] }), seen.add(key);
  }
}

const EXTRA_PMIDS: string[] = [];
const PER_TOPIC = 8; // per source

async function main() {
  const library = new Library(config.dataDir);
  console.log(`Library currently has ${library.size} records.`);
  if (!config.ncbiEmail) console.warn("Tip: set NCBI_EMAIL in .env — NCBI asks tools to identify a contact email.");

  for (const t of TOPICS) {
    const filters = { humansOnly: t.humansOnly, ageGroups: t.ageGroups, neuroFocus: true };
    // Age-filtered topics only make sense for sources with age indexing.
    const { records, coverage } = await searchSources(DEFAULT_SOURCES, undefined, t.query, [{ filters, onlyAgeCapable: Boolean(t.ageGroups) }], PER_TOPIC);
    const added = library.upsert(records);
    const summary = coverage
      .filter((c) => c.searched || (c.error && c.error !== "not searched"))
      .map((c) => (c.searched ? `${c.source} ${c.resultCount}` : `${c.source} ✗ (${c.error})`))
      .join(", ");
    console.log(`${records.length ? "✓" : "✗"} "${t.query}"${t.ageGroups ? ` [${t.ageGroups.join(",")}]` : ""}: ${summary || "no sources"} → ${added} new`);
  }
  if (EXTRA_PMIDS.length) {
    const records = await efetch(EXTRA_PMIDS);
    console.log(`✓ extra PMIDs: ${library.upsert(records)} new`);
  }
  console.log(`Done. Library now has ${library.size} records.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
