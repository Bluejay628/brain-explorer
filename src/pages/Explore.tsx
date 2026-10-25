import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ResearchAnswer } from "../../shared/types";
import { REGION_BY_ID } from "../../shared/regions";
import { api } from "../api";
import { useStore } from "../store";
import { BrainViewer } from "../components/BrainViewer";
import { AskBox } from "../components/AskBox";
import { AnswerPanel } from "../components/AnswerPanel";
import { RegionPanel } from "../components/RegionPanel";
import { SubdivisionPanel } from "../components/SubdivisionPanel";
import { StudyCardSkeleton } from "../components/StudyCard";
import { CharacterCard } from "../character/CharacterCard";
import { DayTimeline, SituationGrid } from "../character/Situations";
import { DAY, SCENARIOS, characterQuestion, type Scenario, type TimelineEvent } from "../character/scenarios";
import { IconX } from "../icons";

type Tab = "situations" | "day" | "answer" | "region" | "subdivisions";

export function Explore() {
  const [params, setParams] = useSearchParams();
  const { settings, addHistory, character, pinned } = useStore();
  const name = character.name.trim() || "Leo";
  const [region, setRegion] = useState<string | null>(params.get("region"));
  const [tab, setTab] = useState<Tab>(params.get("q") || params.get("s") ? "answer" : params.get("region") ? "region" : "situations");
  const [answer, setAnswer] = useState<ResearchAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSituation, setActiveSituation] = useState<string | undefined>();
  const [lastAsk, setLastAsk] = useState<{ q: string; focus?: string } | null>(null);
  const lastUrlQuestion = useRef<string | null>(null);
  const question = params.get("q") ?? "";

  const run = useCallback(
    async (q: string, focus?: string) => {
      setBusy(true);
      setError(null);
      setTab("answer");
      setLastAsk({ q, focus });
      try {
        const res = await api.ask(q, {
          selectedRegionId: region ?? undefined,
          allowPubMed: settings.includePubMedByDefault,
          character: { name, age: character.age },
          includeHormones: character.includeHormones,
          focus,
          sources: settings.sources.length ? settings.sources : undefined,
          allowWeb: settings.webSearch,
        });
        setAnswer(res);
        addHistory({ kind: "question", value: q, label: q });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [region, settings.includePubMedByDefault, settings.sources, settings.webSearch, name, character.age, character.includeHormones, addHistory],
  );

  // Ask whenever the ?q= parameter changes (from Home, history links, or the ask box).
  useEffect(() => {
    if (question && question !== lastUrlQuestion.current) {
      lastUrlQuestion.current = question;
      setActiveSituation(undefined);
      void run(question);
    }
  }, [question, run]);

  // ?s=<situation id> (from the Home page) runs that situation once.
  const situationParam = params.get("s");
  const ranSituation = useRef<string | null>(null);
  useEffect(() => {
    const s = SCENARIOS.find((x) => x.id === situationParam) ?? DAY.find((x) => x.time === situationParam);
    if (s && ranSituation.current !== situationParam) {
      ranSituation.current = situationParam;
      runSituation(s);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situationParam]);

  const ask = (q: string) => {
    setActiveSituation(undefined);
    if (q === question) return void run(q);
    const next = new URLSearchParams(params);
    next.set("q", q);
    setParams(next);
  };

  const runSituation = (s: Scenario | TimelineEvent) => {
    setActiveSituation(s.situation);
    void run(characterQuestion(name, character.age, s.situation, character.includeHormones), s.focus);
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
  const tabs: [Tab, string][] = [
    ["situations", "Situations"],
    ["day", "Day in his life"],
    ["answer", "Answer"],
    ["region", region ? `Region · ${REGION_BY_ID.get(region)?.name.replace(/ \(.*\)/, "")}` : "Region"],
    ["subdivisions", `Subdivisions${pinned.length ? ` (${pinned.length})` : ""}`],
  ];

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="eyebrow">Character brain lab</div>
          <h1>Inside {name}'s brain</h1>
          <p>Choose a situation, follow his day, or ask anything. Every explanation is built from published research — with sources you can open.</p>
        </div>
      </header>

      <div className="lab-top">
        <CharacterCard />
        <div className="stack-sm" style={{ justifyContent: "center" }}>
          <AskBox onAsk={ask} initial={question} busy={busy} placeholder={`Ask anything about ${name}'s brain…`} />
          {region && (
            <div className="row xs dim">
              Selected: <span className="chip cyan">{REGION_BY_ID.get(region)?.name}</span>
              <span className="faint">Questions that say "this region" refer to it.</span>
              <button className="btn sm ghost icon" onClick={() => selectRegion(null)} aria-label="Clear selected region"><IconX size={14} /></button>
            </div>
          )}
        </div>
      </div>

      <div className="explore">
        <div className="viewer-frame" style={{ padding: 12 }}>
          <BrainViewer
            selected={region}
            onSelect={selectRegion}
            cited={cited}
            pinned={pinned}
            autoRotate={settings.autoRotate && !region}
            showRegionList
            caption={`${name}'s brain is shown with an average brain model (FreeSurfer fsaverage, Desikan-Killiany atlas) — not a scan of him, and not brain activity`}
          />
        </div>

        <div className="panel panel-pad" style={{ minHeight: 400 }}>
          <div className="tabs" role="tablist">
            {tabs.map(([id, label]) => (
              <button key={id} role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>

          {tab === "situations" && <SituationGrid onRun={runSituation} activeSituation={activeSituation} busy={busy} name={name} />}
          {tab === "day" && <DayTimeline onRun={runSituation} activeSituation={activeSituation} busy={busy} name={name} />}
          {tab === "region" && <RegionPanel regionId={region} onAsk={ask} onSelect={selectRegion} />}
          {tab === "subdivisions" && <SubdivisionPanel onSelect={selectRegion} onAsk={ask} />}

          {tab === "answer" && (
            <>
              {lastAsk && <p className="small dim" style={{ marginBottom: 12 }}><span className="faint">Question:</span> {lastAsk.q}</p>}
              {busy && (
                <div className="stack">
                  <div className="row small dim"><span className="spinner" /> Searching research on people {name}'s age{settings.includePubMedByDefault ? ` (library + ${settings.sources.length} online databases)` : ""}, then checking every citation…</div>
                  <StudyCardSkeleton />
                  <StudyCardSkeleton />
                </div>
              )}
              {!busy && error && (
                <div className="notice red">
                  <IconX size={16} />
                  <div className="grow">
                    {error}
                    {lastAsk && <div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => run(lastAsk.q, lastAsk.focus)}>Try again</button></div>}
                  </div>
                </div>
              )}
              {!busy && !error && answer && <AnswerPanel answer={answer} onSelectRegion={selectRegion} />}
              {!busy && !error && !answer && (
                <div className="empty">
                  <p>No question yet. Pick a situation, a moment in {name}'s day, or type a question above.</p>
                  <button className="btn" style={{ marginTop: 12 }} onClick={() => setTab("situations")}>Browse situations</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
