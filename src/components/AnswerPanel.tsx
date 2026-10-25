import { useMemo, useState } from "react";
import type { ClaimType, CitedClaim, PopulationMatch, ResearchAnswer, SourceCoverage } from "../../shared/types";
import { REGION_BY_ID } from "../../shared/regions";
import { StudyCard } from "./StudyCard";
import { BrainMapStatus } from "./BrainMaps";
import { Bibliography, CiteButton } from "./Cite";
import { IconAlert, IconCheck, IconInfo, IconShield, IconX } from "../icons";

const CLAIM_LABEL: Record<ClaimType, { label: string; tone: string; help: string }> = {
  "reported-finding": { label: "Reported by the source", tone: "cyan", help: "What the cited study's authors (or the cited trusted web page) reported." },
  interpretation: { label: "AI interpretation", tone: "violet", help: "The AI's synthesis across studies — not a finding any one paper reported." },
  hypothesis: { label: "Hypothesis", tone: "amber", help: "A proposed explanation, not an established finding." },
  "open-question": { label: "Open question", tone: "", help: "Something the evidence does not yet answer." },
  "textbook-background": { label: "Textbook background", tone: "", help: "General anatomy from Brain Explorer's region overviews — not a research finding." },
};

const CONFIDENCE = {
  strong: { label: "Strong", width: "100%", color: "var(--green)" },
  moderate: { label: "Moderate", width: "66%", color: "var(--cyan)" },
  limited: { label: "Limited", width: "36%", color: "var(--amber)" },
  insufficient: { label: "Insufficient", width: "10%", color: "var(--red)" },
};

const SOURCE_LABEL: Record<SourceCoverage["source"], string> = {
  "local-library": "Local research library",
  pubmed: "PubMed (NCBI)",
  europepmc: "Europe PMC",
  openalex: "OpenAlex",
  semanticscholar: "Semantic Scholar",
  web: "Trusted websites (web search)",
};

function PopulationBadge({ m }: { m?: PopulationMatch }) {
  if (!m) return null;
  const tone = m.species === "animal" ? "amber" : m.age === "same-age-group" ? "green" : m.age === "different-age-group" ? "amber" : "";
  const label = m.species === "animal" ? "Animal study" : m.age === "same-age-group" ? "Same age group" : m.age === "different-age-group" ? "Different age group" : "Age not indexed";
  return (
    <span className="row xs dim" style={{ gap: 6 }}>
      <span className={`chip ${tone}`}>{label}</span>
      {m.note}
    </span>
  );
}

interface Props {
  answer: ResearchAnswer;
  onSelectRegion?: (id: string) => void;
}

export function AnswerPanel({ answer, onSelectRegion }: Props) {
  const [focus, setFocus] = useState<string | null>(null);
  const indexOf = useMemo(() => new Map(answer.evidence.map((r, i) => [r.id, i + 1])), [answer.evidence]);
  const webIndex = useMemo(() => new Map(answer.webSources.map((w, i) => [w.id, i + 1])), [answer.webSources]);
  const notes = useMemo(() => new Map(answer.supportingStudies.map((s) => [s.recordId, s])), [answer.supportingStudies]);
  const recordById = useMemo(() => new Map(answer.evidence.map((r) => [r.id, r])), [answer.evidence]);
  const name = answer.character?.name;

  const jump = (id: string) => {
    setFocus(id);
    document.getElementById(`study-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const Cites = ({ ids }: { ids: string[] }) => (
    <>
      {ids.map((id) =>
        id.startsWith("web:") ? (
          <button key={id} className="cite web" onClick={() => jump(id)} title="Web page — click to see it">
            W{webIndex.get(id)}
          </button>
        ) : id.startsWith("region:") ? (
          <button key={id} className="cite bg" onClick={() => onSelectRegion?.(id.slice(7))} title="Textbook background — click to see this region">
            {REGION_BY_ID.get(id.slice(7))?.name.replace(/ \(.*\)/, "") ?? id}
          </button>
        ) : (
          <button key={id} className="cite" onClick={() => jump(id)} aria-label={`Go to study ${indexOf.get(id)}`}>
            {indexOf.get(id)}
          </button>
        ),
      )}
    </>
  );

  const Claims = ({ claims }: { claims: CitedClaim[] }) => (
    <div className="stack-sm">
      {claims.map((c, i) => (
        <div key={i} className={`claim ${c.claimType}`}>
          <span className={`chip ${CLAIM_LABEL[c.claimType].tone}`} title={CLAIM_LABEL[c.claimType].help} style={{ marginBottom: 6 }}>
            {CLAIM_LABEL[c.claimType].label}
          </span>
          <div className="small" style={{ marginTop: 4 }}>
            {c.text}
            <Cites ids={c.citations} />
          </div>
        </div>
      ))}
    </div>
  );

  const banner = {
    answered: {
      cls: "cyan",
      icon: <IconShield size={16} />,
      text: `Built from ${answer.evidence.length} retrieved ${answer.evidence.length === 1 ? "study" : "studies"}${answer.webSources.length ? ` and ${answer.webSources.length} trusted web page${answer.webSources.length === 1 ? "" : "s"}` : ""}. Every citation was checked — click a number to inspect the source.`,
    },
    "insufficient-evidence": { cls: "amber", icon: <IconAlert size={16} />, text: "Insufficient evidence. The retrieved research does not support a confident answer to this question." },
    "retrieval-only": { cls: "cyan", icon: <IconInfo size={16} />, text: "Retrieval-only mode: showing the studies found for your question, without an AI summary." },
    "ai-error": { cls: "red", icon: <IconX size={16} />, text: "The AI summary could not be generated. The retrieved studies are still shown." },
  }[answer.status];

  const conf = CONFIDENCE[answer.confidence.level];
  const hasDetails = answer.mainFindings.length + answer.mixedOrContradictory.length + answer.limitations.length > 0 || !!answer.uncertainty;

  return (
    <div className="answer stack fade-in" aria-live="polite">
      <div className={`notice ${banner.cls}`}>{banner.icon}<span>{banner.text}</span></div>

      {answer.directAnswer && (
        <section>
          <div className="section-label">{answer.status === "answered" ? "Short answer · AI summary of the studies" : "Summary"}</div>
          <p className="direct">{answer.directAnswer}</p>
        </section>
      )}

      {answer.studentExplanation.length > 0 && (
        <section className="student">
          <div className="section-label">What happens in {name ? `${name}'s` : "the"} brain</div>
          <ol className="student-steps">
            {answer.studentExplanation.map((p, i) => (
              <li key={i}>
                <h3>{p.heading}</h3>
                <p>
                  {p.text}
                  <Cites ids={p.citations} />
                </p>
                <span className={`chip ${CLAIM_LABEL[p.claimType].tone}`} title={CLAIM_LABEL[p.claimType].help}>{CLAIM_LABEL[p.claimType].label}</span>
              </li>
            ))}
          </ol>
          {name && <p className="xs faint">Based on studies of groups of people. {name} is fictional; real brains vary.</p>}
        </section>
      )}

      {answer.hormones.length > 0 && (
        <section>
          <div className="section-label">Hormones involved</div>
          <div className="hormone-grid">
            {answer.hormones.map((h) => (
              <div key={h.hormone} className="panel hormone">
                <strong>{h.hormone}</strong>
                <p className="small dim">{h.role}<Cites ids={h.citations} /></p>
              </div>
            ))}
          </div>
        </section>
      )}

      {answer.status === "answered" && (
        <section className="panel panel-pad">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="section-label" style={{ margin: 0 }}>How sure are scientists?</div>
            <span className="small" style={{ color: conf.color, fontWeight: 600 }}>{conf.label}</span>
          </div>
          <div className="meter" role="img" aria-label={`Evidence strength: ${conf.label}`}><span style={{ width: conf.width, background: conf.color }} /></div>
          <p className="xs dim">{answer.confidence.reason} <span className="faint">(AI judgment based on the retrieved studies.)</span></p>
        </section>
      )}

      {answer.keyTerms.length > 0 && (
        <section>
          <div className="section-label">Key terms</div>
          <dl className="terms">
            {answer.keyTerms.map((t) => (
              <div key={t.term}><dt>{t.term}</dt><dd>{t.definition}</dd></div>
            ))}
          </dl>
        </section>
      )}

      {answer.regions.length > 0 && (
        <section>
          <div className="section-label">Brain regions discussed by cited studies</div>
          <div className="row wrap" style={{ gap: 6 }}>
            {answer.regions.map((r) => (
              <span key={r.name} className="row" style={{ gap: 2 }}>
                <button className="chip violet" onClick={() => onSelectRegion?.(r.name)}>{REGION_BY_ID.get(r.name)?.name ?? r.name}</button>
                <Cites ids={r.citations} />
              </span>
            ))}
          </div>
          <p className="xs faint" style={{ marginTop: 6 }}>
            Highlighted in violet on the brain. This marks where cited studies report results — it is not an activation map and shows no effect sizes.
          </p>
        </section>
      )}

      {hasDetails && (
        <details className="details panel" open={answer.studentExplanation.length === 0}>
          <summary>Research details: findings, disagreements, limitations</summary>
          <div className="stack" style={{ padding: "4px 16px 16px" }}>
            {answer.mainFindings.length > 0 && (
              <section>
                <div className="section-label">Main findings</div>
                <Claims claims={answer.mainFindings} />
              </section>
            )}
            {answer.mixedOrContradictory.length > 0 && (
              <section>
                <div className="section-label">Mixed or contradictory findings</div>
                <Claims claims={answer.mixedOrContradictory} />
              </section>
            )}
            {(answer.limitations.length > 0 || answer.uncertainty) && (
              <section>
                <div className="section-label">Limitations &amp; uncertainty</div>
                {answer.limitations.length > 0 && <ul className="clean">{answer.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>}
                {answer.uncertainty && <p className="small dim" style={{ marginTop: 8 }}>{answer.uncertainty}</p>}
              </section>
            )}
          </div>
        </details>
      )}

      {answer.brainMaps.length > 0 && (
        <section className="panel panel-pad">
          <div className="section-label">Published brain-map data</div>
          <div className="stack">
            {answer.brainMaps.map((m) => <BrainMapStatus key={m.recordId} map={m} record={recordById.get(m.recordId)} />)}
          </div>
        </section>
      )}

      <section className="panel panel-pad">
        <div className="section-label">Search coverage</div>
        <div className="coverage">
          {answer.coverage.map((c) => (
            <div key={c.source} style={{ display: "contents" }}>
              <span>{c.searched ? <IconCheck size={14} style={{ color: "var(--green)" }} /> : <IconX size={14} style={{ color: c.error ? "var(--red)" : "var(--text-faint)" }} />}</span>
              <span>
                {SOURCE_LABEL[c.source]}
                {c.error && <span className="faint"> — not searched: {c.error}</span>}
                {!c.searched && !c.error && <span className="faint"> — not needed (enough evidence already)</span>}
              </span>
              <span className="mono faint">
                {c.searched ? `${c.resultCount} found${c.totalAvailable !== undefined && c.source === "pubmed" ? ` of ${c.totalAvailable.toLocaleString()}` : ""}` : "—"}
              </span>
            </div>
          ))}
        </div>
        <p className="xs faint" style={{ marginTop: 8 }}>
          Only the databases listed above were searched — not the general web.
          {answer.background.length > 0 && ` Textbook background used: ${answer.background.map((b) => b.name).join(", ")}.`}
        </p>
        <hr className="divider" />
        <div className="section-label">How your question was interpreted</div>
        <ul className="clean xs">{answer.intent.interpretationNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        <p className="xs faint" style={{ marginTop: 6 }}>Search terms: <span className="mono">{answer.intent.scientificTopic}</span></p>
        {answer.validationNotes.length > 0 && (
          <>
            <hr className="divider" />
            <div className="section-label">Citation checks</div>
            <ul className="clean xs">{answer.validationNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </>
        )}
      </section>

      {answer.webSources.length > 0 && (
        <section>
          <div className="section-label">Trusted web pages ({answer.webSources.length})</div>
          <p className="xs faint" style={{ marginBottom: 8 }}>
            Found by the AI's web search, limited to government, university, medical-center and journal sites. Only the quoted excerpts were used. Web pages are not studies — they summarize research.
          </p>
          <div className="stack-sm">
            {answer.webSources.map((w, i) => (
              <article key={w.id} id={`study-${w.id}`} className={`panel web-card${focus === w.id ? " highlight" : ""}`}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div className="grow">
                    <span className="study-index" style={{ color: "var(--amber)" }}>[W{i + 1}]</span>{" "}
                    <a href={w.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>{w.title}</a>
                    <div className="xs faint">{w.domain} · {w.kind.replace("-", " ")}{w.pageAge ? ` · ${w.pageAge}` : ""}</div>
                  </div>
                  <CiteButton web={w} />
                </div>
                {w.excerpts.map((e, j) => <blockquote key={j}>“{e}”</blockquote>)}
              </article>
            ))}
          </div>
        </section>
      )}

      <Bibliography
        records={answer.evidence.filter((r) => [...answer.studentExplanation, ...answer.mainFindings, ...answer.mixedOrContradictory].some((c) => c.citations.includes(r.id)) || answer.status !== "answered")}
        webSources={answer.webSources}
      />

      {answer.evidence.length > 0 && (
        <section>
          <div className="section-label">Retrieved evidence ({answer.evidence.length})</div>
          <div className="stack-sm">
            {answer.evidence.map((r, i) => {
              const note = notes.get(r.id);
              return (
                <div key={r.id}>
                  <StudyCard record={r} index={i + 1} highlight={focus === r.id} />
                  <div className="stack-sm" style={{ padding: "6px 16px 0" }}>
                    <PopulationBadge m={answer.populationMatch[r.id]} />
                    {note && (
                      <div className="xs dim">
                        <span className="chip violet" style={{ height: 18, fontSize: 10.5, marginRight: 6 }}>AI note</span>
                        {note.relevance} {note.evidenceNote && <span className="faint">— {note.evidenceNote}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {answer.model && <p className="xs faint">Generated {new Date(answer.generatedAt).toLocaleString()} by {answer.model}. AI can make mistakes — the original papers are the authority.</p>}
    </div>
  );
}
