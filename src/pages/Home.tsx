import { Link, useNavigate } from "react-router-dom";
import { BrainViewer } from "../components/BrainViewer";
import { AskBox, SUGGESTED_QUESTIONS } from "../components/AskBox";
import { useStore } from "../store";
import { REGION_BY_ID } from "../../shared/regions";
import { IconArrowRight, IconBookmark, IconBrain, IconClock, IconLibrary, IconShield, IconSpark } from "../icons";

export function Home() {
  const navigate = useNavigate();
  const { settings, history, saved } = useStore();
  const ask = (q: string) => navigate(`/explore?q=${encodeURIComponent(q)}`);

  return (
    <div>
      <section className="hero">
        <div className="stack" style={{ gap: 18 }}>
          <div className="eyebrow">Neuroscience research explorer</div>
          <h1>
            Explore the brain.<br />
            <span className="accent">Inspect the evidence.</span>
          </h1>
          <p className="lede">
            Ask a question about the brain and get an explanation built only from published research — with every citation traceable,
            its evidence type labeled, and its limitations stated.
          </p>
          <AskBox onAsk={ask} />
          <div className="stack-sm">
            <div className="section-label" style={{ marginBottom: 0 }}>Suggested research questions</div>
            {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
              <button key={q} className="suggestion" onClick={() => ask(q)}>
                <IconSpark size={14} /> {q}
              </button>
            ))}
          </div>
        </div>
        <div className="hero-brain viewer-frame">
          <BrainViewer compact autoRotate={settings.autoRotate} onSelect={(id) => id && navigate(`/explore?region=${id}`)} />
        </div>
      </section>

      <section className="pillars">
        <div className="panel panel-pad pillar">
          <IconBrain />
          <h3>Interactive 3D brain</h3>
          <p>Rotate, zoom and select regions to see an overview and jump to the research on them.</p>
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
