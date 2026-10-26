import { useEffect, useMemo, useState } from "react";
import { REGION_BY_ID } from "../../shared/regions";
import { CELL_TYPE_NOTE, NON_NEURONAL, REGION_SAMPLES, combineSamples, groupNeurotransmitters, samplesFor } from "../../shared/cellAtlas";
import { useCellAtlas } from "./useCellAtlas";
import { CellMap } from "./CellMap";
import { IconExternal } from "../icons";

interface Props {
  regionId: string | null;
  onSelectRegion: (id: string) => void;
  /** Color the 3D brain (region id → 0–1) with a label, or clear it. */
  onOverlay: (values: Record<string, number> | null, label?: string) => void;
}

/** Regions colored on the 3D brain when a cell type is chosen (no lobes, so parts don't cover each other). */
const PAINTABLE = Object.keys(REGION_SAMPLES).filter((id) => !["frontal-lobe", "prefrontal-cortex", "parietal-lobe", "temporal-lobe", "occipital-lobe", "cingulate-cortex", "basal-ganglia"].includes(id));

const pct = (n: number, total: number) => (total ? `${n / total >= 0.1 ? Math.round((100 * n) / total) : ((100 * n) / total).toFixed(1)}%` : "—");

export function CellsPanel({ regionId, onSelectRegion, onOverlay }: Props) {
  const { data, error } = useCellAtlas();
  const [typeIdx, setTypeIdx] = useState<number | null>(null);
  const region = regionId ? REGION_BY_ID.get(regionId) : undefined;

  const samples = useMemo(() => (data && regionId ? samplesFor(regionId, data.rois) : []), [data, regionId]);
  const combined = useMemo(() => combineSamples(samples), [samples]);
  const roiSet = useMemo(() => (data && samples.length ? new Set(samples.map((s) => data.rois.indexOf(s))) : null), [data, samples]);

  // Choosing a cell type colors the brain by where the study sampled the most of it.
  useEffect(() => {
    if (!data || typeIdx === null) return onOverlay(null);
    const shares: Record<string, number> = {};
    for (const id of PAINTABLE) {
      const c = combineSamples(samplesFor(id, data.rois));
      if (c.cells) shares[id] = (c.superclusters.get(typeIdx) ?? 0) / c.cells;
    }
    const max = Math.max(...Object.values(shares), 0);
    if (!max) return onOverlay(null);
    for (const k of Object.keys(shares)) shares[k] = shares[k] / max;
    onOverlay(shares, `${data.superclusters[typeIdx].name} cells`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, typeIdx]);
  useEffect(() => () => onOverlay(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="notice red">{error}</div>;
  if (!data) return <div className="row small dim"><span className="spinner" /> Loading cell data…</div>;

  const types = [...combined.superclusters].sort((a, b) => b[1] - a[1]);
  const allTypes = data.superclusters.map((s, i) => ({ ...s, i })).sort((a, b) => b.cells - a.cells);
  const nts = groupNeurotransmitters(combined.neurotransmitters);
  const neurons = types.filter(([i]) => !NON_NEURONAL.has(data.superclusters[i].name)).reduce((n, [, v]) => n + v, 0);
  const chosen = typeIdx !== null ? data.superclusters[typeIdx] : undefined;

  return (
    <div className="stack fade-in">
      <div>
        <div className="eyebrow">Brain cells · real data</div>
        <h2 style={{ fontSize: 19, marginTop: 2 }}>{region ? `Cells in the ${region.name.replace(/ \(.*\)/, "").toLowerCase()}` : "What the brain is made of"}</h2>
        <p className="small dim" style={{ marginTop: 4 }}>
          {data.totalCells.toLocaleString()} cell nuclei from {data.source.donors.length} adult donors were sorted into {data.superclusters.length} main cell types by the genes they use.
          {" "}Each dot below is one real cell (1 in {data.points.sampleEvery} shown).
        </p>
      </div>

      <CellMap data={data} rois={roiSet} supercluster={typeIdx} onPick={(i) => setTypeIdx(i === typeIdx ? null : i)} />
      <p className="xs faint" style={{ marginTop: -6 }}>
        Cells that use similar genes sit close together, so each colored clump is a cell type. A dot's position is <strong>not</strong> where the cell is in the brain.
        {roiSet && " Colored dots came from the selected part; grey dots came from elsewhere."}
        {chosen && ` Showing only ${chosen.name}.`}
      </p>

      {chosen && (
        <div className="notice cyan">
          <span className="legend-dot" style={{ background: chosen.color, marginTop: 4 }} />
          <div className="grow small">
            <strong>{chosen.name}</strong> — {chosen.cells.toLocaleString()} nuclei in the whole dataset.
            {CELL_TYPE_NOTE[chosen.name] && <span className="dim"> {CELL_TYPE_NOTE[chosen.name]} <span className="faint">(general background)</span></span>}
            <div className="xs faint" style={{ marginTop: 4 }}>The brain is now colored by the share of sampled cells that are this type in each part (darker = more). Sampled parts only.</div>
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setTypeIdx(null)}>Clear cell type</button>
          </div>
        </div>
      )}

      {region && !samples.length && (
        <div className="notice amber">
          <div className="small">
            The Allen human dataset has no tissue sample that clearly comes from this part, so there is no cell data for it here.
            <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
              <span className="xs faint">Parts with data:</span>
              {["hippocampus", "amygdala", "thalamus", "cerebellum", "precentral-gyrus", "pericalcarine", "insula"].map((id) => (
                <button key={id} className="chip" onClick={() => onSelectRegion(id)}>{REGION_BY_ID.get(id)?.name.replace(/ \(.*\)/, "")}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {region && samples.length > 0 && (
        <>
          <section>
            <div className="section-label">Main cell types sampled here</div>
            <p className="xs dim" style={{ marginBottom: 8 }}>
              {combined.cells.toLocaleString()} nuclei from {samples.length} tissue sample{samples.length === 1 ? "" : "s"} · {pct(neurons, combined.cells)} were neurons, the rest support cells.
            </p>
            <details className="xs faint" style={{ marginBottom: 8 }}>
              <summary style={{ cursor: "pointer" }}>Which tissue samples?</summary>
              <ul className="clean xs" style={{ marginTop: 4 }}>
                {samples.map((x) => <li key={x.label}>{x.structures.map((st) => st.name).join(" + ")} — {x.cells.toLocaleString()} nuclei, {x.donors} donor{x.donors === 1 ? "" : "s"}</li>)}
              </ul>
            </details>
            <div className="bars">
              {types.slice(0, 8).map(([i, n]) => (
                <button key={i} className="bar-row" aria-pressed={typeIdx === i} onClick={() => setTypeIdx(i === typeIdx ? null : i)} title={CELL_TYPE_NOTE[data.superclusters[i].name]}>
                  <span className="bar-name"><span className="legend-dot" style={{ background: data.superclusters[i].color }} />{data.superclusters[i].name}</span>
                  <span className="bar-track"><span style={{ width: `${(100 * n) / types[0][1]}%`, background: data.superclusters[i].color }} /></span>
                  <span className="bar-val">{pct(n, combined.cells)}</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <div className="section-label">Chemical messengers their genes point to</div>
            <div className="bars">
              {nts.slice(0, 6).map((t) => (
                <div key={t.name} className="bar-row" style={{ cursor: "default" }}>
                  <span className="bar-name">{t.name}</span>
                  <span className="bar-track"><span style={{ width: `${(100 * t.cells) / combined.cells}%`, background: "var(--pink)" }} /></span>
                  <span className="bar-val">{pct(t.cells, combined.cells)}</span>
                </div>
              ))}
            </div>
            <p className="xs faint" style={{ marginTop: 6 }}>Based on which messenger-making genes each cell type uses. Some types use more than one, so shares can add up to more than 100%.</p>
          </section>
        </>
      )}

      {!region && (
        <section>
          <div className="section-label">All {data.superclusters.length} main cell types — click one to see where it was found</div>
          <div className="bars">
            {allTypes.map((t) => (
              <button key={t.i} className="bar-row" aria-pressed={typeIdx === t.i} onClick={() => setTypeIdx(t.i === typeIdx ? null : t.i)} title={CELL_TYPE_NOTE[t.name]}>
                <span className="bar-name"><span className="legend-dot" style={{ background: t.color }} />{t.name}</span>
                <span className="bar-track"><span style={{ width: `${(100 * t.cells) / allTypes[0].cells}%`, background: t.color }} /></span>
                <span className="bar-val">{t.cells >= 1000 ? `${Math.round(t.cells / 1000)}k` : t.cells}</span>
              </button>
            ))}
          </div>
          <p className="xs faint" style={{ marginTop: 8 }}>Pick a part of the brain to see which cell types were sampled there.</p>
        </section>
      )}

      <div className="notice xs">
        <div>
          <strong>Where this comes from.</strong> {data.source.name}. {data.source.citation}{" "}
          <a href={`https://doi.org/${data.source.doi}`} target="_blank" rel="noreferrer">doi:{data.source.doi}</a>.{" "}
          <a href={data.source.url} target="_blank" rel="noreferrer">Open the Allen Brain Cell Atlas <IconExternal size={11} /></a>
          <div className="faint" style={{ marginTop: 4 }}>
            Counts are of <em>sampled</em> nuclei from {data.source.donors.length} donors (ages {data.source.donors.map((d) => d.donor_age.replace(" yrs", "")).join(", ")}): the study chose how much tissue to take from each area, so these are not cell densities.
            Matching the study's tissue samples to this 3D model's parts is approximate and done by anatomical name.
          </div>
        </div>
      </div>
    </div>
  );
}
