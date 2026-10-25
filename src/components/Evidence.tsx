import { SOURCE_INFO, type AgeGroup, type EvidenceMethod, type PublicationCategory, type Provenance, type ResearchRecord } from "../../shared/types";

export const CATEGORY_LABEL: Record<PublicationCategory, string> = {
  "meta-analysis": "Meta-analysis",
  "systematic-review": "Systematic review",
  review: "Review article",
  "randomized-controlled-trial": "Randomized controlled trial",
  "clinical-trial": "Clinical trial",
  "original-research": "Original research",
  "case-report": "Case report",
  "editorial-or-comment": "Editorial / comment",
  preprint: "Preprint (not peer reviewed)",
  other: "Other publication",
};

export const CATEGORY_HELP: Record<PublicationCategory, string> = {
  "meta-analysis": "Statistically combines results from many studies. Strong for summarizing, but only as good as the studies included.",
  "systematic-review": "Searches and appraises all studies on a question using a fixed method. Summarizes evidence; not a new experiment.",
  review: "A narrative overview of existing research. Useful background; not new data and may be selective.",
  "randomized-controlled-trial": "Participants are randomly assigned to conditions — the design that best supports cause-and-effect claims.",
  "clinical-trial": "Tests an intervention in people. Check whether assignment was randomized.",
  "original-research": "A study reporting new data. Could be experimental or observational — check the methods.",
  "case-report": "Describes one or a few individuals. Can raise hypotheses; cannot establish general patterns.",
  "editorial-or-comment": "Opinion or commentary, not new evidence.",
  preprint: "Shared publicly before peer review. Other scientists have not yet checked it — treat findings as preliminary.",
  other: "Publication type not classified.",
};

const CATEGORY_TONE: Record<PublicationCategory, string> = {
  "meta-analysis": "violet",
  "systematic-review": "violet",
  review: "amber",
  "randomized-controlled-trial": "green",
  "clinical-trial": "green",
  "original-research": "cyan",
  "case-report": "",
  "editorial-or-comment": "",
  preprint: "red",
  other: "",
};

export const METHOD_LABEL: Record<EvidenceMethod, string> = {
  "functional-mri": "Functional MRI",
  "structural-mri": "Structural MRI",
  "diffusion-connectivity": "Diffusion / white matter",
  "functional-connectivity": "Functional connectivity",
  "eeg-meg": "EEG / MEG",
  pet: "PET",
  lesion: "Lesion study",
  "brain-stimulation": "Brain stimulation",
  behavioral: "Behavioral",
  "animal-model": "Animal model",
  computational: "Computational",
};

export const AGE_LABEL: Record<AgeGroup, string> = {
  child: "Children",
  adolescent: "Adolescents",
  "young-adult": "Young adults",
  adult: "Adults",
  "middle-aged": "Middle-aged",
  "older-adult": "Older adults",
};

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  source: "Verbatim from the source",
  "pubmed-indexing": "PubMed indexing",
  "keyword-derived": "Auto-detected by keyword — verify",
  "ai-summary": "AI interpretation",
};

export function CategoryChip({ record }: { record: ResearchRecord }) {
  const c = record.category.value;
  return (
    <span className={`chip ${CATEGORY_TONE[c]}`} title={CATEGORY_HELP[c]}>
      {CATEGORY_LABEL[c]}
    </span>
  );
}

export function EvidenceChips({ record, max = 4 }: { record: ResearchRecord; max?: number }) {
  const methods = record.methods.value.slice(0, max);
  const species = record.species.value.filter((s) => s !== "Animals");
  return (
    <div className="row wrap" style={{ gap: 6 }}>
      <CategoryChip record={record} />
      {methods.map((m) => (
        <span key={m} className="chip" title="Detected from abstract keywords — may be incomplete">
          {METHOD_LABEL[m]}
        </span>
      ))}
      {species.slice(0, 2).map((s) => (
        <span key={s} className="chip" title="From PubMed MeSH indexing">{s}</span>
      ))}
      {!record.abstract.length && <span className="chip amber">No abstract</span>}
      <span className="chip" title="Databases this paper was found in">{foundInLabel(record)}</span>
    </div>
  );
}

export function formatAuthors(r: ResearchRecord, max = 3): string {
  if (!r.authors.length) return "Authors not listed";
  const names = r.authors
    .slice(0, max)
    .map((a) => a.collective ?? ([a.lastName, a.foreName?.split(" ").map((p) => p[0]).join("")].filter(Boolean).join(" ") || a.fullName || ""));
  return names.join(", ") + (r.authors.length > max ? " et al." : "");
}

/** Which databases a record was found in, e.g. "PubMed · OpenAlex". */
export function foundInLabel(r: ResearchRecord): string {
  return (r.foundIn ?? [r.source]).map((id) => SOURCE_INFO[id]?.name ?? id).join(" · ");
}

export function sourceLinkLabel(r: ResearchRecord): string {
  return SOURCE_INFO[r.source]?.name ?? "Source";
}
