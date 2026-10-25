// Citation formatting (APA 7th and MLA 9th editions) for studies and web pages.
//
// Built only from the metadata we actually have. Missing pieces follow each
// style's rules ("n.d." for no date, title first when there are no authors)
// instead of being guessed. Volume/issue/pages are not stored, so they are
// omitted; the DOI or link lets readers find the full reference.
//
// Each function returns { text, html }: plain text for pasting anywhere, and
// HTML with the italics each style requires (journal / site names).

import type { Author, ResearchRecord, WebSource } from "./types.js";

export type CitationStyle = "apa" | "mla";
export interface Citation {
  text: string;
  html: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ensurePeriod = (s: string) => (/[.?!]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MLA_MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

/** "Jean-Paul Alex" → "J.-P. A." */
function initials(foreName: string): string {
  return foreName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.split("-").map((p) => `${p[0].toUpperCase()}.`).join("-"))
    .join(" ");
}

function nameParts(a: Author): { last?: string; first?: string; group?: string } {
  if (a.collective) return { group: a.collective };
  if (a.lastName) return { last: a.lastName, first: a.foreName };
  if (a.fullName) {
    const parts = a.fullName.trim().split(/\s+/);
    return parts.length > 1 ? { last: parts[parts.length - 1], first: parts.slice(0, -1).join(" ") } : { last: parts[0] };
  }
  return {};
}

function apaAuthor(a: Author): string {
  const n = nameParts(a);
  if (n.group) return n.group;
  return n.first ? `${n.last}, ${initials(n.first)}` : n.last ?? "";
}

/** APA 7: up to 20 authors; with 21+, list 19, an ellipsis, then the last. */
function apaAuthors(authors: Author[]): string {
  const list = authors.map(apaAuthor).filter(Boolean);
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  if (list.length <= 20) return `${list.slice(0, -1).join(", ")}, & ${list[list.length - 1]}`;
  return `${list.slice(0, 19).join(", ")}, . . . ${list[list.length - 1]}`;
}

/** MLA 9: one author "Last, First"; two "Last, First, and First Last"; three+ "Last, First, et al." */
function mlaAuthors(authors: Author[]): string {
  const parts = authors.map(nameParts).filter((n) => n.group || n.last);
  if (!parts.length) return "";
  const firstLast = (n: ReturnType<typeof nameParts>) => n.group ?? (n.first ? `${n.last}, ${n.first}` : n.last!);
  const natural = (n: ReturnType<typeof nameParts>) => n.group ?? [n.first, n.last].filter(Boolean).join(" ");
  if (parts.length === 1) return firstLast(parts[0]);
  if (parts.length === 2) return `${firstLast(parts[0])}, and ${natural(parts[1])}`;
  return `${firstLast(parts[0])}, et al.`;
}

function link(r: ResearchRecord): string {
  return r.doi ? `https://doi.org/${r.doi}` : r.sourceUrl;
}

function isPreprint(r: ResearchRecord): boolean {
  return r.peerReview?.value === "preprint" || r.category.value === "preprint";
}

export function citeStudy(r: ResearchRecord, style: CitationStyle): Citation {
  const title = r.title.replace(/\.$/, "");
  const journal = r.journal && r.journal !== "Preprint" ? r.journal : undefined;
  const url = link(r);
  if (style === "apa") {
    const authors = apaAuthors(r.authors);
    const year = `(${r.publicationYear ?? "n.d."})`;
    const preprint = isPreprint(r) ? " [Preprint]" : "";
    // No authors → the title moves into the author position (APA 7, 9.12).
    const head = authors ? `${ensurePeriod(authors)} ${year}. ${ensurePeriod(title + preprint)}` : `${ensurePeriod(title + preprint)} ${year}.`;
    const text = `${head}${journal ? ` ${ensurePeriod(journal)}` : ""} ${url}`;
    const html = `${esc(head)}${journal ? ` <i>${esc(journal)}</i>.` : ""} ${esc(url)}`;
    return { text, html };
  }
  const authors = mlaAuthors(r.authors);
  const container = journal ?? (isPreprint(r) ? "Preprint" : undefined);
  const date = r.publicationYear ? String(r.publicationYear) : undefined;
  const doiOrUrl = r.doi ? `doi:${r.doi}` : r.sourceUrl;
  const headText = `${authors ? `${ensurePeriod(authors)} ` : ""}"${ensurePeriod(title)}"`;
  const tail = [date, doiOrUrl].filter(Boolean).join(", ");
  const text = `${headText}${container ? ` ${container},` : ""} ${ensurePeriod(tail)}`;
  const html = `${esc(headText)}${container ? ` <i>${esc(container)}</i>,` : ""} ${esc(ensurePeriod(tail))}`;
  return { text, html };
}

const SITE_NAMES: Record<string, string> = {
  "nih.gov": "National Institutes of Health",
  "cdc.gov": "Centers for Disease Control and Prevention",
  "medlineplus.gov": "MedlinePlus",
  "who.int": "World Health Organization",
  "nhs.uk": "NHS",
  "mayoclinic.org": "Mayo Clinic",
  "clevelandclinic.org": "Cleveland Clinic",
  "hopkinsmedicine.org": "Johns Hopkins Medicine",
  "apa.org": "American Psychological Association",
  "brainfacts.org": "BrainFacts.org",
  "harvard.edu": "Harvard University",
};

export function siteName(domain: string): string {
  const key = Object.keys(SITE_NAMES).find((d) => domain === d || domain.endsWith(`.${d}`));
  return key ? SITE_NAMES[key] : domain;
}

export function citeWeb(w: WebSource, style: CitationStyle): Citation {
  const site = siteName(w.domain);
  const title = w.title.replace(/\.$/, "");
  const accessed = new Date(w.retrievedAt);
  const valid = !Number.isNaN(accessed.getTime());
  const year = w.pageAge?.match(/\b(19|20)\d{2}\b/)?.[0];
  if (style === "apa") {
    // Organization as author; the site name is dropped when it matches the author (APA 7, 9.8).
    const retrieved = valid ? ` Retrieved ${MONTHS[accessed.getUTCMonth()]} ${accessed.getUTCDate()}, ${accessed.getUTCFullYear()}, from` : "";
    const text = `${site}. (${year ?? "n.d."}). ${ensurePeriod(title)}${retrieved} ${w.url}`;
    const html = `${esc(site)}. (${year ?? "n.d."}). <i>${esc(ensurePeriod(title))}</i>${esc(retrieved)} ${esc(w.url)}`;
    return { text, html };
  }
  const acc = valid ? ` Accessed ${accessed.getUTCDate()} ${MLA_MONTHS[accessed.getUTCMonth()]} ${accessed.getUTCFullYear()}.` : "";
  const text = `"${ensurePeriod(title)}" ${site},${year ? ` ${year},` : ""} ${w.url}.${acc}`;
  const html = `"${esc(ensurePeriod(title))}" <i>${esc(site)}</i>,${year ? ` ${year},` : ""} ${esc(w.url)}.${esc(acc)}`;
  return { text, html };
}

/** A bibliography in the style's order: APA and MLA both sort alphabetically. */
export function bibliography(items: Citation[]): Citation {
  const sorted = [...items].sort((a, b) => a.text.replace(/^["“]/, "").localeCompare(b.text.replace(/^["“]/, "")));
  return { text: sorted.map((c) => c.text).join("\n\n"), html: sorted.map((c) => `<p style="padding-left:2em;text-indent:-2em">${c.html}</p>`).join("") };
}
