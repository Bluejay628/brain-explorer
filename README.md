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
| **Click-to-zoom** | Clicking a brain part flies the camera to it and centers it. Inner-surface parts hide the other hemisphere; deep parts switch on see-through mode. |
| **All ages (3–90)** | The character grows from a boy to an older man. His situations and daily schedule change with life stage, and studies of his age group are searched first. |
| **Disease changes over time** | Animated, stage-by-stage views of published staging models (Alzheimer's, Parkinson's, Huntington's, ALS, CTE). Asking about one of these starts its animation automatically. |
| **Compare** | Control (typical brain) vs. condition (a situation or a disease stage), side by side, with cameras that move together. |
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

## Disease staging animations (and their limits)

`shared/diseases.ts` encodes five well-known, published **staging models**: Braak & Braak (1991) for Alzheimer's, Braak et al. (2003) for Parkinson's, Vonsattel et al. (1985) for Huntington's, Brettschneider et al. (2013) for ALS, and McKee et al. (2013) for CTE. They describe **where** disease-related changes usually appear and **in what order**, based on studies of many brains.

- The animation colors regions from pale yellow (earlier or less) to deep red (later or more). These intensities are **illustrative**, not measurements.
- **Stages are not years.** Timing is described only in words, and real people vary a lot.
- Each model has a **"Find the original paper"** button that searches the research databases for the real paper, instead of relying on a reference typed by hand.
- Tests (`tests/diseases.test.ts`) check that every model uses real atlas regions and that no region "gets better" in a later stage.

## Citations (APA 7 / MLA 9)

Every study and web page has a **Cite** button. Each answer has a **Cite these sources** bibliography, and the Saved page has a bibliography of everything saved. Citations are built in `shared/citations.ts` only from metadata we actually have:
- APA: up to 20 authors (19 … last for 21+), "n.d." when there's no date, title first when there are no authors, "[Preprint]" for preprints, and the DOI link when available.
- MLA: one author, two authors, or "et al."; DOI or URL; "Accessed" date for web pages.
- Volume, issue and page numbers aren't stored, so they're left out rather than guessed. The DOI or link lets readers find the full reference.
- "Copy" puts both formatted text (with italics, for Google Docs or Word) and plain text on the clipboard.

## Why the AI doesn't just "answer from the internet" (or from memory)

Chatbots answering from memory can invent studies that don't exist. Brain Explorer never lets the AI answer without sources. When studies are thin, it searches **trusted websites**, and every web statement must cite a page the search tool actually returned. The citation checker removes anything else, and if nothing reliable is found, the app still says "insufficient evidence".

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

You need **Node.js 20.11 or newer** (`node -v` to check).

```bash
git clone <your repo url>
cd brain-explorer
npm install
cp .env.example .env      # then edit .env (see below)
npm run check             # plain-language check: .env, key, each database (never prints the key)
npm run seed              # optional: downloads a starter library of real research records
npm run dev               # starts the server (:8787) and the website (:5173)
```

Open http://localhost:5173.

To try the finished, published version on your own computer: `npm run preview`, then open http://localhost:8787.

### Environment variables (`.env`)

| Variable | Required? | What it's for |
|---|---|---|
| `ANTHROPIC_API_KEY` | Optional | Enables AI answers. Get one at https://console.anthropic.com/. Without it the app runs in **retrieval-only** mode. API usage is billed by Anthropic. |
| `CLAUDE_MODEL` | Optional | Defaults to `claude-opus-5-5`. |
| `NCBI_API_KEY` | Optional | Raises the PubMed limit from 3 to 10 requests/second. Free from your NCBI account settings. |
| `NCBI_EMAIL` | Recommended | NCBI asks API users to give a contact email. |
| `NCBI_TOOL` | Optional | Tool name sent to NCBI (default `brain-explorer`). |
| `CONTACT_EMAIL` | Recommended | Sent to OpenAlex/Semantic Scholar so they can contact you instead of blocking you. |
| `SEMANTIC_SCHOLAR_API_KEY` | Optional | Higher Semantic Scholar rate limit (free on request). |
| `MAX_AI_CALLS_PER_DAY` | Optional | Daily limit on Claude calls for the whole website (default 300). Protects your bill once the site is public. Repeated questions are answered from a cache and don't count. |
| `TRUST_PROXY` | Optional | Number of proxies in front of the server (default 1 in production, 0 in dev). Needed so rate limits see real visitor IPs on hosts like Render. |
| `PORT` | Optional | Server port (default 8787). Hosts like Render set this for you. |
| `DATA_DIR` | Optional | Where `library.json` is stored (default `data/`). |

**Never put keys in front-end code, and never commit `.env`.** It is already listed in `.gitignore`. The `/api/status` endpoint only reports *whether* a key is set, never its value (there's a test for this).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Server + website with live reload |
| `npm run seed` | Fill `data/library.json` with real records from all four databases (safe to re-run) |
| `npm run check` | Plain-language check of your `.env`, API key, each research database, the library and the build (never prints the key) |
| `npm test` | Run the automated tests |
| `npm run typecheck` | TypeScript type-check |
| `npm run preview` | Build the website and run it exactly as it would be published, on :8787 |
| `npm run build` then `npm start` | Same thing in two steps (this is what a hosting service runs) |

## Publishing it on the internet

The app is one Node.js server that serves both the website and the `/api`. Any host that runs Node 20+ works. It is **not** a static site, so GitHub Pages can't run it (Pages can't keep your API key secret).

**Easiest: Render (free plan)**
1. Push your code to GitHub (`.env` is never pushed; `.gitignore` blocks it).
2. Go to https://render.com, sign in with GitHub, click **New + → Blueprint**, and pick this repository. Render reads `render.yaml`.
3. When it asks for `ANTHROPIC_API_KEY`, paste your key **there** (in Render's dashboard, never in a file). Also fill `NCBI_EMAIL` and `CONTACT_EMAIL` with your email. Leave the key blank for a free retrieval-only site.
4. Click **Apply**. After the build (a few minutes) you get a link like `https://brain-explorer-xxxx.onrender.com`.
5. Check `https://<your-link>/api/health` shows `{"ok":true}` and Settings → Server status shows the AI engine as configured.

**Any other host / Docker:** build with `npm ci && npm run build`, start with `npm start`, health check at `/api/health`. A `Dockerfile` is included (`docker build -t brain-explorer . && docker run -p 8787:8787 -e ANTHROPIC_API_KEY=... brain-explorer`).

**Before you share the link:**
- Set a monthly spending limit at console.anthropic.com → Billing → Limits. Each AI answer costs a few cents (more when web search runs). `MAX_AI_CALLS_PER_DAY` adds a second safety net.
- The free Render plan sleeps after ~15 minutes without visitors; the first visit after that takes ~30–60 seconds.
- On free hosts the disk is temporary, so the library cache is wiped on each restart. That's fine: the app searches the databases live.
- Each visitor's saved studies and settings stay in their own browser.

## Data sources

Brain Explorer searches **four official, free research databases** in parallel. You can turn each one on or off in **Settings**.

| Source | Coverage | Used for | Notes |
|---|---|---|---|
| **PubMed / NCBI E-utilities** ([docs](https://www.ncbi.nlm.nih.gov/books/NBK25501/)) | ~38M biomedical citations | Metadata, abstracts, expert MeSH indexing (age groups, species) | Optional `NCBI_API_KEY` raises the rate limit. See NLM [terms](https://www.nlm.nih.gov/databases/download/terms_and_conditions.html). |
| **Europe PMC** ([docs](https://europepmc.org/RestfulWebService)) | PubMed + extra life-science journals, open full texts, **preprints** | Same as PubMed, plus preprints | No key. Preprints are labeled "not peer reviewed". |
| **OpenAlex** ([docs](https://docs.openalex.org/)) | ~250M works from all publishers | Broad coverage of medicine, neuroscience and psychology journals | No key. Limited to fields 27/28/32 and works with abstracts. Set `CONTACT_EMAIL` for faster, more reliable access. Data is CC0. |
| **Semantic Scholar** ([docs](https://api.semanticscholar.org/api-docs/graph)) | ~200M papers | Extra psychology and neuroscience coverage | Optional `SEMANTIC_SCHOLAR_API_KEY`; without it, a shared public rate limit applies, so it may be slow. |
| **NeuroVault** ([neurovault.org](https://neurovault.org/)) | Published statistical brain maps | Checking whether authors shared maps | Exact DOI match only. Maps are linked, not drawn. |
| **Trusted web search** (Claude's `web_search` tool) | ~45 trusted domains | Filling gaps when fewer than 4 relevant studies are found | Limited by the API to government health agencies (NIH, CDC, WHO, NHS…), major medical centers, universities and journals (`TRUSTED_DOMAINS` in `server/ai/web.ts`). Only pages the search actually returned **with verbatim excerpts** are used, and only those excerpts reach the AI. Can be turned off in Settings. Web search costs about $10 per 1,000 searches, plus tokens. |
| **Claude API** ([docs](https://platform.claude.com/docs/en/api/messages/create)) | — | Writing the structured answer from retrieved studies and web excerpts | Server-side only. Only the question, public abstracts and web excerpts are sent. |

How the sources work together:
- The **same paper found in several databases is merged** (by PMID, DOI or title). The record remembers every database it appeared in ("Found in: PubMed · OpenAlex").
- **Age-group searches** for the character only run on PubMed and Europe PMC, which have expert age indexing. For other sources, age and species are detected from abstract words and labeled *keyword-derived*.
- If one database is down or slow, the others still return results, and the answer's **Search coverage** shows exactly which databases were searched and which failed.
- **Preprints** (not yet peer reviewed) are labeled in red. The AI is told to say when it relies on one.
- Only these databases are searched, not the general web. That is deliberate: every record has a traceable identifier and a source link.

The local library (`data/library.json`, git-ignored) holds only records fetched from these databases. To add a specific paper, put its PMID in `EXTRA_PMIDS` in `scripts/seed-library.ts`, or open `/study/<PMID>` in the app.

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

**Automated** (`npm test`, 87 tests):
- `tests/research.test.ts`: PubMed XML parsing, missing-data handling, sample-size extraction, deduplication, query building, retry/rate-limit handling, malformed responses, search coverage reporting, NeuroVault DOI matching.
- `tests/diseases.test.ts`: disease models use only real, drawable atlas regions; stages never improve; each model names its source; disease detection in questions.
- `tests/lifestage.test.ts`: ages 3–90, life stages, age-appropriate situations and days; the character's own description ("a 16-year-old teenage boy") never becomes a hidden age filter.
- `tests/web.test.ts`: only trusted domains with verbatim excerpts become web sources (look-alike domains rejected); invented web citations removed; web search only runs when studies are thin and can be turned off; still "insufficient evidence" when the web finds nothing reliable.
- `tests/citations.test.ts`: APA and MLA formatting for single, multiple, group and 21+ authors; missing data (n.d., no authors, no DOI); preprints; web pages; alphabetical bibliographies.
- `tests/sources.test.ts`: Europe PMC, OpenAlex and Semantic Scholar parsing; preprint labeling; cross-database merging; one source failing doesn't block others; age searches only where supported; user's source choice respected.
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
- **Live calls to PubMed, Europe PMC, OpenAlex, Semantic Scholar and NeuroVault have not yet been tested end-to-end.** They were blocked by the network policy of the cloud environment the app was built in. The parsing and error handling are unit-tested against PubMed-format sample data. Run `npm run seed` locally to confirm the live connection works.
- **The Claude integration has not yet been run with a real key.** The request is type-checked against the official SDK, and the validation and fallback logic is tested with a stub.
- **Methods, sample size and region mentions are keyword-detected** from abstracts and can be wrong. The UI labels them as such.
- **Abstracts only.** The AI reads abstracts, not full papers, so details such as limitations are often missing.
- **Local search is simple keyword matching.** Fine for hundreds of records; a real search index would be needed for many thousands.
- **Saved studies live in one browser.** There are no accounts or sync.
- **Rate limiting, the daily AI cap and the answer cache are in-memory.** They reset when the server restarts, which is fine for one server.

## Planned improvements

- Render verified NeuroVault maps on the fsaverage surface (the model is now in a standard space, so this is feasible).
- Age-specific brain templates for children and teens.
- Manually reviewed "featured" studies (`verification: "manually-reviewed"`).
- Per-study AI summaries clearly labeled as AI interpretation.
- Europe PMC open-access full text (currently abstracts only).
- Streaming answers so text appears while it's being written.

## Licensing and attribution

- Code: © the Brain Explorer authors. Choose a license (e.g. MIT) before publishing the repository.
- Study metadata and abstracts: from PubMed / NLM, with copyright held by the respective publishers. Every record links to its source.
- Fonts: Inter and JetBrains Mono (SIL Open Font License) via Google Fonts.
- 3D model: FreeSurfer fsaverage5 + Desikan-Killiany atlas + aseg, via nilearn (BSD-3) and ggseg.formats (MIT). See "3D brain model: sources and licenses".
- Libraries: React, Three.js, Express, Zod, fast-xml-parser, Anthropic SDK (see `package.json`; all open-source).
