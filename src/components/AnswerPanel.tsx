import { useMemo, useState } from "react";
import type { CitedClaim, ResearchAnswer, SourceCoverage } from "../../shared/types";
import { REGION_BY_ID } from "../../shared/regions";
import { StudyCard } from "./StudyCard";
import { BrainMapStatus } from "./BrainMaps";
import { IconAlert, IconCheck, IconInfo, IconShield, IconX } from "../icons";

const CLAIM_LABEL: Record<CitedClaim["claimType"], { label: string; tone: string; help: string }> = {
  "reported-finding": { label: "Reported by authors", tone: "cyan", help: "What the cited study's authors reported in their abstract." },
  interpretation: { label: "AI interpretation", tone: "violet", help: "The AI's synthesis across studies — not a finding any one paper reported." },
  hypothesis: { label: "Hypothesis", tone: "amber", help: "A proposed explanation, not an established finding." },
  "open-question": { label: "Open question", tone: "", help: "Something the evidence does not yet answer." },
};

const SOURCE_LABEL: Record<SourceCoverage["source"], string> = { "local-library": "Local research library", pubmed: "PubMed (NCBI)" };

interface Props {
  answer: ResearchAnswer;
  onSelectRegion?: (id: string) => void;
}

export function AnswerPanel({ answer, onSelectRegion }: Props) {
  const [focus, setFocus] = useState<string | null>(null);
  const indexOf = useMemo(() => new Map(answer.evidence.map((r, i) => [r.id, i + 1])), [answer.evidence]);
  const notes = useMemo(() => new Map(answer.supportingStudies.map((s) => [s.recordId, s])), [answer.supportingStudies]);
  const recordById = useMemo(() => new Map(answer.evidence.map((r) => [r.id, r])), [answer.evidence]);

  const jump = (id: string) => {
    setFocus(id);
    document.getElementById(`study-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const Cites = ({ ids }: { ids: string[] }) => (
    <>
      {ids.map((id) => (
        <button key={id} className="cite" onClick={() => jump(id)} aria-label={`Go to study ${indexOf.get(id)}`}>
          {indexOf.get(id)}
        </button>
      ))}
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
    answered: { cls: "cyan", icon: <IconShield size={16} />, text: `AI synthesis of ${answer.evidence.length} retrieved ${answer.evidence.length === 1 ? "study" : "studies"}. Every citation was checked against the retrieved records — open the sources to verify.` },
    "insufficient-evidence": { cls: "amber", icon: <IconAlert size={16} />, text: "Insufficient evidence. The retrieved research does not support a confident answer to this question." },
    "retrieval-only": { cls: "cyan", icon: <IconInfo size={16} />, text: "Retrieval-only mode: showing the studies found for your question, without an AI summary." },
    "ai-error": { cls: "red", icon: <IconX size={16} />, text: "The AI summary could not be generated. The retrieved studies are still shown." },
  }[answer.status];

  return (
    <div className="answer stack fade-in" aria-live="polite">
      <div className={`notice ${banner.cls}`}>{banner.icon}<span>{banner.text}</span></div>

      {answer.directAnswer && (
        <section>
          <div className="section-label">{answer.status === "answered" ? "Direct answer · AI interpretation" : "Summary"}</div>
          <p className="direct">{answer.directAnswer}</p>
        </section>
      )}

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
          {answer.limitations.length > 0 && (
            <ul className="clean">{answer.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul>
          )}
          {answer.uncertainty && <p className="small dim" style={{ marginTop: 8 }}>{answer.uncertainty}</p>}
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
            Highlighted in violet on the model. This marks where cited abstracts report results — it is not an activation map and shows no effect sizes.
          </p>
        </section>
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
                {!c.searched && !c.error && <span className="faint"> — not needed (enough local evidence)</span>}
              </span>
              <span className="mono faint">
                {c.searched ? `${c.resultCount} found${c.totalAvailable !== undefined && c.source === "pubmed" ? ` of ${c.totalAvailable.toLocaleString()}` : ""}` : "—"}
              </span>
            </div>
          ))}
        </div>
        <p className="xs faint" style={{ marginTop: 8 }}>No other sources (web search, full-text databases) were searched.</p>
        <hr className="divider" />
        <div className="section-label">How your question was interpreted</div>
        <ul className="clean xs">{answer.intent.interpretationNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        <p className="xs faint" style={{ marginTop: 6 }}>Search terms: <span className="mono">{answer.intent.topic}</span></p>
        {answer.validationNotes.length > 0 && (
          <>
            <hr className="divider" />
            <div className="section-label">Citation checks</div>
            <ul className="clean xs">{answer.validationNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>
          </>
        )}
      </section>

      {answer.evidence.length > 0 && (
        <section>
          <div className="section-label">Retrieved evidence ({answer.evidence.length})</div>
          <div className="stack-sm">
            {answer.evidence.map((r, i) => {
              const note = notes.get(r.id);
              return (
                <div key={r.id}>
                  <StudyCard record={r} index={i + 1} highlight={focus === r.id} />
                  {note && (
                    <div className="xs dim" style={{ padding: "6px 16px 0" }}>
                      <span className="chip violet" style={{ height: 18, fontSize: 10.5, marginRight: 6 }}>AI note</span>
                      {note.relevance} {note.evidenceNote && <span className="faint">— {note.evidenceNote}</span>}
                    </div>
                  )}
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
