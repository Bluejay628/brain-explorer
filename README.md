# Brain Explorer

An interactive neuroscience research tool. Explore a 3D brain, search real published research, and ask questions answered by an AI that **shows the evidence behind every explanation**.

Built as a student project for the Congressional App Challenge.

> **Status:** first working release. See [Known limitations](#known-limitations) for what's real, what's a placeholder, and what's not yet verified.

---

## What it does

| Feature | What you can do |
|---|---|
| **Explore Brain** | Rotate, zoom and reset a 3D brain; click regions (or use the region buttons) to read an overview; ask questions. |
| **AI research answers** | Ask a question → the app retrieves real studies → Claude writes a structured answer → **every citation is checked** against the retrieved studies before you see it. |
| **Research Library** | Search by topic, title, keyword, author, DOI or PubMed ID; filter by year, study type, population and method. |
| **Study details** | Full PubMed metadata, abstract, evidence profile, links to PubMed/publisher/free full text, and a NeuroVault brain-map check. |
| **Saved Studies** | Save studies and come back to them (stored in your browser). |
| **Settings** | Theme, search defaults, server status, and an explanation of data sources and privacy. |

## Scientific-integrity principles

These are enforced in code and covered by automated tests (`tests/integrity.test.ts`):

1. **No invented citations.** The AI may only cite records the server actually retrieved. Any other citation is removed, and the removal is reported in the answer ("Citation checks").
2. **Unsupported statements are dropped.** A claim with no valid citation is removed. If nothing supported remains, the answer becomes **"Insufficient evidence."**
3. **Insufficient evidence is said out loud.** If no relevant studies are found, the AI is not called at all.
4. **Findings vs. interpretation.** Each statement is labeled *Reported by authors*, *AI interpretation*, *Hypothesis* or *Open question*.
5. **Every derived field shows its provenance.** e.g. "Verbatim from the source", "PubMed indexing", or "Auto-detected by keyword — verify". Missing data is shown as "Not reported", never guessed.
6. **Search coverage is honest.** The answer lists which sources were searched (local library, PubMed), how many results each gave, and any errors. Nothing claims a source was searched when it wasn't.
7. **No fabricated brain maps.** The app never colors the brain from an AI answer. Regions highlighted after an answer are only those that cited abstracts mention *and* the validator confirmed, and the UI says this is not an activation map. Published statistical maps are only shown if found on NeuroVault by exact DOI match, and they are linked rather than drawn (see below).
8. **Not a diagnostic tool.** Nothing in the app describes, scans or predicts any individual's brain.

## Architecture (in plain language)

```
 Browser (React + Three.js)            Server (Node + Express)              Outside services
 ──────────────────────────            ───────────────────────              ────────────────
 Pages, 3D brain, saved studies  ──►   /api/search  ─► local library  ──►   PubMed (NCBI E-utilities)
 (no API keys ever live here)          /api/ask     ─► RAG engine     ──►   Claude API (Anthropic)
                                       /api/studies ─► NeuroVault     ──►   NeuroVault API
                                       keys in .env only
```

- **Front end** (`src/`): React + TypeScript, built with Vite. The 3D brain is plain Three.js (`src/brain/scene.ts`).
- **Back end** (`server/`): Express. It keeps the API keys and talks to the outside services.
- **Shared types** (`shared/`): the data shapes both sides use (`ResearchRecord`, `ResearchAnswer`, …) and the brain-region dictionary.

### The research workflow (`server/ai/engine.ts`)

1. **Intent extraction** (`server/ai/intent.ts`): rules (not AI) work out the task (explain / find / compare / limitations / region) and any filters the user **actually stated**, such as age group, dates ("recent" = last 5 years, explained to the user), study type and method. Nothing is assumed silently.
2. **Local library first**, then **PubMed** only if fewer than 5 relevant local studies are found.
3. **Normalize, deduplicate** (PMID → DOI → title+year) and **rank** by relevance; keep the top 8.
4. If nothing relevant was found → **insufficient-evidence** response (no AI call).
5. If no Claude key is configured → **retrieval-only** response (studies shown, no summary).
6. Otherwise, Claude (`claude-opus-5-5`) gets the question and the study records and must reply in a strict JSON schema (`server/ai/schema.ts`).
7. **Citation validation** (`server/ai/validate.ts`).
8. **Brain-map lookup** on NeuroVault for cited imaging studies.

## Setup

You need **Node.js 20 or newer** (`node -v` to check).

```bash
git clone <your repo url>
cd brain-explorer
npm install
cp .env.example .env      # then edit .env (see below)
npm run seed              # downloads a starter library of real PubMed records
npm run dev               # starts the server (:8787) and the website (:5173)
```

Open http://localhost:5173.

### Environment variables (`.env`)

| Variable | Required? | What it's for |
|---|---|---|
| `ANTHROPIC_API_KEY` | Optional | Enables AI answers. Get one at https://console.anthropic.com/. Without it the app runs in **retrieval-only** mode. API usage is billed by Anthropic. |
| `CLAUDE_MODEL` | Optional | Defaults to `claude-opus-5-5`. |
| `NCBI_API_KEY` | Optional | Raises the PubMed limit from 3 to 10 requests/second. Free from your NCBI account settings. |
| `NCBI_EMAIL` | Recommended | NCBI asks API users to give a contact email. |
| `NCBI_TOOL` | Optional | Tool name sent to NCBI (default `brain-explorer`). |
| `PORT` | Optional | Server port (default 8787). |

**Never put keys in front-end code, and never commit `.env`.** It is already listed in `.gitignore`. The `/api/status` endpoint only reports *whether* a key is set, never its value (there's a test for this).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Server + website with live reload |
| `npm run seed` | Fill `data/library.json` with real PubMed records (safe to re-run) |
| `npm test` | Run the automated tests |
| `npm run typecheck` | TypeScript type-check |
| `npm run build` then `npm start` | Production build, served by the Express server on :8787 |

## Data sources

| Source | Used for | Notes |
|---|---|---|
| **PubMed / NCBI E-utilities** ([docs](https://www.ncbi.nlm.nih.gov/books/NBK25501/)) | Study metadata and abstracts | Rate-limited client (`server/research/pubmed.ts`) with retries and timeouts. Abstracts may be copyrighted by publishers; the app shows them for reference with links to the source. See NLM's [terms](https://www.nlm.nih.gov/databases/download/terms_and_conditions.html). |
| **NeuroVault** ([neurovault.org](https://neurovault.org/)) | Checking whether authors published statistical brain maps | Exact DOI match only. Maps are linked, not drawn. |
| **Claude API** ([docs](https://platform.claude.com/docs/en/api/messages/create)) | Writing the structured answer from retrieved studies | Server-side only. Only the question and public abstracts are sent. Uses the server-side refusal fallback (`fallbacks: "default"`). |

The local library is a JSON file (`data/library.json`, git-ignored). It holds only records fetched from PubMed. To add a specific paper, put its PMID in `EXTRA_PMIDS` in `scripts/seed-library.ts`, or open `/study/<PMID>` in the app.

## The 3D brain model

The current model is a **schematic placeholder**, generated procedurally from ellipsoids, noise-based folds and approximate fissures. It is labeled as such in the UI. Region boundaries are rough and for orientation only. Deep structures (hippocampus, amygdala, thalamus, basal ganglia, insula, anterior cingulate) are drawn at approximate positions.

**Why published maps aren't drawn on it:** statistical brain maps live in a standard coordinate space (usually MNI). The placeholder has no such coordinates, so overlaying a map would be misleading. Maps are linked to NeuroVault's own viewer instead.

### Replacing the brain model

A good upgrade is a mesh in MNI space with an atlas parcellation, for example meshes derived from the ICBM152 template or a FreeSurfer `fsaverage` surface. **Check the license of any model and add attribution here.** To swap it in:

1. Export a `.glb` file whose meshes are named by the region ids in `shared/regions.ts` (e.g. `hippocampus`).
2. In `src/brain/scene.ts`, load it with Three.js's `GLTFLoader` instead of `buildHemisphere()`, and set `mesh.userData.regionId` on each mesh. Picking, selection, x-ray and highlighting already work with any mesh that has `userData.regionId`.
3. Only once the mesh is in a known coordinate space should NeuroVault maps be rendered on it.

## Testing

**Automated** (`npm test`, 36 tests):
- `tests/research.test.ts`: PubMed XML parsing, missing-data handling, sample-size extraction, deduplication, query building, retry/rate-limit handling, malformed responses, search coverage reporting, NeuroVault DOI matching.
- `tests/integrity.test.ts`: intent extraction (no silent filters), citation validation (fabricated citations removed), unsupported region claims, insufficient-evidence behavior, retrieval-only mode, PubMed-failure honesty, API key not exposed, input validation.

The test fixtures are **synthetic** (titles start with `[TEST FIXTURE]`, and PMIDs are in the unused 90,000,000+ range). They are never loaded by the app.

**Manual checklist:**
- [ ] Home loads; the brain rotates; suggested questions navigate to Explore.
- [ ] Explore: rotate left/right, zoom in/out, reset, and auto-rotate buttons work; drag and scroll/pinch work; clicking the brain selects a region; region buttons work with the keyboard (Tab + Enter).
- [ ] "Deep structures" shows the inner structures; selecting the hippocampus turns it on automatically.
- [ ] Ask "How does sleep restriction affect working memory?" → answer with numbered citations; clicking a number scrolls to the study.
- [ ] Ask something unanswerable (e.g. "Does quantum entanglement explain consciousness?") → "Insufficient evidence".
- [ ] Without `ANTHROPIC_API_KEY`: answer shows "Retrieval-only mode" plus studies.
- [ ] Library: search by topic, author surname, a DOI and a PMID; apply each filter; turn PubMed on/off.
- [ ] Study page: PubMed link opens the right paper; "Not reported" appears for missing fields; Check NeuroVault works.
- [ ] Save a study → appears in Saved and on Home → still there after reload → Unsave removes it.
- [ ] Settings: switch to high-contrast theme; server status shows correct key status.
- [ ] Phone width (or browser dev-tools device mode): bottom navigation, no sideways scrolling, brain still usable with touch.
- [ ] View page source / network tab: no API key anywhere.

## Known limitations

- **3D model is a schematic placeholder** (see above). It is not anatomically exact.
- **Live PubMed and NeuroVault calls have not yet been tested end-to-end.** They were blocked by the network policy of the cloud environment the app was built in. The parsing and error handling are unit-tested against PubMed-format sample data. Run `npm run seed` locally to confirm the live connection works.
- **The Claude integration has not yet been run with a real key.** The request is type-checked against the official SDK, and the validation and fallback logic is tested with a stub.
- **Methods, sample size and region mentions are keyword-detected** from abstracts and can be wrong. The UI labels them as such.
- **Abstracts only.** The AI reads abstracts, not full papers, so details such as limitations are often missing.
- **Local search is simple keyword matching.** Fine for hundreds of records; a real search index would be needed for many thousands.
- **Saved studies live in one browser.** There are no accounts or sync.
- **Rate limiting is in-memory.** It resets when the server restarts, which is fine for one server.

## Planned improvements

- Licensed anatomical mesh in MNI space, then rendering verified NeuroVault maps on it.
- Manually reviewed "featured" studies (`verification: "manually-reviewed"`).
- Per-study AI summaries clearly labeled as AI interpretation.
- Europe PMC as a second source (open-access full text).
- Streaming answers so text appears while it's being written.

## Licensing and attribution

- Code: © the Brain Explorer authors. Choose a license (e.g. MIT) before publishing the repository.
- Study metadata and abstracts: from PubMed / NLM, with copyright held by the respective publishers. Every record links to its source.
- Fonts: Inter and JetBrains Mono (SIL Open Font License) via Google Fonts.
- 3D model: procedurally generated by this project. No third-party model assets are used yet.
- Libraries: React, Three.js, Express, Zod, fast-xml-parser, Anthropic SDK (see `package.json`; all open-source).
