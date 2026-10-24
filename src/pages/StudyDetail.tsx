import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { BrainMapAvailability, Derived, ResearchRecord } from "../../shared/types";
import { REGION_BY_ID } from "../../shared/regions";
import { api } from "../api";
import { useStore } from "../store";
import { SaveButton } from "../components/StudyCard";
import { AGE_LABEL, CATEGORY_HELP, CategoryChip, METHOD_LABEL, PROVENANCE_LABEL } from "../components/Evidence";
import { BrainMapStatus } from "../components/BrainMaps";
import { IconArrowLeft, IconExternal, IconMap, IconX } from "../icons";

const NR = <span className="faint">Not reported</span>;

function Prov({ d }: { d?: Derived<unknown> }) {
  if (!d) return null;
  return <div className="prov" title={d.note}>{PROVENANCE_LABEL[d.provenance]}{d.note ? ` — ${d.note}` : ""}</div>;
}

export function StudyDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { saved } = useStore();
  const [record, setRecord] = useState<ResearchRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineCopy, setOfflineCopy] = useState(false);
  const [maps, setMaps] = useState<BrainMapAvailability | null>(null);
  const [mapsBusy, setMapsBusy] = useState(false);

  useEffect(() => {
    setRecord(null);
    setError(null);
    setMaps(null);
    api
      .study(id)
      .then(setRecord)
      .catch((e: Error) => {
        // Fall back to the saved copy in this browser, if there is one.
        const copy = saved.find((s) => s.id === id);
        if (copy) {
          setRecord(copy);
          setOfflineCopy(true);
        } else setError(e.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const checkMaps = async () => {
    setMapsBusy(true);
    try {
      setMaps(await api.maps(id));
    } catch (e) {
      setMaps({ recordId: id, status: "error", renderNote: (e as Error).message });
    } finally {
      setMapsBusy(false);
    }
  };

  if (error) {
    return (
      <div className="stack">
        <button className="btn ghost" onClick={() => navigate(-1)} style={{ alignSelf: "flex-start" }}><IconArrowLeft size={15} /> Back</button>
        <div className="notice red"><IconX size={16} /><span>{error}</span></div>
      </div>
    );
  }
  if (!record) {
    return (
      <div className="stack">
        <div className="skeleton" style={{ height: 28, width: "70%" }} />
        <div className="skeleton" style={{ height: 14, width: "40%" }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  const r = record;
  const sectionText = (re: RegExp) => r.abstract.filter((s) => s.label && re.test(s.label)).map((s) => s.text).join(" ");
  const objective = sectionText(/^(objectives?|aims?|purpose|background|introduction|importance)$/i);
  const methods = sectionText(/^(methods?|design|participants|setting|materials and methods|study design)/i);

  return (
    <div className="fade-in">
      <button className="btn ghost" onClick={() => navigate(-1)} style={{ marginBottom: 12 }}><IconArrowLeft size={15} /> Back</button>
      {offlineCopy && <div className="notice amber" style={{ marginBottom: 12 }}><span>The server couldn't be reached — showing the copy saved in this browser.</span></div>}
      <div className="detail">
        <article className="stack">
          <div>
            <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>
              <CategoryChip record={r} />
              <span className="chip mono">PMID {r.pmid}</span>
            </div>
            <h1>{r.title}</h1>
            <p className="dim small" style={{ marginTop: 8 }}>
              {r.authors.length ? r.authors.map((a) => a.collective ?? `${a.foreName ?? ""} ${a.lastName ?? ""}`.trim()).join(", ") : "Authors not listed"}
            </p>
            <p className="small" style={{ marginTop: 4 }}><em>{r.journal ?? "Journal not listed"}</em> · {r.publicationDate ?? "Publication date not reported"}</p>
          </div>

          <div className="row wrap">
            <a className="btn primary" href={r.sourceUrl} target="_blank" rel="noreferrer">View on PubMed <IconExternal size={14} /></a>
            {r.doiUrl && <a className="btn" href={r.doiUrl} target="_blank" rel="noreferrer">Publisher (DOI) <IconExternal size={14} /></a>}
            {r.pmcid && <a className="btn" href={`https://pmc.ncbi.nlm.nih.gov/articles/${r.pmcid}/`} target="_blank" rel="noreferrer">Free full text (PMC) <IconExternal size={14} /></a>}
            <SaveButton record={r} />
          </div>

          <section className="panel panel-pad">
            <div className="panel-title"><span className="dot" /> Abstract</div>
            {r.abstract.length ? (
              r.abstract.map((s, i) => (
                <div key={i} className="abstract-section">
                  {s.label && <h4>{s.label}</h4>}
                  <p>{s.text}</p>
                </div>
              ))
            ) : (
              <p className="dim">No abstract is available in PubMed for this record. Open the original source for details.</p>
            )}
            <div className="prov" style={{ marginTop: 12 }}>Verbatim from PubMed. Abstract text may be copyrighted by the publisher.</div>
          </section>

          <section className="panel panel-pad">
            <div className="panel-title"><span className="dot" /> Study summary (from the abstract)</div>
            <dl className="kv">
              <dt>Research question</dt>
              <dd>{objective || NR}{objective && <div className="prov">Verbatim from labeled abstract section</div>}</dd>
              <dt>Methodology</dt>
              <dd>{methods || <span className="faint">Not reported as a separate section — see abstract</span>}{methods && <div className="prov">Verbatim from labeled abstract section</div>}</dd>
              <dt>Main findings</dt>
              <dd>{r.reportedFindings?.value ?? <span className="faint">Not reported as a separate section — see abstract</span>}<Prov d={r.reportedFindings} /></dd>
              <dt>Limitations</dt>
              <dd>{r.reportedLimitations?.value ?? <span className="faint">Not reported in the abstract (most abstracts omit limitations — check the full paper)</span>}<Prov d={r.reportedLimitations} /></dd>
            </dl>
          </section>
        </article>

        <aside className="stack">
          <section className="panel panel-pad">
            <div className="panel-title"><span className="dot" /> Evidence profile</div>
            <dl className="kv" style={{ gridTemplateColumns: "110px 1fr" }}>
              <dt>Study type</dt>
              <dd>{r.publicationTypes.join(", ") || NR}<div className="prov">{CATEGORY_HELP[r.category.value]}</div></dd>
              <dt>Methods</dt>
              <dd>{r.methods.value.length ? r.methods.value.map((m) => METHOD_LABEL[m]).join(", ") : NR}<Prov d={r.methods} /></dd>
              <dt>Species</dt>
              <dd>{r.species.value.join(", ") || NR}<Prov d={r.species} /></dd>
              <dt>Age groups</dt>
              <dd>{r.ageGroups.value.length ? r.ageGroups.value.map((a) => AGE_LABEL[a]).join(", ") : NR}<Prov d={r.ageGroups} /></dd>
              <dt>Sample size</dt>
              <dd>{r.sampleSize ? r.sampleSize.value.toLocaleString() : NR}<Prov d={r.sampleSize} /></dd>
              <dt>Regions mentioned</dt>
              <dd>
                {r.regionsMentioned.value.length ? r.regionsMentioned.value.map((id) => REGION_BY_ID.get(id)?.name ?? id).join(", ") : <span className="faint">None detected</span>}
                <Prov d={r.regionsMentioned} />
              </dd>
            </dl>
          </section>

          <section className="panel panel-pad">
            <div className="panel-title"><IconMap size={14} /> Brain-map data</div>
            {maps ? (
              <BrainMapStatus map={maps} />
            ) : (
              <div className="stack-sm">
                <p className="small dim">Check whether the authors published statistical brain maps for this study on NeuroVault.</p>
                <button className="btn sm" onClick={checkMaps} disabled={mapsBusy}>{mapsBusy ? <span className="spinner" /> : "Check NeuroVault"}</button>
              </div>
            )}
          </section>

          <section className="panel panel-pad">
            <div className="panel-title"><span className="dot" /> Record</div>
            <dl className="kv" style={{ gridTemplateColumns: "110px 1fr" }}>
              <dt>PMID</dt><dd className="mono">{r.pmid ?? NR}</dd>
              <dt>DOI</dt><dd className="mono">{r.doi ?? NR}</dd>
              <dt>PMCID</dt><dd className="mono">{r.pmcid ?? NR}</dd>
              <dt>MeSH terms</dt><dd className="xs">{r.meshTerms.join("; ") || NR}</dd>
              <dt>Keywords</dt><dd className="xs">{r.keywords.join("; ") || NR}</dd>
              <dt>Retrieved</dt><dd className="xs">{new Date(r.retrievedAt).toLocaleString()}</dd>
              <dt>Verification</dt><dd className="xs">{r.verification === "manually-reviewed" ? "Manually reviewed against the paper" : "Retrieved automatically from PubMed (not manually reviewed)"}</dd>
            </dl>
          </section>
          <Link to={`/explore?q=${encodeURIComponent(r.title)}`} className="btn">Ask about this topic</Link>
        </aside>
      </div>
    </div>
  );
}
