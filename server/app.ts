import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";
import { config } from "./config.js";
import { Library } from "./research/library.js";
import { combinedSearch } from "./research/search.js";
import { efetch } from "./research/pubmed.js";
import { answerQuestion, type EngineDeps } from "./ai/engine.js";
import { isAiConfigured } from "./ai/claude.js";
import { lookupBrainMaps } from "./maps/neurovault.js";
import type { ServerStatus } from "../shared/types.js";

// ── Input validation: never trust what the browser sends ──
const FiltersSchema = z
  .object({
    yearFrom: z.number().int().min(1800).max(2100).optional(),
    yearTo: z.number().int().min(1800).max(2100).optional(),
    categories: z
      .array(z.enum(["meta-analysis", "systematic-review", "review", "randomized-controlled-trial", "clinical-trial", "original-research", "case-report", "editorial-or-comment", "preprint", "other"]))
      .max(10)
      .optional(),
    methods: z
      .array(z.enum(["functional-mri", "structural-mri", "diffusion-connectivity", "functional-connectivity", "eeg-meg", "pet", "lesion", "brain-stimulation", "behavioral", "animal-model", "computational"]))
      .max(11)
      .optional(),
    ageGroups: z.array(z.enum(["child", "adolescent", "young-adult", "adult", "middle-aged", "older-adult"])).max(6).optional(),
    humansOnly: z.boolean().optional(),
  })
  .strict();

const SourcesSchema = z.array(z.enum(["pubmed", "europepmc", "openalex", "semanticscholar"])).max(4).optional();

const SearchSchema = z.object({
  query: z.string().max(300),
  filters: FiltersSchema.optional(),
  includePubMed: z.boolean().optional(),
  sources: SourcesSchema,
  limit: z.number().int().min(1).max(50).optional(),
});

const AskSchema = z.object({
  question: z.string().trim().min(3, "Please enter a longer question.").max(500, "Please keep questions under 500 characters."),
  selectedRegionId: z.string().max(40).optional(),
  allowPubMed: z.boolean().optional(),
  includeHormones: z.boolean().optional(),
  focus: z.string().trim().max(120).optional(),
  sources: SourcesSchema,
  allowWeb: z.boolean().optional(),
  character: z
    .object({
      name: z.string().trim().min(1).max(24).regex(/^[\p{L}' -]+$/u, "Names can only contain letters."),
      age: z.number().int().min(8).max(25),
    })
    .optional(),
});

/** Tiny in-memory rate limiter so one visitor can't run up the AI bill. */
function rateLimit(maxPerMinute: number) {
  const hits = new Map<string, number[]>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? "unknown";
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
    if (recent.length >= maxPerMinute) {
      res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

export function createApp(deps: Partial<EngineDeps> = {}) {
  const library = deps.library ?? new Library(config.dataDir);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/status", (_req, res) => {
    // Reports whether keys are configured — never the keys themselves.
    const status: ServerStatus = {
      aiConfigured: (deps.aiConfigured ?? isAiConfigured)(),
      model: config.claudeModel,
      ncbiKeyConfigured: Boolean(config.ncbiApiKey),
      librarySize: library.size,
      brainModel: { kind: "anatomical-mesh", attribution: "FreeSurfer fsaverage5 + Desikan-Killiany atlas (via nilearn and ggseg)" },
    };
    res.json(status);
  });

  app.post("/api/search", rateLimit(30), async (req, res) => {
    const parsed = SearchSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: "Invalid search request." });
    const result = await combinedSearch(library, parsed.data, deps.sources ?? deps.pubmed);
    res.json(result);
  });

  app.get("/api/studies/:id", async (req, res) => {
    const id = String(req.params.id);
    const local = library.get(id);
    if (local) return void res.json(local);
    const pmid = id.replace(/^pmid:/, "");
    if (!/^\d{5,9}$/.test(pmid)) return void res.status(404).json({ error: "Study not found." });
    try {
      const [rec] = await efetch([pmid]);
      if (!rec) return void res.status(404).json({ error: "No PubMed record with that ID." });
      library.upsert([rec]);
      res.json(rec);
    } catch (err) {
      res.status(502).json({ error: `Could not retrieve this study from PubMed: ${(err as Error).message}` });
    }
  });

  app.get("/api/studies/:id/maps", async (req, res) => {
    const rec = library.get(String(req.params.id));
    if (!rec) return void res.status(404).json({ error: "Study not found." });
    res.json(await (deps.brainMaps ?? lookupBrainMaps)(rec));
  });

  app.post("/api/ask", rateLimit(8), async (req, res) => {
    const parsed = AskSchema.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid question." });
    const answer = await answerQuestion(parsed.data, { ...deps, library });
    res.json(answer);
  });

  app.use("/api", (_req, res) => void res.status(404).json({ error: "Unknown API route." }));

  // In production, serve the built front end from dist/.
  const dist = path.resolve(config.dataDir, "../dist");
  if (config.isProduction && fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  // Last-resort error handler: log briefly, never leak internals or secrets.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(`[server] ${err.name}: ${err.message}`);
    res.status(500).json({ error: "Unexpected server error." });
  });

  return app;
}
