import type { BrainMapAvailability, ResearchRecord } from "../../shared/types";
import { IconExternal, IconMap } from "../icons";

export function BrainMapStatus({ map, record }: { map: BrainMapAvailability; record?: ResearchRecord }) {
  return (
    <div className="stack-sm small">
      {record && <div className="dim" style={{ fontWeight: 500 }}>{record.title}</div>}
      {map.status === "available" && map.collection ? (
        <>
          <div className="row wrap">
            <span className="chip green"><IconMap size={12} /> Published maps on NeuroVault</span>
            <a href={map.collection.url} target="_blank" rel="noreferrer" className="xs">
              {map.collection.name} <IconExternal size={11} />
            </a>
          </div>
          {map.images?.length ? (
            <ul className="clean xs">
              {map.images.slice(0, 6).map((img) => (
                <li key={img.id}>
                  <a href={img.url} target="_blank" rel="noreferrer">{img.name}</a>
                  <span className="faint">
                    {" "}· {[img.mapType, img.modality, img.template, img.cognitiveParadigm].filter(Boolean).join(" · ") || "metadata not provided"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="xs faint">The collection lists no individual images.</span>
          )}
          <span className="xs faint">
            These maps describe group-level statistics from this study, not any individual's brain. {map.renderNote}
          </span>
        </>
      ) : (
        <span className="xs faint">
          <span className={`chip ${map.status === "error" ? "red" : ""}`} style={{ marginRight: 6 }}>
            {map.status === "none-found" ? "No compatible map" : map.status === "error" ? "Check failed" : "Not checked"}
          </span>
          {map.renderNote}
        </span>
      )}
    </div>
  );
}
