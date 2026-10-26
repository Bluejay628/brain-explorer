// Brain Explorer — the whole app on one page.
//
//  Top bar: logo, a few tabs, settings.
//  Brain tabs (Explore, Ask, Leo, Diseases, Cells): the 3D brain on the left,
//  that tab's panel on the right. The brain stays put while you switch tabs.
//  Compare and Studies use the full width.
//  A study opens in a panel that slides over the page (?study=…).

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ResearchAnswer } from "../shared/types";
import { REGION_BY_ID } from "../shared/regions";
import { DISEASE_BY_ID, detectDisease } from "../shared/diseases";
import { api } from "./api";
import { useStore } from "./store";
import { BRAIN_TABS, TABS, useNav, type TabId } from "./nav";
import { BrainViewer } from "./components/BrainViewer";
import { AskBox } from "./components/AskBox";
import { AnswerPanel } from "./components/AnswerPanel";
import { RegionPanel } from "./components/RegionPanel";
import { SubdivisionPanel } from "./components/SubdivisionPanel";
import { StudyCardSkeleton } from "./components/StudyCard";
import { DiseasePicker, DiseaseTimeline, stageOverlay } from "./components/DiseasePanel";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CharacterCard } from "./character/CharacterCard";
import { DayTimeline, SituationGrid } from "./character/Situations";
import { characterQuestion, type Scenario, type TimelineEvent } from "./character/scenarios";
import { CellsPanel } from "./cells/CellsPanel";
import { Compare } from "./pages/Compare";
import { Library } from "./pages/Library";
import { Saved } from "./pages/Saved";
import { Settings } from "./pages/Settings";
import { StudyDetail } from "./pages/StudyDetail";
import { IconSettings, IconSpark, IconX } from "./icons";

const EXAMPLE_QUESTIONS = [
  "How does the hippocampus help form memories?",
  "What does the amygdala do when someone is scared?",
  "How does sleep loss affect attention?",
  "What happens in the brain when you learn a new skill?",
];

/** Old addresses (/explore, /library, /study/…) from before the app was one page. */
function legacyRedirect(pathname: string, search: string): string | null {
  if (pathname === "/") return null;
  const p = new URLSearchParams(search);
  const study = pathname.match(/^\/study\/(.+)$/);
  if (study) return `/?study=${encodeURIComponent(decodeURIComponent(study[1]))}`;
  if (pathname === "/library") return `/?tab=studies${p.get("q") ? `&sq=${encodeURIComponent(p.get("q")!)}` : ""}`;
  if (pathname === "/saved") return "/?tab=studies&view=saved";
  if (pathname === "/compare") return "/?tab=compare";
  if (pathname === "/explore") {
    if (p.get("q")) p.set("tab", "ask");
    else if (p.get("d")) p.set("tab", "diseases");
    return `/?${p.toString()}`;
  }
  return "/";
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const redirect = legacyRedirect(location.pathname, location.search);
  useEffect(() => {
    if (redirect) navigate(redirect, { replace: true });
  }, [redirect, navigate]);

  const nav = useNav();
  const { params, tab, go, update } = nav;
  const { settings, addHistory, history, character, pinned, saved } = useStore();
  const name = character.name.trim() || "Leo";
  const region = params.get("region");
  const question = params.get("q") ?? "";
  const studyId = params.get("study");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── question & answer ──
  const [answer, setAnswer] = useState<ResearchAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAsk, setLastAsk] = useState<{ q: string; focus?: string } | null>(null);
  const [activeSituation, setActiveSituation] = useState<string | undefined>();
  const [leoView, setLeoView] = useState<"situations" | "day">("situations");

  // ── diseases ──
  const [diseaseId, setDiseaseId] = useState<string | undefined>(params.get("d") ?? undefined);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(Boolean(params.get("d")));
  const disease = diseaseId ? DISEASE_BY_ID.get(diseaseId) : undefined;
  const pickDisease = (id: string | undefined, autoplay = true) => {
    setDiseaseId(id);
    setStage(0);
    setPlaying(Boolean(id) && autoplay);
  };

  // ── cells (Allen Brain Cell Atlas) coloring ──
  const [cellOverlay, setCellOverlay] = useState<{ values: Record<string, number>; label: string } | null>(null);
  const onCellOverlay = useCallback((values: Record<string, number> | null, label?: string) => setCellOverlay(values ? { values, label: label ?? "" } : null), []);

  const sideRef = useRef<HTMLDivElement>(null);

  const run = useCallback(
    async (q: string, focus?: string) => {
      setBusy(true);
      setError(null);
      setLastAsk({ q, focus });
      // A question about a long-term disease starts its staging animation on the brain;
      // any other question clears it, so the brain never shows a disease the answer isn't about.
      const d = detectDisease(q);
      if (d) {
        if (d.id !== diseaseId) pickDisease(d.id);
      } else if (diseaseId) pickDisease(undefined);
      if (window.innerWidth < 1100) setTimeout(() => sideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [region, diseaseId, settings.includePubMedByDefault, settings.sources, settings.webSearch, name, character.age, character.includeHormones, addHistory],
  );

  // Ask whenever ?q= changes (the ask box, example questions, "Ask about this topic").
  const lastUrlQuestion = useRef<string | null>(null);
  useEffect(() => {
    if (question && question !== lastUrlQuestion.current) {
      lastUrlQuestion.current = question;
      setActiveSituation(undefined);
      void run(question);
    }
  }, [question, run]);

  const ask = (q: string) => {
    setActiveSituation(undefined);
    if (q === question) {
      go("ask", { q });
      return void run(q);
    }
    go("ask", { q });
  };

  const runSituation = (s: Scenario | TimelineEvent) => {
    setActiveSituation(s.situation);
    go("ask", { q: null });
    lastUrlQuestion.current = null;
    void run(characterQuestion(name, character.age, s.situation, character.includeHormones), s.focus);
  };

  const selectRegion = (id: string | null) => {
    update({ region: id }, true);
    if (id) addHistory({ kind: "region", value: id, label: REGION_BY_ID.get(id)?.name ?? id });
  };

  // Escape closes the study panel or settings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (studyId) nav.closeStudy();
      else setSettingsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studyId, nav]);

  const brainTab = BRAIN_TABS.includes(tab);
  const cited = answer?.regions.map((r) => r.name) ?? [];
  const showDisease = disease && (tab === "diseases" || tab === "ask");
  const overlay = tab === "cells" ? cellOverlay?.values ?? null : showDisease ? stageOverlay(disease, stage) : null;
  const overlayLabel = tab === "cells" ? cellOverlay?.label : showDisease ? `${disease.name} · ${disease.stages[stage]?.label}` : undefined;
  const overlayNote = tab === "cells" ? "Share of sampled cells of this type in each part (Allen Brain Cell Atlas). Grey = no sample." : undefined;
  const compareLink = lastAsk?.focus ? { cq: lastAsk.q, cf: lastAsk.focus } : diseaseId ? { cd: diseaseId } : {};
  const tabLabel = (id: TabId, label: string) => (id === "leo" ? name : label);

  if (redirect) return null;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand btn ghost" style={{ padding: 0, height: "auto", color: "var(--text)" }} onClick={() => go("explore", { region: null, q: null })} aria-label="Brain Explorer — start">
            <img src="/favicon.svg" width={30} height={30} alt="" /> Brain Explorer
          </button>
          <nav className="tabbar" role="tablist" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.id} role="tab" className="top-tab" aria-selected={tab === t.id} onClick={() => go(t.id)}>
                {tabLabel(t.id, t.label)}
                {t.id === "ask" && busy && <span className="count">…</span>}
                {t.id === "studies" && saved.length > 0 && <span className="count">({saved.length})</span>}
              </button>
            ))}
          </nav>
          <button className="btn icon ghost" onClick={() => setSettingsOpen(true)} aria-label="Settings" title="Settings"><IconSettings size={19} /></button>
        </div>
      </header>

      <main className="app-main" id="main">
        <ErrorBoundary>
          {/* The brain tabs stay mounted (just hidden) so the brain and answers survive tab switches. */}
          <div className="lab" style={brainTab ? undefined : { display: "none" }}>
            <div className="brain-stage">
              <BrainViewer
                selected={region}
                onSelect={selectRegion}
                cited={tab === "ask" ? cited : []}
                pinned={pinned}
                autoRotate={settings.autoRotate && !region && !disease}
                showRegionList
                overlay={overlay}
                overlayLabel={overlayLabel}
                overlayNote={overlayNote}
                caption="Average adult brain model (FreeSurfer fsaverage) — not a real person's scan, and not brain activity"
              />
            </div>

            <div className="side" ref={sideRef}>
              <AskBox onAsk={ask} initial={question} busy={busy} placeholder={region ? `Ask about the ${REGION_BY_ID.get(region)?.name.replace(/ \(.*\)/, "").toLowerCase()}…` : "Ask anything about the brain…"} />

              <div className="panel panel-pad side-panel">
                {tab === "explore" && (
                  region ? (
                    <div className="stack">
                      <RegionPanel regionId={region} onAsk={ask} onSelect={selectRegion} />
                      <div className="row wrap">
                        <button className="btn sm" onClick={() => go("cells")}>See its cells (Allen Brain Cell Atlas) →</button>
                        <button className="btn sm ghost" onClick={() => selectRegion(null)}><IconX size={14} /> Back to whole brain</button>
                      </div>
                    </div>
                  ) : (
                    <div className="stack">
                      <div>
                        <div className="eyebrow">Welcome</div>
                        <h1 style={{ fontSize: 22, marginTop: 2 }}>Explore the human brain</h1>
                        <p className="dim small" style={{ marginTop: 4 }}>A realistic 3D brain linked to real published research and real brain-cell data.</p>
                      </div>
                      <ol className="guide-steps">
                        <li><strong>Pick a part</strong><span>Click the brain, or use the list in its top-left corner. Drag to turn it.</span></li>
                        <li><strong>Ask a question</strong><span>Answers are built only from studies you can open and cite.</span></li>
                        <li><strong>Go deeper</strong><span>Follow {name} through his day, watch a disease change the brain, or look at its cells.</span></li>
                      </ol>
                      <details className="sub-group">
                        <summary className="sub-group-head">Color several parts at once{pinned.length ? ` (${pinned.length})` : ""}</summary>
                        <div style={{ padding: 12 }}><SubdivisionPanel onSelect={selectRegion} onAsk={ask} /></div>
                      </details>
                    </div>
                  )
                )}

                {tab === "ask" && (
                  <>
                    {lastAsk && <p className="small dim" style={{ marginBottom: 12 }}><span className="faint">Question:</span> {lastAsk.q}</p>}
                    {busy && (
                      <div className="stack">
                        <div className="row small dim"><span className="spinner" /> Searching published research{settings.includePubMedByDefault ? ` (library + ${settings.sources.length} online databases)` : ""}, then checking every citation…</div>
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
                    {!busy && !error && answer && disease && detectDisease(answer.question)?.id === disease.id && (
                      <section className="panel panel-pad" style={{ marginBottom: 14, borderColor: "rgba(240,138,60,.45)" }}>
                        <div className="section-label">Watch it on the brain</div>
                        <DiseaseTimeline disease={disease} stage={stage} onStage={setStage} playing={playing} onPlaying={setPlaying} compact />
                      </section>
                    )}
                    {!busy && !error && answer && (
                      <>
                        <AnswerPanel answer={answer} onSelectRegion={selectRegion} />
                        {lastAsk?.focus && <button className="btn" style={{ marginTop: 14 }} onClick={() => go("compare", compareLink)}>Compare with a typical brain →</button>}
                      </>
                    )}
                    {!busy && !error && !answer && (
                      <div className="stack">
                        <p className="dim">Type a question above, or try one of these:</p>
                        <div className="stack-sm">
                          {EXAMPLE_QUESTIONS.map((q) => <button key={q} className="suggestion" onClick={() => ask(q)}><IconSpark size={14} /> {q}</button>)}
                        </div>
                        {history.some((h) => h.kind === "question") && (
                          <>
                            <div className="section-label" style={{ marginTop: 6, marginBottom: 0 }}>Your recent questions</div>
                            <div className="stack-sm">
                              {history.filter((h) => h.kind === "question").slice(0, 4).map((h) => <button key={h.value} className="suggestion" onClick={() => ask(h.value)}>{h.label}</button>)}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}

                {tab === "leo" && (
                  <div className="stack">
                    <CharacterCard compact />
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <div className="seg" role="group" aria-label="What to explore">
                        <button aria-pressed={leoView === "situations"} onClick={() => setLeoView("situations")}>Situations</button>
                        <button aria-pressed={leoView === "day"} onClick={() => setLeoView("day")}>His day</button>
                      </div>
                      <button className="btn sm ghost" onClick={() => go("compare")}>Compare with a typical brain →</button>
                    </div>
                    {leoView === "situations" ? (
                      <SituationGrid onRun={runSituation} activeSituation={activeSituation} busy={busy} name={name} age={character.age} />
                    ) : (
                      <DayTimeline onRun={runSituation} activeSituation={activeSituation} busy={busy} name={name} age={character.age} />
                    )}
                  </div>
                )}

                {tab === "diseases" && (
                  <div className="stack">
                    <DiseasePicker selected={diseaseId} onSelect={(id) => pickDisease(id === diseaseId ? undefined : id)} />
                    {disease && <DiseaseTimeline disease={disease} stage={stage} onStage={setStage} playing={playing} onPlaying={setPlaying} onAsk={ask} />}
                    {disease && <button className="btn sm ghost" style={{ alignSelf: "flex-start" }} onClick={() => go("compare", { cd: disease.id })}>Compare with a typical brain →</button>}
                  </div>
                )}

                {tab === "cells" && <CellsPanel regionId={region} onSelectRegion={selectRegion} onOverlay={onCellOverlay} />}
              </div>
            </div>
          </div>
        </ErrorBoundary>

        <ErrorBoundary key={tab}>
          {tab === "compare" && <Compare />}
          {tab === "studies" && (
            <div className="stack">
              <div className="seg" role="group" aria-label="Studies" style={{ alignSelf: "flex-start" }}>
                <button aria-pressed={params.get("view") !== "saved"} onClick={() => update({ view: null })}>Search studies</button>
                <button aria-pressed={params.get("view") === "saved"} onClick={() => update({ view: "saved" })}>Saved ({saved.length})</button>
              </div>
              {params.get("view") === "saved" ? <Saved /> : <Library />}
            </div>
          )}
        </ErrorBoundary>
      </main>

      {studyId && (
        <div className="scrim" onClick={(e) => e.target === e.currentTarget && nav.closeStudy()}>
          <aside className="drawer fade-in" aria-label="Study details">
            <ErrorBoundary key={studyId}>
              <StudyDetail id={studyId} onClose={nav.closeStudy} />
            </ErrorBoundary>
          </aside>
        </div>
      )}

      {settingsOpen && (
        <div className="scrim dialog-scrim" onClick={(e) => e.target === e.currentTarget && setSettingsOpen(false)}>
          <div className="dialog fade-in" role="dialog" aria-label="Settings">
            <Settings onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
