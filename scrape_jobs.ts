import Anthropic from "@anthropic-ai/sdk";
import nodemailer from "nodemailer";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { TARGET_COMPANIES } from "./target_companies";

// Explicitly load .env from the project directory regardless of cwd
const envPath = join(import.meta.dir, ".env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
  }
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SERPAPI_KEY   = process.env.SERPAPI_KEY;
const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY;
const GMAIL_PASS    = process.env.GMAIL_APP_PASSWORD;
const REPORT_EMAIL  = "pmchrislee@gmail.com";

if (!SERPAPI_KEY && !SEARCHAPI_KEY) {
  throw new Error("No search API key found — set SERPAPI_KEY or SEARCHAPI_KEY in .env");
}

// ── Budgets & limits ──────────────────────────────────────────────────────────

const WEEKLY_QUERY_BUDGET = 4;   // max SerpAPI/SearchAPI calls per run
const MAX_RAW_TO_CLAUDE   = 30;  // cap listings sent to Claude
const MAX_LEADS           = (() => {
  const i = process.argv.indexOf("--limit");
  return i !== -1 ? parseInt(process.argv[i + 1], 10) || 10 : 10;
})();

// Only keep results from these boards; drops noise from obscure aggregators
const ALLOWED_BOARDS = ["linkedin", "greenhouse", "lever", "indeed", "glassdoor", "wellfound"];

// Approximate cost per unit (update if your plan differs)
const COST = {
  serpapi_per_query:    0.005,
  searchapi_per_query:  0.005,
  claude_input_per_tok: 3    / 1_000_000,
  claude_output_per_tok: 15  / 1_000_000,
};

// ── Profile ───────────────────────────────────────────────────────────────────

const PROFILE = {
  roles:    ["Senior Software Engineer"],
  locations: ["San Francisco Bay Area", "New York, NY"],
  industry: "high tech",
  minComp:  200_000,
  keywords: ["engineer", "software", "AI", "ML", "platform", "backend", "fullstack"],
};

// ── File paths ────────────────────────────────────────────────────────────────

const LEADS_FILE     = join(import.meta.dir, "job_leads.md");
const USAGE_LOG_FILE = join(import.meta.dir, "usage_log.json");
const SEEN_FILE      = join(import.meta.dir, "seen_jobs.json");

const TABLE_HEADER = `| Source | Role | Company | Location | Link | MatchReason | Notes | OutreachStatus |
|--------|------|---------|----------|------|-------------|-------|----------------|`;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Job {
  title: string;
  company: string;
  location: string;
  via: string;
  url: string;
  salary?: string;
  description?: string;
  source: "google_jobs" | "ats";
}

interface UsageEntry {
  date: string;
  serpapi_queries: number;
  searchapi_queries: number;
  raw_listings_fetched: number;
  raw_listings_sent_to_claude: number;
  claude_input_tokens: number;
  claude_output_tokens: number;
  estimated_cost_usd: number;
  leads_added: number;
}

// ── Seen URL cache ────────────────────────────────────────────────────────────

function loadSeenUrls(): Set<string> {
  if (!existsSync(SEEN_FILE)) return new Set();
  const data = JSON.parse(readFileSync(SEEN_FILE, "utf-8")) as string[];
  return new Set(data);
}

function saveSeenUrls(seen: Set<string>) {
  writeFileSync(SEEN_FILE, JSON.stringify([...seen], null, 2));
}

// ── Usage tracking ────────────────────────────────────────────────────────────

const usage: UsageEntry = {
  date: new Date().toISOString(),
  serpapi_queries: 0,
  searchapi_queries: 0,
  raw_listings_fetched: 0,
  raw_listings_sent_to_claude: 0,
  claude_input_tokens: 0,
  claude_output_tokens: 0,
  estimated_cost_usd: 0,
  leads_added: 0,
};

function saveUsageLog() {
  const log: UsageEntry[] = existsSync(USAGE_LOG_FILE)
    ? JSON.parse(readFileSync(USAGE_LOG_FILE, "utf-8"))
    : [];
  log.push(usage);
  writeFileSync(USAGE_LOG_FILE, JSON.stringify(log, null, 2));
}

// ── Google Jobs (SerpAPI / SearchAPI) ────────────────────────────────────────

interface SerpRawJob {
  title: string;
  company_name: string;
  location: string;
  via: string;
  job_highlights?: { title: string; items: string[] }[];
  detected_extensions?: { salary?: string };
  share_link?: string;
}

function normalizeSerpJob(j: SerpRawJob): Job {
  return {
    title: j.title,
    company: j.company_name,
    location: j.location,
    via: j.via,
    url: j.share_link ?? "",
    salary: j.detected_extensions?.salary,
    description: j.job_highlights?.flatMap(h => h.items).slice(0, 3).join("; "),
    source: "google_jobs",
  };
}

function isAllowedBoard(via: string): boolean {
  const v = via.toLowerCase();
  return ALLOWED_BOARDS.some(b => v.includes(b));
}

async function fetchViaSerpAPI(role: string, location: string): Promise<Job[]> {
  const params = new URLSearchParams({
    engine: "google_jobs",
    q: `${role} AI tech`,
    location,
    api_key: SERPAPI_KEY!,
    chips: "date_posted:week",
  });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${await res.text()}`);
  usage.serpapi_queries++;
  const data = await res.json() as { jobs_results?: SerpRawJob[] };
  return (data.jobs_results ?? []).map(normalizeSerpJob).filter(j => isAllowedBoard(j.via));
}

async function fetchViaSearchAPI(role: string, location: string): Promise<Job[]> {
  const params = new URLSearchParams({
    engine: "google_jobs",
    q: `${role} AI tech`,
    location,
    api_key: SEARCHAPI_KEY!,
    chips: "date_posted:week",
  });
  const res = await fetch(`https://www.searchapi.io/api/v1/search?${params}`);
  if (!res.ok) throw new Error(`SearchAPI ${res.status}: ${await res.text()}`);
  usage.searchapi_queries++;
  const data = await res.json() as { jobs_results?: SerpRawJob[] };
  return (data.jobs_results ?? []).map(normalizeSerpJob).filter(j => isAllowedBoard(j.via));
}

async function fetchGoogleJobs(role: string, location: string, queriesUsed: number): Promise<Job[]> {
  if (queriesUsed >= WEEKLY_QUERY_BUDGET) {
    console.warn(`  Query budget (${WEEKLY_QUERY_BUDGET}) reached — skipping ${role} in ${location}`);
    return [];
  }
  if (SERPAPI_KEY) {
    try {
      const jobs = await fetchViaSerpAPI(role, location);
      console.log(`  → ${jobs.length} results via SerpAPI (after board filter)`);
      return jobs;
    } catch (err) {
      console.warn(`  SerpAPI failed (${(err as Error).message}), trying SearchAPI...`);
    }
  }
  if (!SEARCHAPI_KEY) throw new Error("SerpAPI failed and SEARCHAPI_KEY not set");
  const jobs = await fetchViaSearchAPI(role, location);
  console.log(`  → ${jobs.length} results via SearchAPI (after board filter)`);
  return jobs;
}

// ── Direct ATS fetching ───────────────────────────────────────────────────────

interface GreenhouseRawJob {
  title: string;
  location: { name: string };
  absolute_url: string;
  content?: string;
}

interface LeverRawJob {
  text: string;
  categories: { location?: string };
  hostedUrl: string;
  descriptionPlain?: string;
}

function matchesProfile(title: string): boolean {
  const t = title.toLowerCase();
  return PROFILE.keywords.some(k => t.includes(k.toLowerCase()));
}

async function fetchFromGreenhouse(slug: string, company: string): Promise<Job[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  if (!res.ok) {
    console.warn(`  Greenhouse failed for ${company} (${res.status})`);
    return [];
  }
  const data = await res.json() as { jobs: GreenhouseRawJob[] };
  return data.jobs
    .filter(j => matchesProfile(j.title))
    .map(j => ({
      title: j.title,
      company,
      location: j.location.name,
      via: "Greenhouse",
      url: j.absolute_url,
      description: j.content?.replace(/<[^>]+>/g, "").slice(0, 600),
      source: "ats" as const,
    }));
}

async function fetchFromLever(slug: string, company: string): Promise<Job[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!res.ok) {
    console.warn(`  Lever failed for ${company} (${res.status})`);
    return [];
  }
  const data = await res.json() as LeverRawJob[];
  return data
    .filter(j => matchesProfile(j.text))
    .map(j => ({
      title: j.text,
      company,
      location: j.categories.location ?? "Unknown",
      via: "Lever",
      url: j.hostedUrl,
      description: j.descriptionPlain?.slice(0, 600),
      source: "ats" as const,
    }));
}

interface AshbyRawJob {
  id: string;
  title: string;
  locationName: string;
  descriptionHtml?: string;
}

async function fetchFromAshby(slug: string, company: string): Promise<Job[]> {
  const res = await fetch("https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operationName: "ApiJobBoardWithTeams",
      variables: { organizationHostedJobsPageName: slug },
      query: `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
        jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
          jobPostings { id title locationName descriptionHtml }
        }
      }`,
    }),
  });
  if (!res.ok) {
    console.warn(`  Ashby failed for ${company} (${res.status})`);
    return [];
  }
  const data = await res.json() as { data?: { jobBoardWithTeams?: { jobPostings: AshbyRawJob[] } } };
  const postings = data.data?.jobBoardWithTeams?.jobPostings ?? [];
  return postings
    .filter(j => matchesProfile(j.title))
    .map(j => ({
      title: j.title,
      company,
      location: j.locationName ?? "Unknown",
      via: "Ashby",
      url: `https://jobs.ashbyhq.com/${slug}/${j.id}`,
      description: j.descriptionHtml?.replace(/<[^>]+>/g, "").slice(0, 600),
      source: "ats" as const,
    }));
}

async function fetchFromATS(): Promise<Job[]> {
  const results: Job[] = [];
  for (const co of TARGET_COMPANIES) {
    console.log(`  Checking ${co.name} (${co.ats})...`);
    let jobs: Job[] = [];
    if (co.ats === "greenhouse") jobs = await fetchFromGreenhouse(co.slug, co.name);
    else if (co.ats === "lever")  jobs = await fetchFromLever(co.slug, co.name);
    else if (co.ats === "ashby")  jobs = await fetchFromAshby(co.slug, co.name);
    console.log(`    → ${jobs.length} matching roles`);
    results.push(...jobs);
  }
  return results;
}

// ── Claude scoring ────────────────────────────────────────────────────────────

async function scoreAndFormat(jobs: Job[]): Promise<string> {
  if (jobs.length === 0) return "";

  // ATS results first (zero lag, more reliable), then Google Jobs — then cap
  const seen = loadSeenUrls();
  const unseen = jobs.filter(j => !j.url || !seen.has(j.url));
  const prioritized = [
    ...unseen.filter(j => j.source === "ats"),
    ...unseen.filter(j => j.source === "google_jobs"),
  ].slice(0, MAX_RAW_TO_CLAUDE);

  usage.raw_listings_sent_to_claude = prioritized.length;

  const jobList = prioritized.map((j, i) => {
    const salary = j.salary ?? "not listed";
    const desc   = j.description ?? "";
    return `${i + 1}. ${j.title} at ${j.company} (${j.location}) via ${j.via} | url: ${j.url || "n/a"} | salary: ${salary} | description: ${desc}`;
  }).join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `You are helping filter job leads for Christopher Lee. His profile:
- Target roles: ${PROFILE.roles.join(", ")}
- Min comp: $${PROFILE.minComp.toLocaleString()} total
- Constraints: Series B or later, no visa sponsorship, full-time W-2
- Background: AI/ML product & engineering, LLMs, RAG, enterprise SaaS, fintech, healthtech

Here are real job listings from Google Jobs and direct ATS sources:
${jobList}

Select the best ${MAX_LEADS} matches (return fewer if not enough qualify). For each, return a pipe-delimited markdown table row with exactly these columns:
Source | Role | Company | Location | Link | MatchReason | Notes | OutreachStatus

Rules:
- Source: the "via" field (e.g. LinkedIn, Greenhouse, Lever)
- Role: the job title as listed
- Location: city from the listing
- Link: the url field exactly as provided, otherwise blank
- MatchReason: one short phrase (e.g. "AI infra, enterprise SaaS, strong comp signal")
- Notes: 2-3 sentences summarizing what the role involves, key requirements, and comp if known. Be specific.
- OutreachStatus: New

Skip any role that is clearly below $200k, requires sponsorship, or is seed/pre-Series B.
Return only the rows, no header, no fences. Each row MUST start and end with a pipe character: | field | field | ... |`,
      },
    ],
  });

  const inputTok  = response.usage.input_tokens;
  const outputTok = response.usage.output_tokens;
  usage.claude_input_tokens  = inputTok;
  usage.claude_output_tokens = outputTok;
  usage.estimated_cost_usd  +=
    inputTok  * COST.claude_input_per_tok +
    outputTok * COST.claude_output_per_tok +
    usage.serpapi_queries   * COST.serpapi_per_query +
    usage.searchapi_queries * COST.searchapi_per_query;

  // Mark all sent jobs as seen regardless of whether they passed Claude's filter
  for (const j of prioritized) { if (j.url) seen.add(j.url); }
  saveSeenUrls(seen);

  return response.content[0].type === "text" ? response.content[0].text.trim() : "";
}

// ── Leads file management ─────────────────────────────────────────────────────

function dedupeRows(existing: string, newRows: string): string {
  const existingCompanies = new Set(
    [...existing.matchAll(/\|\s*([^|]+?)\s*\|\s*New/g)].map(m => m[1].toLowerCase())
  );
  return newRows
    .split("\n")
    .filter(row => {
      const company = row.split("|")[3]?.trim().toLowerCase();
      return company && !existingCompanies.has(company);
    })
    .join("\n");
}

function appendLeads(newRows: string): number {
  const existing = existsSync(LEADS_FILE) ? readFileSync(LEADS_FILE, "utf-8") : "";
  const deduped  = dedupeRows(existing, newRows);

  if (!deduped.trim()) {
    console.log("No new leads to add (all duplicates or filtered out).");
    return 0;
  }

  if (!existing.includes("| Source |")) {
    writeFileSync(LEADS_FILE, `# Job Leads\n\n${TABLE_HEADER}\n${deduped}\n`);
  } else {
    const updated = existing.replace(/(^\|[-| ]+\|$)/m, `$1\n${deduped}`);
    writeFileSync(LEADS_FILE, updated);
  }

  const count = deduped.trim().split("\n").length;
  console.log(`✓ Added ${count} new leads to job_leads.md`);
  return count;
}

// ── Email report ──────────────────────────────────────────────────────────────

async function sendReport(leadsAdded: number) {
  const u = usage;
  const body = `
Job Hunt Agent — Weekly Run Report
===================================
Date:                    ${new Date(u.date).toLocaleString("en-US", { timeZone: "America/New_York" })}

LEADS
  New leads added:       ${leadsAdded}

API USAGE
  SerpAPI queries:       ${u.serpapi_queries} / ${WEEKLY_QUERY_BUDGET} budget
  SearchAPI queries:     ${u.searchapi_queries}
  Raw listings fetched:  ${u.raw_listings_fetched}
  Sent to Claude:        ${u.raw_listings_sent_to_claude} / ${MAX_RAW_TO_CLAUDE} cap

CLAUDE TOKENS
  Input tokens:          ${u.claude_input_tokens.toLocaleString()}
  Output tokens:         ${u.claude_output_tokens.toLocaleString()}

ESTIMATED COST
  This run:              $${u.estimated_cost_usd.toFixed(4)}

---
Full history: usage_log.json
`.trim();

  console.log("\n" + body);

  if (!GMAIL_PASS) {
    console.warn("\nEmail not sent — set GMAIL_APP_PASSWORD in .env to enable reports.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: REPORT_EMAIL, pass: GMAIL_PASS },
  });

  await transporter.sendMail({
    from: REPORT_EMAIL,
    to: REPORT_EMAIL,
    subject: `Job Hunt Report — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
    text: body,
  });

  console.log(`✓ Report emailed to ${REPORT_EMAIL}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const googleJobs: Job[] = [];
  let queriesUsed = 0;

  console.log("=== Google Jobs (SerpAPI / SearchAPI) ===");
  for (const role of PROFILE.roles) {
    for (const location of PROFILE.locations) {
      console.log(`Fetching: ${role} in ${location}...`);
      const jobs = await fetchGoogleJobs(role, location, queriesUsed);
      queriesUsed = usage.serpapi_queries + usage.searchapi_queries;
      googleJobs.push(...jobs);
    }
  }

  console.log("\n=== Direct ATS (Greenhouse / Lever) ===");
  const atsJobs = await fetchFromATS();

  const allJobs = [...googleJobs, ...atsJobs];
  usage.raw_listings_fetched = allJobs.length;
  console.log(`\nTotal: ${allJobs.length} raw listings (${atsJobs.length} ATS, ${googleJobs.length} Google Jobs). Scoring with Claude...`);

  const rows = await scoreAndFormat(allJobs);
  const leadsAdded = rows ? appendLeads(rows) : 0;
  usage.leads_added = leadsAdded;

  saveUsageLog();
  await sendReport(leadsAdded);
}

main().catch(console.error);
