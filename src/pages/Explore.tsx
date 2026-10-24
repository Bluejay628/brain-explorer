import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ResearchAnswer } from "../../shared/types";
import { REGION_BY_ID } from "../../shared/regions";
import { api } from "../api";
import { useStore } from "../store";
import { BrainViewer } from "../components/BrainViewer";
import { AskBox, SUGGESTED_QUESTIONS } from "../components/AskBox";
import { AnswerPanel } from "../components/AnswerPanel";
import { RegionPanel } from "../components/RegionPanel";
import { StudyCardSkeleton } from "../components/StudyCard";
import { IconSpark, IconX } from "../icons";

type Tab = "answer" | "region";

export function Explore() {
  const [params, setParams] = useSearchParams();
  const { settings, addHistory } = useStore();
  const [region, setRegion] = useState<string | null>(params.get("region"));
  const [tab, setTab] = useState<Tab>(params.get("region") && !params.get("q") ? "region" : "answer");
  const [answer, setAnswer] = useState<ResearchAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAsked = useRef<string | null>(null);
  const question = params.get("q") ?? "";

  const run = useCallback(
    async (q: string) => {
      setBusy(true);
      setError(null);
      setTab("answer");
      try {
        const res = await api.ask(q, { selectedRegionId: region ?? undefined, allowPubMed: settings.includePubMedByDefault });
        setAnswer(res);
        addHistory({ kind: "question", value: q, label: q });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [region, settings.includePubMedByDefault, addHistory],
  );

  // Ask whenever the ?q= parameter changes (from Home, history links, or this page).
  useEffect(() => {
    if (question && question !== lastAsked.current) {
      lastAsked.current = question;
      void run(question);
    }
  }, [question, run]);

  const ask = (q: string) => {
    if (q === question) {
      void run(q); // same question again = retry
      return;
    }
    const next = new URLSearchParams(params);
    next.set("q", q);
    setParams(next);
  };

  const selectRegion = (id: string | null) => {
    setRegion(id);
    const next = new URLSearchParams(params);
    if (id) {
      next.set("region", id);
      setTab("region");
      addHistory({ kind: "region", value: id, label: REGION_BY_ID.get(id)?.name ?? id });
    } else next.delete("region");
    setParams(next, { replace: true });
  };

  const cited = answer?.regions.map((r) => r.name) ?? [];

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="eyebrow">Explore brain</div>
          <h1>Ask the research</h1>
        </div>
      </header>
      <div style={{ marginBottom: 16 }}>
        <AskBox onAsk={ask} initial={question} busy={busy} />
        {region && (
          <div className="row xs dim" style={{ marginTop: 8 }}>
            Selected region: <span className="chip cyan">{REGION_BY_ID.get(region)?.name}</span>
            <span className="faint">Questions that say "this region" will refer to it.</span>
            <button className="btn sm ghost icon" onClick={() => selectRegion(null)} aria-label="Clear selected region"><IconX size={14} /></button>
          </div>
        )}
      </div>

      <div className="explore">
        <div className="viewer-frame" style={{ padding: 12 }}>
          <BrainViewer selected={region} onSelect={selectRegion} cited={cited} autoRotate={settings.autoRotate && !region} showRegionList />
        </div>

        <div className="panel panel-pad" style={{ minHeight: 400 }}>
          <div className="tabs" role="tablist">
            <button role="tab" className="tab" aria-selected={tab === "answer"} onClick={() => setTab("answer")}>Research answer</button>
            <button role="tab" className="tab" aria-selected={tab === "region"} onClick={() => setTab("region")}>
              Region info{region ? ` · ${REGION_BY_ID.get(region)?.name}` : ""}
            </button>
          </div>

          {tab === "region" && <RegionPanel regionId={region} onAsk={ask} />}

          {tab === "answer" && (
            <>
              {busy && (
                <div className="stack">
                  <div className="row small dim"><span className="spinner" /> Searching the library{settings.includePubMedByDefault ? " and PubMed" : ""}, then checking the evidence…</div>
                  <StudyCardSkeleton />
                  <StudyCardSkeleton />
                </div>
              )}
              {!busy && error && (
                <div className="notice red">
                  <IconX size={16} />
                  <div className="grow">
                    {error}
                    <div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => run(question)}>Try again</button></div>
                  </div>
                </div>
              )}
              {!busy && !error && answer && <AnswerPanel answer={answer} onSelectRegion={selectRegion} />}
              {!busy && !error && !answer && (
                <div className="stack-sm">
                  <p className="dim small" style={{ marginBottom: 6 }}>Ask a question, or try one of these:</p>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button key={q} className="suggestion" onClick={() => ask(q)}><IconSpark size={14} /> {q}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
