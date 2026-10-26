// Brain Explorer is one page. Which tab is open, the question being asked, the
// selected brain part and the open study all live in the address bar
// (?tab=…&q=…&region=…&study=…), so the Back button and shared links work.

import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export const TABS = [
  { id: "explore", label: "Explore" },
  { id: "ask", label: "Ask" },
  { id: "leo", label: "Leo" },
  { id: "diseases", label: "Diseases" },
  { id: "cells", label: "Cells" },
  { id: "compare", label: "Compare" },
  { id: "studies", label: "Studies" },
] as const;
export type TabId = (typeof TABS)[number]["id"];

/** Tabs that show the big 3D brain next to their panel. */
export const BRAIN_TABS: TabId[] = ["explore", "ask", "leo", "diseases", "cells"];

type Changes = Record<string, string | null | undefined>;

function apply(params: URLSearchParams, changes: Changes): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === undefined || v === "") next.delete(k);
    else next.set(k, v);
  }
  return next;
}

export function useNav() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : "explore";

  /** Change some address-bar values; `replace` avoids filling the Back history. */
  const update = useCallback((changes: Changes, replace = false) => setParams((p) => apply(p, changes), { replace }), [setParams]);
  const go = useCallback((t: TabId, changes: Changes = {}) => update({ ...changes, tab: t === "explore" ? null : t }), [update]);
  /** A link (for <Link to=…>) that keeps the current page and changes some values. */
  const link = useCallback((changes: Changes) => `?${apply(params, changes).toString()}`, [params]);

  return {
    params,
    tab,
    go,
    update,
    link,
    studyLink: (id: string) => link({ study: id }),
    closeStudy: () => update({ study: null }),
    searchStudies: (q: string) => go("studies", { sq: q, view: null }),
  };
}
