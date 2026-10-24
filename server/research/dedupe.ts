import type { ResearchRecord } from "../../shared/types.js";

// Two records describe the same paper if they share a PMID or DOI. As a last
// resort (no identifiers), the same normalized title + year counts as a match.

function titleKey(r: ResearchRecord): string {
  return `${r.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${r.publicationYear ?? ""}`;
}

/** How complete a record is — used to pick which duplicate to keep. */
function completeness(r: ResearchRecord): number {
  return (
    (r.abstract.length ? 4 : 0) +
    (r.doi ? 1 : 0) +
    (r.pmid ? 1 : 0) +
    r.meshTerms.length / 100 +
    (r.verification === "manually-reviewed" ? 10 : 0)
  );
}

export function dedupeRecords(records: ResearchRecord[]): ResearchRecord[] {
  const kept: ResearchRecord[] = [];
  const index = new Map<string, number>(); // identifier → position in `kept`

  for (const rec of records) {
    const keys = [
      rec.pmid && `pmid:${rec.pmid}`,
      rec.doi && `doi:${rec.doi.toLowerCase()}`,
      `title:${titleKey(rec)}`,
    ].filter(Boolean) as string[];

    const existingPos = keys.map((k) => index.get(k)).find((p) => p !== undefined);
    if (existingPos === undefined) {
      kept.push(rec);
      keys.forEach((k) => index.set(k, kept.length - 1));
    } else {
      const existing = kept[existingPos];
      // Keep the more complete version but fill in any identifier it lacked.
      const better = completeness(rec) > completeness(existing) ? rec : existing;
      const other = better === rec ? existing : rec;
      kept[existingPos] = {
        ...better,
        doi: better.doi ?? other.doi,
        pmcid: better.pmcid ?? other.pmcid,
        doiUrl: better.doiUrl ?? other.doiUrl,
      };
      keys.forEach((k) => index.set(k, existingPos));
    }
  }
  return kept;
}
