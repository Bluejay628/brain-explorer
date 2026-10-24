// Fills data/library.json with real PubMed records for a starter set of topics.
// Run with:  npm run seed
// Safe to re-run: records are deduplicated by PMID/DOI.
//
// Every record comes straight from NCBI E-utilities. Nothing is written by hand
// or by AI. To add a specific paper, add its PMID to EXTRA_PMIDS.

import { config } from "../server/config.js";
import { Library } from "../server/research/library.js";
import { searchPubmed, efetch } from "../server/research/pubmed.js";

const TOPICS: { query: string; humansOnly?: boolean }[] = [
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

const EXTRA_PMIDS: string[] = [];
const PER_TOPIC = 12;

async function main() {
  const library = new Library(config.dataDir);
  console.log(`Library currently has ${library.size} records.`);
  if (!config.ncbiEmail) console.warn("Tip: set NCBI_EMAIL in .env — NCBI asks tools to identify a contact email.");

  for (const t of TOPICS) {
    try {
      const { records, total } = await searchPubmed(t.query, { humansOnly: t.humansOnly }, PER_TOPIC);
      const added = library.upsert(records);
      console.log(`✓ "${t.query}": ${records.length} fetched (of ${total} in PubMed), ${added} new`);
    } catch (err) {
      console.error(`✗ "${t.query}": ${(err as Error).message}`);
    }
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
