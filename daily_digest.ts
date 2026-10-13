/**
 * Daily action digest — NOT mass-apply.
 *
 * Reads job_leads.md and builds one email listing what needs Christopher's decision today:
 * applications that are prepared and waiting for him to submit, new leads to qualify,
 * outreach drafts to send or discard, and follow-ups that are due. It submits nothing and
 * contacts no one but Christopher himself. Per agent_system_prompt.md Rule 4, submitting an
 * application stays a human action — this only queues the work up for review.
 *
 * Usage:
 *   bun run daily_digest.ts             # build the digest and email it to REPORT_EMAIL
 *   bun run daily_digest.ts --dry-run   # print the digest, send nothing
 *   bun run daily_digest.ts --limit 5   # cap each section (default 10)
 */

import nodemailer from "nodemailer";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { extractSection } from "./profile_sections";

export interface Lead {
  source: string;
  role: string;
  company: string;
  location: string;
  link: string;
  matchReason: string;
  notes: string;
  status: string;
}

export interface StepResult {
  name: string;
  ok: boolean;
  tail: string;
}

export interface DigestOptions {
  today: string; // YYYY-MM-DD
  targetRoles: string[];
  hasCoverLetter: (filename: string) => boolean;
  limit?: number;
  steps?: StepResult[];
}

export interface Digest {
  subject: string;
  text: string;
  counts: { apply: number; review: number; outreach: number; followUp: number; stale: number; offProfile: number };
}

// Same row rules as draft_cover_letters.ts: 8 cells, skip header and separator.
export function parseLeads(md: string): Lead[] {
  const leads: Lead[] = [];
  for (const line of md.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length < 8) continue;
    if (cells[0] === "Source") continue;
    if (/^-+$/.test(cells[0])) continue;
    const [source, role, company, location, link, matchReason, notes, status] = cells;
    leads.push({ source, role, company, location, link, matchReason, notes, status });
  }
  return leads;
}

// Must match draft_cover_letters.ts so the digest finds the files that script writes.
export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function coverLetterFilename(lead: Lead): string {
  return `${slugify(lead.company)}-${slugify(lead.role)}.md`;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

// Latest "<label> YYYY-MM-DD" in Notes, e.g. "Applied 2026-07-20".
function lastDated(notes: string, label: string): string | null {
  const all = [...notes.matchAll(new RegExp(`${label}\\s+(\\d{4}-\\d{2}-\\d{2})`, "gi"))];
  return all.length ? all[all.length - 1][1] : null;
}

function matchesTargetRole(lead: Lead, targetRoles: string[]): boolean {
  const role = lead.role.toLowerCase();
  return targetRoles.some(t => role.includes(t.toLowerCase()));
}

function line(lead: Lead): string {
  return `${lead.company} | ${lead.role} | ${lead.location}`;
}

export function buildDigest(leads: Lead[], opts: DigestOptions): Digest {
  const limit = opts.limit ?? 10;
  const open = (l: Lead) => ["new", "researching", "ready"].includes(l.status.toLowerCase());
  const onProfile = (l: Lead) => matchesTargetRole(l, opts.targetRoles);
  const is = (l: Lead, s: string) => l.status.toLowerCase() === s;

  const apply = leads.filter(l => is(l, "ready") && onProfile(l));
  const review = leads.filter(l => (is(l, "new") || is(l, "researching")) && onProfile(l));
  const outreach = leads.filter(l => open(l) && onProfile(l) && /outreach drafted[^|]*\(not sent\)/i.test(l.notes));
  const offProfile = leads.filter(l => open(l) && !onProfile(l));
  const applied = leads.filter(l => is(l, "applied")).map(l => {
    const date = lastDated(l.notes, "Applied");
    return { lead: l, date, age: date ? daysBetween(date, opts.today) : null };
  });
  const followUp = applied.filter(a => a.age !== null && a.age >= 7 && a.age <= 14 && !/follow-up drafted/i.test(a.lead.notes));
  const stale = applied.filter(a => a.age !== null && a.age >= 21);

  const out: string[] = [];
  const section = (title: string, items: string[], total: number, empty: string) => {
    out.push("", `${title} (${total})`, "-".repeat(title.length + String(total).length + 3));
    if (total === 0) { out.push(`  ${empty}`); return; }
    out.push(...items.slice(0, limit));
    if (total > limit) out.push(`  ... and ${total - limit} more in job_leads.md`);
  };

  out.push(`Job Hunt Agent: actions for ${opts.today}`);
  out.push("Nothing below has been submitted or sent. Each item waits for your decision.");

  const failed = (opts.steps ?? []).filter(s => !s.ok);
  if (failed.length) {
    out.push("", `PROBLEMS IN TODAY'S RUN (${failed.length})`, "-----------------------------");
    for (const s of failed) out.push(`  ${s.name} failed:`, ...s.tail.split("\n").map(t => `    ${t}`));
  }

  section("1. APPLY: prepared, waiting for you to submit", apply.map(l => {
    const file = coverLetterFilename(l);
    const letter = opts.hasCoverLetter(file) ? `cover_letters/${file}` : "no cover letter yet";
    return `  [ ] ${line(l)}\n      Posting: ${l.link}\n      Cover letter: ${letter}`;
  }), apply.length, "No leads are Ready.");

  section("2. REVIEW: new leads to qualify or skip", review.map(l => {
    const found = lastDated(l.notes, "Found");
    return `  [ ] ${line(l)}${found ? ` (found ${found})` : ""}\n      Why: ${l.matchReason}\n      Posting: ${l.link}`;
  }), review.length, "No new leads.");

  section("3. OUTREACH: drafts to send or discard", outreach.map(l => {
    const file = l.notes.match(/outreach\/[\w.-]+\.md/)?.[0] ?? "see outreach/";
    return `  [ ] ${line(l)}\n      Draft: ${file}`;
  }), outreach.length, "No unsent outreach drafts.");

  section("4. FOLLOW UP: applied 7 to 14 days ago, no reply recorded", followUp.map(a =>
    `  [ ] ${line(a.lead)} (applied ${a.date}, ${a.age} days ago)`
  ), followUp.length, "No follow-ups due.");

  section("5. STALE: applied 21 or more days ago", stale.map(a =>
    `  [ ] ${line(a.lead)} (applied ${a.date}, ${a.age} days ago)`
  ), stale.length, "Nothing stale.");

  if (offProfile.length) {
    out.push("", `NOTE: ${offProfile.length} open lead(s) no longer match Target Roles (${opts.targetRoles.join(", ")}) and are left out above.`);
  }

  out.push("", "To act: open the project in Claude Code and say which items to advance, or submit",
    "applications yourself and report them at the next weekly run (workflow step 10).");

  const counts = {
    apply: apply.length, review: review.length, outreach: outreach.length,
    followUp: followUp.length, stale: stale.length, offProfile: offProfile.length,
  };
  const total = counts.apply + counts.review + counts.outreach + counts.followUp + counts.stale;
  const subject = `Job hunt: ${total} action${total === 1 ? "" : "s"} to review, ${opts.today}` + (failed.length ? " (run had problems)" : "");
  return { subject, text: out.join("\n"), counts };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const REPORT_EMAIL = "pmchrislee@gmail.com";

// Explicitly load .env from the project directory regardless of cwd (same as scrape_jobs.ts).
export function loadEnv() {
  const envPath = join(import.meta.dir, ".env");
  if (!existsSync(envPath)) return;
  for (const l of readFileSync(envPath, "utf-8").split("\n")) {
    const [key, ...rest] = l.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
}

// Local calendar date, so a run at 8am Eastern is not stamped with tomorrow's UTC date.
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function runDigest(args: { dryRun: boolean; limit?: number; steps?: StepResult[] }): Promise<Digest> {
  loadEnv();
  const dir = import.meta.dir;
  const leads = parseLeads(readFileSync(join(dir, "job_leads.md"), "utf-8"));
  const targetRoles = extractSection(readFileSync(join(dir, "job_search_profile.md"), "utf-8"), "Target Roles");
  const digest = buildDigest(leads, {
    today: localToday(),
    targetRoles,
    hasCoverLetter: f => existsSync(join(dir, "cover_letters", f)),
    limit: args.limit,
    steps: args.steps,
  });

  console.log(`Subject: ${digest.subject}\n\n${digest.text}`);

  if (args.dryRun) {
    console.log("\n(dry run: email not sent)");
    return digest;
  }
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!pass) {
    console.warn("\nEmail not sent: set GMAIL_APP_PASSWORD in .env to enable the daily digest.");
    return digest;
  }
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: REPORT_EMAIL, pass } });
  await transporter.sendMail({ from: REPORT_EMAIL, to: REPORT_EMAIL, subject: digest.subject, text: digest.text });
  console.log(`\n✓ Digest emailed to ${REPORT_EMAIL}`);
  return digest;
}

if (import.meta.main) {
  const argv = process.argv;
  const i = argv.indexOf("--limit");
  runDigest({
    dryRun: argv.includes("--dry-run"),
    limit: i !== -1 ? parseInt(argv[i + 1], 10) || undefined : undefined,
  }).catch(e => { console.error(e); process.exit(1); });
}
