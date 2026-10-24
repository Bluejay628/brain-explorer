import { Link, useNavigate } from "react-router-dom";
import { BrainViewer } from "../components/BrainViewer";
import { AskBox } from "../components/AskBox";
import { CharacterCard } from "../character/CharacterCard";
import { SCENARIOS } from "../character/scenarios";
import { useStore } from "../store";
import { REGION_BY_ID } from "../../shared/regions";
import { IconArrowRight, IconBookmark, IconBrain, IconClock, IconLibrary, IconShield, IconSpark } from "../icons";

export function Home() {
  const navigate = useNavigate();
  const { settings, history, saved, character } = useStore();
  const name = character.name.trim() || "Leo";
  const ask = (q: string) => navigate(`/explore?q=${encodeURIComponent(q)}`);

  return (
    <div>
      <section className="hero">
        <div className="stack" style={{ gap: 18 }}>
          <div className="eyebrow">Neuroscience research explorer</div>
          <h1>
            Step inside {name}'s brain.<br />
            <span className="accent">See the evidence.</span>
          </h1>
          <p className="lede">
            {name} is a fictional student. Put him in everyday situations — an all-nighter, a big exam, a soccer game — and see what published
            research suggests happens in a brain like his, in short, clear explanations with sources you can open.
          </p>
          <CharacterCard compact />
          <AskBox onAsk={ask} placeholder={`Ask anything about ${name}'s brain…`} />
          <div className="stack-sm">
            <div className="section-label" style={{ marginBottom: 0 }}>Try a situation</div>
            <div className="situation-grid">
              {SCENARIOS.slice(0, 6).map((s) => (
                <button key={s.id} className="situation" onClick={() => navigate(`/explore?s=${s.id}`)}>
                  <span className="situation-title">{s.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="hero-brain viewer-frame">
          <BrainViewer compact autoRotate={settings.autoRotate} onSelect={(id) => id && navigate(`/explore?region=${id}`)} caption={`${name}'s brain · average brain model (FreeSurfer fsaverage) · not a real scan`} />
        </div>
      </section>

      <section className="pillars">
        <div className="panel panel-pad pillar">
          <IconBrain />
          <h3>Realistic 3D brain</h3>
          <p>A brain model built from real MRI data, with 34 atlas regions per side and deep structures you can add, hide and explore.</p>
        </div>
        <div className="panel panel-pad pillar">
          <IconLibrary />
          <h3>Real published research</h3>
          <p>Studies come from PubMed, with original metadata, abstracts and links to the source.</p>
        </div>
        <div className="panel panel-pad pillar">
          <IconShield />
          <h3>Traceable AI answers</h3>
          <p>Every claim cites a retrieved study, and the app checks each citation. When the evidence is thin, it says so.</p>
        </div>
      </section>

      <section className="home-grid">
        <div className="panel panel-pad">
          <div className="panel-title"><IconClock size={14} /> Recently explored</div>
          {history.length ? (
            <div className="stack-sm">
              {history.slice(0, 5).map((h) => (
                <Link
                  key={`${h.kind}-${h.value}`}
                  className="suggestion"
                  to={h.kind === "question" ? `/explore?q=${encodeURIComponent(h.value)}` : `/explore?region=${h.value}`}
                >
                  {h.kind === "region" ? <IconBrain size={14} /> : <IconSpark size={14} />}
                  {h.kind === "region" ? REGION_BY_ID.get(h.value)?.name ?? h.label : h.label}
                </Link>
              ))}
            </div>
          ) : (
            <p className="small faint">Questions you ask and regions you explore will appear here (stored only in this browser).</p>
          )}
        </div>
        <div className="panel panel-pad">
          <div className="panel-title"><IconBookmark size={14} /> Saved studies</div>
          {saved.length ? (
            <div className="stack-sm">
              {saved.slice(0, 4).map((r) => (
                <Link key={r.id} className="suggestion" to={`/study/${encodeURIComponent(r.id)}`}>
                  <IconBookmark size={14} /> <span>{r.title}</span>
                </Link>
              ))}
              {saved.length > 4 && <Link to="/saved" className="small">View all {saved.length} saved studies →</Link>}
            </div>
          ) : (
            <p className="small faint">Save studies from the library to revisit them here.</p>
          )}
          <hr className="divider" />
          <Link to="/library" className="btn">
            Enter the research library <IconArrowRight size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
