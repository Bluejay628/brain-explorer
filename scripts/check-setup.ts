// Setup checker for beginners. Run with:  npm run check
// Tells you, in plain words, whether the .env file, the Claude API key and the
// research library are set up. It NEVER prints your key.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const root = process.cwd();
const ok = (msg: string) => console.log(`  ✅ ${msg}`);
const bad = (msg: string) => console.log(`  ❌ ${msg}`);
const tip = (msg: string) => console.log(`     👉 ${msg}`);

async function main() {
  console.log("\nBrain Explorer setup check\n");

  // 1) Is there a .env file in the right place?
  console.log("1. The .env file");
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(path.join(root, "package.json"))) {
    bad("You are not in the brain-explorer folder.");
    tip("In the terminal, type:  cd brain-explorer   (or open the project folder) and run npm run check again.");
    return;
  }
  if (!fs.existsSync(envPath)) {
    bad("No file named exactly .env was found in the project folder.");
    const lookalikes = fs.readdirSync(root).filter((f) => /env/i.test(f) && f !== ".env.example");
    if (lookalikes.length) tip(`Found ${lookalikes.map((f) => `"${f}"`).join(", ")} — rename it to exactly .env (nothing before or after).`);
    else tip("Copy .env.example, paste it in the same folder, and rename the copy to exactly .env");
    return;
  }
  ok("Found .env in the project folder.");

  // 2) Does it contain a key? (dotenv reads it the same way the server does)
  console.log("\n2. The Claude API key");
  await import("dotenv/config");
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    bad("ANTHROPIC_API_KEY is empty.");
    tip("Open .env, paste your key right after  ANTHROPIC_API_KEY=  (no spaces), and SAVE the file (Ctrl+S / Cmd+S).");
    const raw = fs.readFileSync(envPath, "utf8");
    if (!/^ANTHROPIC_API_KEY=/m.test(raw)) tip("The line must start exactly with ANTHROPIC_API_KEY= (no # in front, no spaces).");
    return;
  }
  if (!key.startsWith("sk-ant-")) {
    bad(`The key doesn't look right (it should start with "sk-ant-", yours starts with "${key.slice(0, 4)}…").`);
    tip("Copy the key again from console.anthropic.com → API Keys. Make sure you copied the whole thing.");
    return;
  }
  ok(`A key is set (sk-ant-…${"*".repeat(6)}, ${key.length} characters).`);

  // 3) Does the key actually work? Listing models is free.
  try {
    const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: 20_000 });
    await client.models.list({ limit: 1 });
    ok("The key works — Anthropic accepted it.");
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      bad("Anthropic rejected the key.");
      tip("The key may have been deleted or copied wrong. Create a new key at console.anthropic.com → API Keys.");
    } else if (err instanceof Anthropic.PermissionDeniedError) {
      bad("The key is valid but not allowed to make requests.");
      tip("Check Billing at console.anthropic.com — the account may need credit added.");
    } else if (err instanceof Anthropic.APIConnectionError) {
      bad("Could not reach Anthropic (internet problem).");
    } else {
      bad(`Unexpected problem checking the key: ${(err as Error).message}`);
    }
    return;
  }

  // 4) Research library
  console.log("\n3. The research library");
  try {
    const lib = JSON.parse(fs.readFileSync(path.join(root, "data", "library.json"), "utf8"));
    const n = Array.isArray(lib.records) ? lib.records.length : 0;
    if (n > 0) ok(`${n} real PubMed studies are stored.`);
    else {
      bad("The library is empty.");
      tip("Run:  npm run seed");
    }
  } catch {
    bad("No library yet.");
    tip("Run:  npm run seed   (the app can still search PubMed live, but this makes it faster)");
  }

  console.log("\n4. Last step");
  tip("If the app was already running, stop it (click the terminal, press Ctrl+C) and start it again with:  npm run dev");
  tip("Then open the site and look at Settings → Server status → AI engine.");
  console.log("");
}

main();
