/**
 * Batch cover letter drafting — NOT mass-apply.
 *
 * This drafts a cover letter for every qualifying lead in job_leads.md at once, so you
 * can review and submit each application yourself. It never submits anything, never
 * touches job_leads.md's OutreachStatus, and never invents experience beyond resume.md.
 * Per agent_system_prompt.md Rule 4, submitting is a human action — this only prepares
 * the material for it.
 *
 * Usage:
 *   bun run draft_cover_letters.ts            # draft up to MAX_PER_RUN qualifying leads
 *   bun run draft_cover_letters.ts --limit 5   # override the per-run cap
 *   bun run draft_cover_letters.ts --dry-run   # show what would be drafted, write nothing
 */

import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// ── Env loading (same approach as scrape_jobs.ts) ───────────────────────────────
const envPath = join(import.meta.dir, ".env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Files ────────────────────────────────────────────────────────────────────────
const LEADS_FILE          = join(import.meta.dir, "job_leads.md");
const PROFILE_FILE        = join(import.meta.dir, "job_search_profile.md");
const RESUME_FILE         = join(import.meta.dir, "resume.md");
const SYSTEM_PROMPT_FILE  = join(import.meta.dir, "agent_system_prompt.md");
const COVER_LETTER_PROMPT_FILE = join(import.meta.dir, "cover_letter_prompt.md");
const COVER_LETTERS_DIR   = join(import.meta.dir, "cover_letters");

function readFileOrThrow(path: string, label: string): string {
  if (!existsSync(path)) throw new Error(`${label} not found at ${path}`);
  return readFileSync(path, "utf-8");
}

const LEADS_MD          = readFileOrThrow(LEADS_FILE, "job_leads.md");
const PROFILE_MD        = readFileOrThrow(PROFILE_FILE, "job_search_profile.md");
const RESUME_MD         = readFileOrThrow(RESUME_FILE, "resume.md");
const SYSTEM_PROMPT_MD  = existsSync(SYSTEM_PROMPT_FILE) ? readFileSync(SYSTEM_PROMPT_FILE, "utf-8") : "";
const COVER_LETTER_PROMPT_MD = existsSync(COVER_LETTER_PROMPT_FILE)
  ? readFileSync(COVER_LETTER_PROMPT_FILE, "utf-8")
  : "";

// ── Args ─────────────────────────────────────────────────────────────────────────
const argv = process.argv;
const limitIdx = argv.indexOf("--limit");
const MAX_PER_RUN = limitIdx !== -1 ? (parseInt(argv[limitIdx + 1], 10) || 10) : 10;
const DRY_RUN = argv.includes("--dry-run");

// ── Cost tracking (same rates as scrape_jobs.ts) ────────────────────────────────
const COST = { claude_input_per_tok: 3 / 1_000_000, claude_output_per_tok: 15 / 1_000_000 };
let totalInputTok = 0, totalOutputTok = 0;

// ── Parse job_leads.md rows ──────────────────────────────────────────────────────

interface LeadRow {
  source: string;
  role: string;
  company: string;
  location: string;
  link: string;
  matchReason: string;
  notes: string;
  status: string;
}

function parseLeadRows(md: string): LeadRow[] {
  const rows: LeadRow[] = [];
  for (const line of md.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length < 8) continue;
    if (cells[0] === "Source") continue; // header row
    if (/^-+$/.test(cells[0])) continue; // separator row
    const [source, role, company, location, link, matchReason, notes, status] = cells;
    rows.push({ source, role, company, location, link, matchReason, notes, status });
  }
  return rows;
}

// Pull the comp floor out of "## Compensation" (e.g. "$200,000+ base salary")
const compMatch = PROFILE_MD.match(/##\s*Compensation\s*\n[-\s]*\$?([\d,]+)/i);
const MIN_COMP = compMatch ? parseInt(compMatch[1].replace(/,/g, ""), 10) : 200_000;

function qualifies(row: LeadRow): { ok: boolean; reason?: string } {
  const status = row.status.toLowerCase();
  if (status !== "new" && status !== "researching") {
    return { ok: false, reason: `status is "${row.status}", not New/Researching` };
  }
  // Defense in depth: job_leads.md's own research (Notes) sometimes already flags a comp
  // shortfall on a row that hasn't been re-triaged to Skip yet. Don't draft for those.
  if (/below the \$[\d,]+.*floor|likely below.*floor/i.test(row.notes)) {
    return { ok: false, reason: "Notes indicate comp likely below the floor — not re-triaged to Skip yet" };
  }
  return { ok: true };
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ── Main ────────────────────────────────────────────────────────────────────────

async function draftCoverLetter(row: LeadRow): Promise<{ subject: string; body: string } | null> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    messages: [
      {
        role: "user",
        content: `${SYSTEM_PROMPT_MD}

${COVER_LETTER_PROMPT_MD}

Use this job lead as the role to write for. Note: this is what's known from job_leads.md
(MatchReason/Notes), NOT a full job description — the letter should stay general enough to
not contradict a fuller JD you haven't seen, while still being specific to this company/role:

Company: ${row.company}
Role: ${row.role}
Location: ${row.location}
Source: ${row.source}
MatchReason: ${row.matchReason}
Notes: ${row.notes}

Current job_search_profile.md (for tone/context — Search Urgency, discretion constraints):
${PROFILE_MD}

Current resume.md — the ONLY source for claims about his real experience. Never invent or
embellish an accomplishment, metric, or title that isn't here:
${RESUME_MD}

Additional house style rule: never use em dashes anywhere in the letter.

Respond in exactly this format, nothing else:
SUBJECT: <short subject/filename-friendly description, e.g. "Cover Letter — Senior Software Engineer">
BODY:
<the cover letter, plain text>`,
      },
    ],
  });

  totalInputTok += response.usage.input_tokens;
  totalOutputTok += response.usage.output_tokens;

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  const subject = text.match(/^SUBJECT:\s*(.+)$/m)?.[1]?.trim();
  const body    = text.match(/^BODY:\s*\n([\s\S]*)$/m)?.[1]?.trim();
  if (!subject || !body) {
    console.warn(`  ! Response didn't match expected format for ${row.company} — skipping:\n${text}`);
    return null;
  }
  return { subject, body };
}

async function main() {
  const rows = parseLeadRows(LEADS_MD);
  console.log(`Parsed ${rows.length} rows from job_leads.md.\n`);

  if (!existsSync(COVER_LETTERS_DIR)) mkdirSync(COVER_LETTERS_DIR, { recursive: true });

  let drafted = 0, skippedExisting = 0, skippedDisqualified = 0;

  for (const row of rows) {
    if (drafted >= MAX_PER_RUN) {
      console.log(`\nReached per-run cap (${MAX_PER_RUN}). Run again to continue with the rest.`);
      break;
    }

    const check = qualifies(row);
    if (!check.ok) {
      skippedDisqualified++;
      continue;
    }

    const filename = `${slugify(row.company)}-${slugify(row.role)}.md`;
    const filepath = join(COVER_LETTERS_DIR, filename);
    if (existsSync(filepath)) {
      skippedExisting++;
      continue;
    }

    console.log(`Drafting: ${row.role} — ${row.company}...`);
    if (DRY_RUN) {
      console.log(`  (dry run — would write cover_letters/${filename})`);
      drafted++;
      continue;
    }

    const draft = await draftCoverLetter(row);
    if (!draft) continue;

    writeFileSync(filepath, `**${draft.subject}**\n**Company:** ${row.company}\n**Role:** ${row.role}\n\n${draft.body}\n`);
    console.log(`  ✓ cover_letters/${filename}`);
    drafted++;
  }

  const cost = totalInputTok * COST.claude_input_per_tok + totalOutputTok * COST.claude_output_per_tok;
  console.log(`
Summary
=======
Drafted this run:        ${drafted}${DRY_RUN ? " (dry run — nothing written)" : ""}
Skipped (already drafted): ${skippedExisting}
Skipped (not qualifying): ${skippedDisqualified}
Claude tokens:            ${totalInputTok.toLocaleString()} in / ${totalOutputTok.toLocaleString()} out
Estimated cost:           $${cost.toFixed(4)}

Nothing was submitted anywhere. Review each draft in cover_letters/ and apply yourself
when you're ready — this only prepares the material.`);
}

main().catch(console.error);
