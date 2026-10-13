/**
 * Resume review — suggestions only.
 *
 * Compares resume.md against the open leads that match Target Roles and writes a short list
 * of suggested resume changes to resume_suggestions.md, which the daily digest includes.
 * It never edits resume.md and never invents experience: where a suggestion depends on a
 * fact that is not on the resume, it says what Christopher needs to supply.
 *
 * Skips the Claude call when neither the resume nor the set of open leads has changed since
 * the last review, so a daily schedule does not pay for the same answer twice.
 *
 * Usage:
 *   bun run resume_review.ts           # review if inputs changed
 *   bun run resume_review.ts --force   # review even if nothing changed
 */

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { parseLeads, loadEnv, type Lead } from "./daily_digest";
import { extractSection } from "./profile_sections";

export const SUGGESTIONS_FILE = "resume_suggestions.md";
const MAX_SUGGESTIONS = 6;

export function openOnProfileLeads(leads: Lead[], targetRoles: string[]): Lead[] {
  return leads.filter(l =>
    ["new", "researching", "ready"].includes(l.status.toLowerCase()) &&
    targetRoles.some(t => l.role.toLowerCase().includes(t.toLowerCase()))
  );
}

// Changes when the resume text or the set of reviewed leads changes; notes edits alone
// (dates, statuses) do not trigger a new review.
export function inputsHash(resume: string, leads: Lead[]): string {
  const keys = leads.map(l => `${l.company}|${l.role}`).sort().join("\n");
  return createHash("sha256").update(resume).update("\n--\n").update(keys).digest("hex").slice(0, 16);
}

export function storedHash(fileText: string): string | null {
  return fileText.match(/^<!-- inputs: ([0-9a-f]+) -->/m)?.[1] ?? null;
}

// The numbered suggestions from resume_suggestions.md, one string each, for the digest.
export function readSuggestions(fileText: string): string[] {
  return fileText.split("\n").filter(l => /^\d+\.\s/.test(l)).map(l => l.replace(/^\d+\.\s*/, "").trim());
}

function buildPrompt(resume: string, leads: Lead[]): string {
  const leadList = leads.map(l => `- ${l.company} | ${l.role}\n  ${l.notes}`).join("\n");
  return `You are reviewing Christopher Lee's resume against the job leads he is currently pursuing. He will read your output himself.

<resume>
${resume}
</resume>

<leads count="${leads.length}">
${leadList}
</leads>

List the ${MAX_SUGGESTIONS} resume changes that would most improve his fit across these leads, most important first.

Rules:
- Base every suggestion on what several leads ask for, and say how many of the ${leads.length} leads it applies to.
- Never propose adding experience, titles, skills, tools, or metrics that are not on the resume. If a suggestion needs a fact the resume does not contain, say exactly what he needs to supply.
- Suggest rewording, reordering, cutting, or adding a section; be specific about which line or section.
- If the resume cannot credibly support these roles in some respect, say so plainly as one of the items.
- Do not assert that a tool, product, or company named on the resume does not exist or is wrong. Your knowledge may be out of date. If you do not recognise a name, ask him to confirm the spelling.
- Address Christopher directly as "you".
- Keep each item under 60 words.
- No em dashes or double hyphens.

Output format: a numbered list only, one line per item, no preamble and no closing text:
1. <change> Why: <which leads and how many>. Needs from you: <fact to supply, or "nothing">.`;
}

async function main() {
  loadEnv();
  const dir = import.meta.dir;
  const resume = readFileSync(join(dir, "resume.md"), "utf-8");
  const targetRoles = extractSection(readFileSync(join(dir, "job_search_profile.md"), "utf-8"), "Target Roles");
  const leads = openOnProfileLeads(parseLeads(readFileSync(join(dir, "job_leads.md"), "utf-8")), targetRoles);
  const outPath = join(dir, SUGGESTIONS_FILE);

  if (leads.length === 0) {
    console.log("No open leads match Target Roles. Nothing to review the resume against.");
    return;
  }

  const hash = inputsHash(resume, leads);
  if (!process.argv.includes("--force") && existsSync(outPath) && storedHash(readFileSync(outPath, "utf-8")) === hash) {
    console.log("Resume and open leads unchanged since the last review. Keeping the existing suggestions.");
    return;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1200,
    messages: [{ role: "user", content: buildPrompt(resume, leads) }],
  });
  const text = response.content.filter(b => b.type === "text").map(b => (b as { text: string }).text).join("\n").trim();
  const items = readSuggestions(text).slice(0, MAX_SUGGESTIONS);
  if (items.length === 0) throw new Error(`Resume review returned no numbered suggestions:\n${text}`);

  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  writeFileSync(outPath,
    `# Resume Suggestions\n\n<!-- inputs: ${hash} -->\n` +
    `Reviewed ${date} against ${leads.length} open lead(s) matching: ${targetRoles.join(", ")}.\n` +
    `Suggestions only. resume.md was not changed.\n\n` +
    items.map((s, i) => `${i + 1}. ${s}`).join("\n") + "\n");
  console.log(`✓ ${items.length} suggestions written to ${SUGGESTIONS_FILE} (${response.usage.input_tokens} in / ${response.usage.output_tokens} out tokens)`);
}

if (import.meta.main) {
  main().catch(e => { console.error(e); process.exit(1); });
}
