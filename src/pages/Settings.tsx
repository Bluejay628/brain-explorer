import { useEffect, useState } from "react";
import { ALL_SOURCES, SOURCE_INFO, type ServerStatus } from "../../shared/types";
import { api } from "../api";
import { useStore } from "../store";
import { IconShield } from "../icons";

export function Settings() {
  const { settings, updateSettings, clearAll, saved, history } = useStore();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    api.status().then(setStatus).catch((e: Error) => setStatusError(e.message));
  }, []);

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="eyebrow">Settings</div>
          <h1>Preferences, data sources &amp; privacy</h1>
        </div>
      </header>

      <div className="settings-grid">
        <section className="panel panel-pad stack">
          <div className="panel-title"><span className="dot" /> Display</div>
          <label className="field">
            Theme
            <select className="select" value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as "lab" | "contrast" })}>
              <option value="lab">Lab (dark)</option>
              <option value="contrast">High contrast</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.autoRotate} onChange={(e) => updateSettings({ autoRotate: e.target.checked })} />
            Slowly rotate the brain when idle (always off if your device asks for reduced motion)
          </label>
        </section>

        <section className="panel panel-pad stack">
          <div className="panel-title"><span className="dot" /> Research search</div>
          <label className="check">
            <input type="checkbox" checked={settings.includePubMedByDefault} onChange={(e) => updateSettings({ includePubMedByDefault: e.target.checked })} />
            Search online research databases when the local library doesn't have enough evidence
          </label>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }} disabled={!settings.includePubMedByDefault}>
            <legend className="section-label">Databases to search</legend>
            <div className="stack-sm">
              {ALL_SOURCES.map((id) => (
                <label key={id} className="check" style={{ alignItems: "flex-start" }}>
                  <input
                    type="checkbox"
                    checked={settings.sources.includes(id)}
                    onChange={(e) =>
                      updateSettings({ sources: e.target.checked ? [...settings.sources, id] : settings.sources.filter((x) => x !== id) })
                    }
                  />
                  <span>
                    <strong>{SOURCE_INFO[id].name}</strong>
                    <span className="xs faint" style={{ display: "block" }}>{SOURCE_INFO[id].description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="check" style={{ alignItems: "flex-start" }}>
            <input type="checkbox" checked={settings.webSearch} onChange={(e) => updateSettings({ webSearch: e.target.checked })} />
            <span>
              <strong>Trusted web search</strong>
              <span className="xs faint" style={{ display: "block" }}>
                When fewer than 4 studies are found, the AI searches trusted sites only (NIH, CDC, WHO, NHS, universities, major journals). Every page is linked and checked. Needs the AI engine; costs a little extra per question.
              </span>
            </span>
          </label>
          <label className="field">
            Citation style
            <select className="select" value={settings.citationStyle} onChange={(e) => updateSettings({ citationStyle: e.target.value as "apa" | "mla" })}>
              <option value="apa">APA 7th edition</option>
              <option value="mla">MLA 9th edition</option>
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.humansOnlyByDefault} onChange={(e) => updateSettings({ humansOnlyByDefault: e.target.checked })} />
            Start library searches with "Human studies only"
          </label>
        </section>

        <section className="panel panel-pad stack">
          <div className="panel-title"><span className="dot" /> Server status</div>
          {statusError && <div className="notice red small">{statusError}</div>}
          {status && (
            <dl className="kv">
              <dt>AI engine</dt>
              <dd className="row" style={{ gap: 8 }}>
                <span className={`status-dot ${status.aiConfigured ? "on" : "off"}`} />
                {status.aiConfigured ? `Configured (${status.model})` : "Not configured — retrieval-only mode"}
              </dd>
              <dt>NCBI API key</dt>
              <dd className="row" style={{ gap: 8 }}>
                <span className={`status-dot ${status.ncbiKeyConfigured ? "on" : "off"}`} />
                {status.ncbiKeyConfigured ? "Configured (10 requests/s)" : "Not set (3 requests/s limit)"}
              </dd>
              <dt>Local library</dt>
              <dd>{status.librarySize.toLocaleString()} research records cached</dd>
              <dt>3D model</dt>
              <dd>Average adult brain (FreeSurfer fsaverage5) with the Desikan-Killiany atlas and FreeSurfer subcortical structures</dd>
            </dl>
          )}
          {status && !status.aiConfigured && (
            <p className="xs faint">To enable AI answers, the person running the server adds ANTHROPIC_API_KEY to the server's .env file (see README). Keys are never entered in the browser.</p>
          )}
        </section>

        <section className="panel panel-pad stack">
          <div className="panel-title"><span className="dot" /> Your data in this browser</div>
          <p className="small dim">{saved.length} saved studies · {history.length} recent items · your settings. All stored locally in this browser only.</p>
          <button className="btn" style={{ alignSelf: "flex-start" }} onClick={() => confirm("Remove saved studies, history and settings from this browser?") && clearAll()}>
            Clear my saved data
          </button>
        </section>

        <section className="panel panel-pad stack" style={{ gridColumn: "1 / -1" }}>
          <div className="panel-title"><IconShield size={14} /> Data sources &amp; privacy</div>
          <div className="settings-grid">
            <div className="stack-sm small dim">
              <p><strong className="dim">Research databases.</strong> Study metadata and abstracts come from the official free APIs of PubMed (U.S. National Library of Medicine), Europe PMC (EMBL-EBI), OpenAlex and Semantic Scholar (Allen Institute for AI), within their rate limits. Your search terms are sent to the databases you turn on. Abstracts may be copyrighted by their publishers; each record links to its source. Preprints are labeled because they have not been peer reviewed.</p>
              <p><strong className="dim">NeuroVault.</strong> When you check for brain maps, the study's DOI is sent to NeuroVault to look for maps the authors published. Brain Explorer never creates its own maps.</p>
              <p><strong className="dim">Claude API (Anthropic).</strong> When AI answers are enabled, your question and the retrieved public study abstracts are sent from the server to Anthropic to write the summary. No account, name or other personal data is sent.</p>
            </div>
            <div className="stack-sm small dim">
              <p><strong className="dim">What we don't collect.</strong> No accounts, no tracking, no health information. Please don't type personal health details into questions.</p>
              <p><strong className="dim">What this tool is not.</strong> Brain Explorer is an educational research tool. It does not diagnose, scan, or predict anything about any individual's brain. Research findings describe groups of study participants, not you.</p>
              <p><strong className="dim">How answers are checked.</strong> Every citation in an AI answer must match a study that was actually retrieved; unsupported statements are removed and reported. The app labels which statements are authors' findings and which are AI interpretation.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
