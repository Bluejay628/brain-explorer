import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { SOURCE_INFO, type AgeGroup, type EvidenceMethod, type PublicationCategory, type SearchFilters, type SearchResponse, type SourceId } from "../../shared/types";
import { api } from "../api";
import { useStore } from "../store";
import { StudyCard, StudyCardSkeleton } from "../components/StudyCard";
import { AGE_LABEL, CATEGORY_LABEL, METHOD_LABEL } from "../components/Evidence";
import { IconAlert, IconDoc, IconSearch, IconX } from "../icons";

const CATEGORIES: PublicationCategory[] = ["original-research", "randomized-controlled-trial", "clinical-trial", "meta-analysis", "systematic-review", "review", "case-report", "preprint"];
const METHODS: EvidenceMethod[] = ["functional-mri", "structural-mri", "functional-connectivity", "diffusion-connectivity", "eeg-meg", "pet", "brain-stimulation", "behavioral", "animal-model"];
const AGES: AgeGroup[] = ["child", "adolescent", "young-adult", "adult", "middle-aged", "older-adult"];

function toggle<T>(list: T[] | undefined, v: T): T[] {
  const cur = list ?? [];
  return cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
}

export function Library() {
  const { settings } = useStore();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filters, setFilters] = useState<SearchFilters>({ humansOnly: settings.humansOnlyByDefault || undefined });
  const [pubmed, setPubmed] = useState(settings.includePubMedByDefault);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const run = async (q: string, f: SearchFilters = filters) => {
    setBusy(true);
    setError(null);
    try {
      const clean: SearchFilters = Object.fromEntries(
        Object.entries(f).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length) && !Number.isNaN(v)),
      );
      setData(await api.search({ query: q, filters: clean, includePubMed: pubmed && q.trim().length > 0, sources: settings.sources, limit: 30 }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void run(params.get("q") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setParams(query ? { q: query } : {}, { replace: true });
    void run(query);
  };
  const setYear = (k: "yearFrom" | "yearTo", v: string) => setFilters((f) => ({ ...f, [k]: v ? Number(v) : undefined }));
  const activeCount = (filters.categories?.length ?? 0) + (filters.methods?.length ?? 0) + (filters.ageGroups?.length ?? 0) + (filters.yearFrom ? 1 : 0) + (filters.yearTo ? 1 : 0) + (filters.humansOnly ? 1 : 0);

  const externalCov = data?.coverage.filter((c) => c.source !== "local-library") ?? [];
  const failedCov = externalCov.filter((c) => !c.searched && c.error);
  const localCov = data?.coverage.find((c) => c.source === "local-library");

  return (
    <div>
      <header className="page-header">
        <div>
          <div className="eyebrow">Research library</div>
          <h1>Search published neuroscience</h1>
          <p>Search by title, topic, keyword, author, DOI or PubMed ID. Results come from the local library and, optionally, live from PubMed, Europe PMC, OpenAlex and Semantic Scholar (choose them in Settings).</p>
        </div>
      </header>

      <form className="ask" onSubmit={submit} role="search" style={{ marginBottom: 16 }}>
        <IconSearch className="lead" size={18} />
        <label htmlFor="lib-q" className="sr-only">Search studies</label>
        <input id="lib-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. working memory fMRI · Walker · 10.1038/… · 12345678" maxLength={300} />
        <label className="check xs" style={{ marginRight: 6 }}>
          <input type="checkbox" checked={pubmed} onChange={(e) => setPubmed(e.target.checked)} /> Search online databases
        </label>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : "Search"}</button>
      </form>

      <div className="library">
        <aside className="panel panel-pad filters" aria-label="Filters">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <div className="panel-title" style={{ margin: 0 }}><span className="dot" /> Filters{activeCount ? ` (${activeCount})` : ""}</div>
            <button className="btn sm ghost filters-toggle" type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              {showFilters ? "Hide" : "Show"}
            </button>
          </div>
          <div className={`filters-body${showFilters ? " open" : ""}`}>
            <fieldset>
              <legend>Publication year</legend>
              <div className="row">
                <input className="input" type="number" min={1800} max={2100} placeholder="From" value={filters.yearFrom ?? ""} onChange={(e) => setYear("yearFrom", e.target.value)} aria-label="From year" />
                <input className="input" type="number" min={1800} max={2100} placeholder="To" value={filters.yearTo ?? ""} onChange={(e) => setYear("yearTo", e.target.value)} aria-label="To year" />
              </div>
            </fieldset>
            <fieldset>
              <legend>Study type</legend>
              <div className="stack-sm">
                {CATEGORIES.map((c) => (
                  <label key={c} className="check"><input type="checkbox" checked={filters.categories?.includes(c) ?? false} onChange={() => setFilters((f) => ({ ...f, categories: toggle(f.categories, c) }))} /> {CATEGORY_LABEL[c]}</label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Population (age indexing)</legend>
              <div className="stack-sm">
                <label className="check"><input type="checkbox" checked={filters.humansOnly ?? false} onChange={(e) => setFilters((f) => ({ ...f, humansOnly: e.target.checked || undefined }))} /> Human studies only</label>
                {AGES.map((a) => (
                  <label key={a} className="check"><input type="checkbox" checked={filters.ageGroups?.includes(a) ?? false} onChange={() => setFilters((f) => ({ ...f, ageGroups: toggle(f.ageGroups, a) }))} /> {AGE_LABEL[a]}</label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Evidence type (method)</legend>
              <div className="stack-sm">
                {METHODS.map((m) => (
                  <label key={m} className="check"><input type="checkbox" checked={filters.methods?.includes(m) ?? false} onChange={() => setFilters((f) => ({ ...f, methods: toggle(f.methods, m) }))} /> {METHOD_LABEL[m]}</label>
                ))}
              </div>
              <p className="xs faint" style={{ marginTop: 6 }}>Methods are detected from abstracts and may be incomplete.</p>
            </fieldset>
            <div className="row">
              <button className="btn sm primary" type="button" onClick={() => run(query)}>Apply</button>
              <button className="btn sm ghost" type="button" onClick={() => { setFilters({}); void run(query, {}); }}>Clear</button>
            </div>
          </div>
        </aside>

        <section aria-live="polite" aria-busy={busy}>
          {data && !busy && (
            <div className="row wrap xs dim" style={{ marginBottom: 10 }}>
              <span>{data.results.length} result{data.results.length === 1 ? "" : "s"}</span>
              <span className="faint">·</span>
              <span>Local library: {localCov?.resultCount ?? 0} of {localCov?.totalAvailable ?? 0} records</span>
              {externalCov.map((c) => (
                <span key={c.source}>
                  <span className="faint">· </span>
                  {(SOURCE_INFO[c.source as SourceId]?.name ?? c.source)}:{" "}
                  {c.searched ? `${c.resultCount} (of ${c.totalAvailable?.toLocaleString() ?? "?"})` : c.error ? <span style={{ color: "var(--red)" }}>unavailable</span> : "not searched"}
                </span>
              ))}
            </div>
          )}
          {failedCov.length > 0 && !busy && (
            <div className="notice amber" style={{ marginBottom: 10 }}>
              <IconAlert size={16} />
              <span>
                Could not reach: {failedCov.map((c) => `${(SOURCE_INFO[c.source as SourceId]?.name ?? c.source)} (${c.error})`).join("; ")}. Results from the other sources are still shown.
              </span>
            </div>
          )}
          {busy && <div className="stack-sm"><StudyCardSkeleton /><StudyCardSkeleton /><StudyCardSkeleton /></div>}
          {!busy && error && (
            <div className="notice red">
              <IconX size={16} />
              <div className="grow">{error}<div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => run(query)}>Retry</button></div></div>
            </div>
          )}
          {!busy && !error && data && data.results.length === 0 && (
            <div className="panel empty">
              <IconDoc size={30} />
              <p>{localCov?.totalAvailable === 0 && !externalCov.some((c) => c.searched) ? "The local library is empty. Tick “Search online databases”, or run npm run seed on the server." : "No studies matched. Try broader terms or fewer filters."}</p>
            </div>
          )}
          {!busy && data && (
            <div className="stack-sm">
              {data.results.map((r) => <StudyCard key={r.id} record={r} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
