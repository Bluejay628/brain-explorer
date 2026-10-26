// Setup checker for beginners. Run with:  npm run check
// Tells you, in plain words, whether everything Brain Explorer needs is working.
// It NEVER prints your key.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const root = process.cwd();
const ok = (msg: string) => console.log(`  ✅ ${msg}`);
const warn = (msg: string) => console.log(`  ⚠️  ${msg}`);
const bad = (msg: string) => console.log(`  ❌ ${msg}`);
const tip = (msg: string) => console.log(`     👉 ${msg}`);

async function checkEnvFile(): Promise<boolean> {
  console.log("1. The .env file");
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) {
    bad("No file named exactly .env was found in the project folder.");
    const lookalikes = fs.readdirSync(root).filter((f) => /env/i.test(f) && f !== ".env.example");
    if (lookalikes.length) tip(`Found ${lookalikes.map((f) => `"${f}"`).join(", ")} — rename it to exactly .env (nothing before or after).`);
    else tip("Copy .env.example, paste it in the same folder, and rename the copy to exactly .env");
    return false;
  }
  ok("Found .env in the project folder.");
  return true;
}

async function checkKey() {
  console.log("\n2. The Claude API key (needed for AI answers and web search)");
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    warn("ANTHROPIC_API_KEY is empty — the app will run in retrieval-only mode (studies, no AI summaries).");
    tip("Open .env, paste your key right after  ANTHROPIC_API_KEY=  (no spaces), and SAVE the file (Ctrl+S / Cmd+S).");
    return;
  }
  if (!key.startsWith("sk-ant-")) {
    bad(`The key doesn't look right (it should start with "sk-ant-", yours starts with "${key.slice(0, 4)}…").`);
    tip("Copy the key again from console.anthropic.com → API Keys. Make sure you copied the whole thing.");
    return;
  }
  ok(`A key is set (sk-ant-…${"*".repeat(6)}, ${key.length} characters).`);
  try {
    const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 20_000 });
    await client.models.list({ limit: 1 }); // free request
    ok("The key works — Anthropic accepted it.");
    tip("Web search also needs to be allowed for your organization: console.anthropic.com → Settings → Privacy (web search).");
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      bad("Anthropic rejected the key.");
      tip("The key may have been deleted or copied wrong. Create a new key at console.anthropic.com → API Keys.");
    } else if (err instanceof Anthropic.PermissionDeniedError) {
      bad("The key is valid but not allowed to make requests.");
      tip("Check Billing at console.anthropic.com — the account may need credit added.");
    } else if (err instanceof Anthropic.APIConnectionError) {
      bad("Could not reach Anthropic (internet problem or blocked network).");
    } else {
      bad(`Unexpected problem checking the key: ${(err as Error).message}`);
    }
  }
}

async function checkDatabases() {
  console.log("\n3. Research databases (live test search: \"hippocampus memory\")");
  const { DEFAULT_SOURCES } = await import("../server/research/sources/index.js");
  const { SOURCE_INFO } = await import("../shared/types.js");
  await Promise.all(
    Object.entries(DEFAULT_SOURCES).map(async ([id, search]) => {
      const name = SOURCE_INFO[id as keyof typeof SOURCE_INFO].name;
      try {
        const res = await search!("hippocampus memory", { neuroFocus: true }, 3, { retries: 1, timeoutMs: 20_000 });
        if (res.records.length) ok(`${name}: working (${res.records.length} test results)`);
        else warn(`${name}: reachable, but the test search returned nothing.`);
      } catch (err) {
        bad(`${name}: ${(err as Error).message}`);
        if (/429/.test((err as Error).message)) tip("Rate limited — wait a minute and try again (Semantic Scholar often does this without an API key).");
        else tip("Check your internet connection. On a school or company network, this site may be blocked.");
      }
    }),
  );
}

function checkLibrary() {
  console.log("\n4. The local research library");
  try {
    const lib = JSON.parse(fs.readFileSync(path.join(root, "data", "library.json"), "utf8"));
    const n = Array.isArray(lib.records) ? lib.records.length : 0;
    if (n > 0) ok(`${n} real research records are stored.`);
    else {
      warn("The library is empty.");
      tip("Run:  npm run seed   (optional — the app can search the databases live)");
    }
  } catch {
    warn("No library yet.");
    tip("Run:  npm run seed   (optional — the app can search the databases live)");
  }
}

function checkBuild() {
  console.log("\n5. The website build (only needed for `npm start` / publishing)");
  if (fs.existsSync(path.join(root, "dist", "index.html"))) ok("Built website found in dist/.");
  else tip("Not built yet. For development use  npm run dev . To publish or test the real thing:  npm run preview");
}

async function main() {
  console.log("\nBrain Explorer setup check\n");
  if (!fs.existsSync(path.join(root, "package.json"))) {
    bad("You are not in the brain-explorer folder.");
    tip("In the terminal, type:  cd brain-explorer   and run npm run check again.");
    return;
  }
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 20) {
    bad(`Node.js ${process.versions.node} is too old. Install Node.js 20 or newer from nodejs.org.`);
    return;
  }
  await checkEnvFile();
  await import("dotenv/config");
  await checkKey();
  await checkDatabases();
  checkLibrary();
  checkBuild();
  console.log("\nIf the app was already running, restart it after changes:  Ctrl+C, then  npm run dev\n");
}

main();
