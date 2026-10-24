# Brain Explorer

An interactive neuroscience research tool built around a character. Students explore the brain of **Leo**, a fictional student whose age they choose (8–25). They put him in everyday situations, follow a day in his life, or ask anything. Every answer is a short, clear explanation built from published research, by an AI that **shows the evidence behind every explanation**.

Built as a student project for the Congressional App Challenge.

> **Status:** first working release. See [Known limitations](#known-limitations) for what's real, what's a placeholder, and what's not yet verified.

---

## What it does

| Feature | What you can do |
|---|---|
| **Brain Lab (character)** | Set the character's name and age; pick from 12 situations or 9 moments in his day; ask free questions. Answers are written as short student paragraphs with citations; hormones are covered only when asked. |
| **Realistic 3D brain** | A real MRI-derived average brain (FreeSurfer fsaverage) with 34 atlas regions per hemisphere and real deep-structure meshes. Rotate, zoom, reset, hide hemispheres, see-through mode, atlas lines and colors, hormone-gland markers. |
| **Subdivisions** | Add or remove up to 10 subdivisions; each is colored on the brain and listed with its function. |
| **AI research answers** | Ask a question → the app retrieves real studies → Claude writes a structured answer → **every citation is checked** against the retrieved studies before you see it. |
| **Research Library** | Search by topic, title, keyword, author, DOI or PubMed ID; filter by year, study type, population and method. |
| **Study details** | Full PubMed metadata, abstract, evidence profile, links to PubMed/publisher/free full text, and a NeuroVault brain-map check. |
| **Saved Studies** | Save studies and come back to them (stored in your browser). |
| **Settings** | Theme, search defaults, server status, and an explanation of data sources and privacy. |

## The character, and why it's honest

Science studies groups, not one person, so nobody can say exactly what happens inside one specific boy's brain. Brain Explorer handles this openly:

- The character is labeled **fictional** everywhere, and the 3D brain is labeled as an **average brain model**, not his scan.
- His age decides which research is **searched first**: PubMed's matching age group (child 6–12, adolescent 13–18, young adult 19–24). Studies of other ages are still included.
- Every study gets a **population label**, computed by the server rather than the AI: *Same age group*, *Different age group*, *Animal study*, or *Age not indexed*. The AI is told to say when it relies on evidence from adults or animals.
- Answers say "research suggests that in people his age…" rather than stating facts about him.
- Hormones are discussed **only when asked**: either the "Also explain hormones" box is ticked or the question mentions a hormone. Otherwise hormone notes are removed and the answer says so.

## How the AI stays neuroscience-focused

It isn't possible to download "all of neuroscience", but the engine gets close in practical terms:

1. **All of PubMed** (about 38 million records) is searched live whenever the local library is thin. Searches are restricted to brain, cognition, emotion and hormone research (`NEURO_FOCUS` in `server/research/pubmed.ts`).
2. **Everyday words are translated into research terms** before searching ("all-nighter" → "sleep deprivation", "scary movie" → "fear"). Each ready-made situation also carries an explicit research focus.
3. **Textbook background:** short overviews of every atlas region are given to the AI as clearly labeled background. The AI may cite them as *Textbook background*, but the validator never lets them count as research findings.
4. **A bigger starter library:** `npm run seed` also downloads studies for every situation, both for teens and in general.

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

## 3D brain model: sources and licenses

The model (`public/models/brain.json`, about 1.2 MB compressed) is built by `scripts/build-brain-model.py` from:

| Part | Source | License / terms |
|---|---|---|
| Cortical surface (pial) and sulcal depth | FreeSurfer **fsaverage5**, an average of 40 adult MRI scans (Fischl et al., 1999), as redistributed in the [nilearn](https://nilearn.github.io) Python package | FreeSurfer terms ([license](https://surfer.nmr.mgh.harvard.edu/fswiki/FreeSurferSoftwareLicense)). nilearn lists the license as "unknown"; it is widely redistributed with attribution. **Check before commercial use.** |
| Cortical regions | **Desikan-Killiany atlas** (Desikan et al., 2006, *NeuroImage* 31:968–980) on fsaverage5, via [ggseg.formats](https://github.com/ggsegverse/ggseg.formats) | ggseg code: MIT. Atlas: FreeSurfer distribution. |
| Deep structures | FreeSurfer **aseg** structures on fsaverage5 (Fischl et al., 2002), via ggseg.formats | As above |
| Gland markers | Hypothalamus, pituitary and pineal markers at approximate standard-brain positions | Written for this app and labeled "approximate" |

The deep-structure meshes use a different coordinate origin than the surfaces. The build script aligns them by fitting the corpus callosum mesh onto the surface's corpus callosum label (average residual about 1.6 mm). After alignment, structure centers fall at standard positions; for example, the left hippocampus is at about (−25, −23, −14) mm.

**Important limits:** this is an *average adult* brain. It is not the character's brain, and it shows where regions are, never brain activity. Children's and teens' brains differ in fine detail, such as cortical thickness and the timing of maturation.

To rebuild the model: `pip install rdata nibabel numpy`, clone `ggseg.formats`, download and unzip the nilearn wheel, then run `python scripts/build-brain-model.py <ggseg.formats dir> <nilearn fsaverage5 dir>`.

## Testing

**Automated** (`npm test`, 50 tests):
- `tests/research.test.ts`: PubMed XML parsing, missing-data handling, sample-size extraction, deduplication, query building, retry/rate-limit handling, malformed responses, search coverage reporting, NeuroVault DOI matching.
- `tests/character.test.ts`: character intent (topic cleanup, everyday→research terms), hormones only when asked, age-group mapping, population labels, textbook background never counted as a finding, age-matched PubMed search first, region hierarchy integrity.
- `tests/integrity.test.ts`: intent extraction (no silent filters), citation validation (fabricated citations removed), unsupported region claims, insufficient-evidence behavior, retrieval-only mode, PubMed-failure honesty, API key not exposed, input validation.

The test fixtures are **synthetic** (titles start with `[TEST FIXTURE]`, and PMIDs are in the unused 90,000,000+ range). They are never loaded by the app.

**Manual checklist:**
- [ ] Home loads; the brain rotates; suggested questions navigate to Explore.
- [ ] Brain Lab: change the name and age, pick a situation, open the Day tab, tick "Also explain hormones" and confirm a hormone section appears only then.
- [ ] Subdivisions tab: add 3 subdivisions → each gets its own color on the brain; Remove works.
- [ ] Layers: hide the right hemisphere → the left hemisphere's inner surface shows; "Deep structures" shows the hippocampus and others inside.
- [ ] Brain Lab: rotate left/right, zoom in/out, reset, and auto-rotate buttons work; drag and scroll/pinch work; clicking the brain selects a region; region buttons work with the keyboard (Tab + Enter).
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

- **The 3D brain is an average adult brain**, not age-specific. Atlas boundaries are approximate for any individual.
- **Live PubMed and NeuroVault calls have not yet been tested end-to-end.** They were blocked by the network policy of the cloud environment the app was built in. The parsing and error handling are unit-tested against PubMed-format sample data. Run `npm run seed` locally to confirm the live connection works.
- **The Claude integration has not yet been run with a real key.** The request is type-checked against the official SDK, and the validation and fallback logic is tested with a stub.
- **Methods, sample size and region mentions are keyword-detected** from abstracts and can be wrong. The UI labels them as such.
- **Abstracts only.** The AI reads abstracts, not full papers, so details such as limitations are often missing.
- **Local search is simple keyword matching.** Fine for hundreds of records; a real search index would be needed for many thousands.
- **Saved studies live in one browser.** There are no accounts or sync.
- **Rate limiting is in-memory.** It resets when the server restarts, which is fine for one server.

## Planned improvements

- Render verified NeuroVault maps on the fsaverage surface (the model is now in a standard space, so this is feasible).
- Age-specific brain templates for children and teens.
- Manually reviewed "featured" studies (`verification: "manually-reviewed"`).
- Per-study AI summaries clearly labeled as AI interpretation.
- Europe PMC as a second source (open-access full text).
- Streaming answers so text appears while it's being written.

## Licensing and attribution

- Code: © the Brain Explorer authors. Choose a license (e.g. MIT) before publishing the repository.
- Study metadata and abstracts: from PubMed / NLM, with copyright held by the respective publishers. Every record links to its source.
- Fonts: Inter and JetBrains Mono (SIL Open Font License) via Google Fonts.
- 3D model: FreeSurfer fsaverage5 + Desikan-Killiany atlas + aseg, via nilearn (BSD-3) and ggseg.formats (MIT). See "3D brain model: sources and licenses".
- Libraries: React, Three.js, Express, Zod, fast-xml-parser, Anthropic SDK (see `package.json`; all open-source).
