/**
 * Daily run — prepares applications for review; submits nothing.
 *
 * Runs the existing one-shot scripts in order, then emails the action digest:
 *   1. scrape_jobs.ts         find new leads, append to job_leads.md
 *   2. draft_cover_letters.ts draft cover letters for qualifying leads
 *   3. daily_digest.ts        email Christopher the list of actions to review
 *
 * A failed step does not stop the run: the digest still goes out and reports the failure,
 * so a broken API key shows up in the inbox instead of in an unread log. If the Anthropic
 * key is rejected, the scrape and drafting are skipped so no search queries are wasted.
 *
 * Usage:
 *   bun run daily_run.ts             # full run
 *   bun run daily_run.ts --dry-run   # skip the scrape and drafting; print the digest only
 */

import { join } from "path";
import { runDigest, loadEnv, type StepResult } from "./daily_digest";

const DRY_RUN = process.argv.includes("--dry-run");

// scrape_jobs.ts catches its own errors and still exits 0, so the exit code alone is not
// enough: also treat an error line in the output as a failure.
const ERROR_LINE = /^\s*(error|\w*Error)\b|\b(401|403|429)\b.*(error|unauthori|invalid|limit)/im;

// Ask Anthropic whether the key works before spending search queries on a run that cannot
// score its results. Returns null when the key is accepted, otherwise the reason.
async function anthropicKeyProblem(): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "ANTHROPIC_API_KEY is not set in .env";
  try {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=1", {
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    });
    if (res.ok) return null;
    return `Anthropic rejected ANTHROPIC_API_KEY (HTTP ${res.status}). Replace it in .env.`;
  } catch (e) {
    return `Could not reach Anthropic to check the key: ${e instanceof Error ? e.message : e}`;
  }
}

function runStep(name: string, script: string): StepResult {
  console.log(`\n=== ${name} ===`);
  // process.execPath, not "bun": launchd and cron run with a minimal PATH that lacks ~/.bun/bin.
  const proc = Bun.spawnSync([process.execPath, "run", join(import.meta.dir, script)], { cwd: import.meta.dir });
  const output = `${proc.stdout.toString()}\n${proc.stderr.toString()}`.trim();
  console.log(output);
  const ok = proc.exitCode === 0 && !ERROR_LINE.test(output);
  return { name, ok, tail: output.split("\n").slice(-6).join("\n") };
}

console.log(`Daily run started ${new Date().toString()}`);
loadEnv();

const steps: StepResult[] = [];
if (!DRY_RUN) {
  const problem = await anthropicKeyProblem();
  if (problem) {
    console.log(`\n=== Key check ===\n${problem}\nSkipping the scrape and cover letter drafting.`);
    steps.push({ name: "Key check (scrape and drafting skipped)", ok: false, tail: problem });
  } else {
    steps.push(runStep("Scrape new leads", "scrape_jobs.ts"));
    steps.push(runStep("Draft cover letters", "draft_cover_letters.ts"));
  }
}

console.log("\n=== Daily digest ===");
await runDigest({ dryRun: DRY_RUN, steps });
