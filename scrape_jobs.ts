import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { TARGET_COMPANIES } from "./target_companies";

const client = new Anthropic();

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY;

if (!SERPAPI_KEY && !SEARCHAPI_KEY) {
  throw new Error("No search API key found — set SERPAPI_KEY or SEARCHAPI_KEY in .env");
}

const PROFILE = {
  roles: ["Senior Software Engineer"],
  locations: ["San Francisco Bay Area", "New York City, NY"],
  industry: "high tech",
  minComp: 200000,
  keywords: ["engineer", "software", "AI", "ML", "platform", "backend", "fullstack"],
};

// Max leads Claude will return per run. Override with: bun run scrape_jobs.ts --limit 10
const DEFAULT_LIMIT = 10;
const argLimit = process.argv.indexOf("--limit");
const MAX_LEADS = argLimit !== -1 ? parseInt(process.argv[argLimit + 1], 10) || DEFAULT_LIMIT : DEFAULT_LIMIT;

const LEADS_FILE = join(import.meta.dir, "job_leads.md");

const TABLE_HEADER = `| Source | Role | Company | Location | Link | MatchReason | Notes | OutreachStatus |
|--------|------|---------|----------|------|-------------|-------|----------------|`;

// Normalized job shape used throughout the pipeline
interface Job {
  title: string;
  company: string;
  location: string;
  via: string;
  url: string;
  salary?: string;
  description?: string;
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
  };
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
  const data = await res.json() as { jobs_results?: SerpRawJob[] };
  return (data.jobs_results ?? []).map(normalizeSerpJob);
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
  const data = await res.json() as { jobs_results?: SerpRawJob[] };
  return (data.jobs_results ?? []).map(normalizeSerpJob);
}

async function fetchGoogleJobs(role: string, location: string): Promise<Job[]> {
  if (SERPAPI_KEY) {
    try {
      const jobs = await fetchViaSerpAPI(role, location);
      console.log(`  → ${jobs.length} results via SerpAPI`);
      return jobs;
    } catch (err) {
      console.warn(`  SerpAPI failed (${(err as Error).message}), trying SearchAPI...`);
    }
  }
  if (!SEARCHAPI_KEY) throw new Error("SerpAPI failed and SEARCHAPI_KEY not set");
  const jobs = await fetchViaSearchAPI(role, location);
  console.log(`  → ${jobs.length} results via SearchAPI`);
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
  categories: { location?: string; team?: string };
  hostedUrl: string;
  descriptionPlain?: string;
}

function matchesProfile(title: string): boolean {
  const t = title.toLowerCase();
  return PROFILE.keywords.some(k => t.includes(k.toLowerCase()));
}

async function fetchFromGreenhouse(slug: string, company: string): Promise<Job[]> {
  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`
  );
  if (!res.ok) {
    console.warn(`  Greenhouse fetch failed for ${company} (${res.status})`);
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
    }));
}

async function fetchFromLever(slug: string, company: string): Promise<Job[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!res.ok) {
    console.warn(`  Lever fetch failed for ${company} (${res.status})`);
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
    }));
}

async function fetchFromATS(): Promise<Job[]> {
  const results: Job[] = [];
  for (const co of TARGET_COMPANIES) {
    console.log(`  Checking ${co.name} (${co.ats})...`);
    const jobs = co.ats === "greenhouse"
      ? await fetchFromGreenhouse(co.slug, co.name)
      : await fetchFromLever(co.slug, co.name);
    console.log(`    → ${jobs.length} matching roles`);
    results.push(...jobs);
  }
  return results;
}

// ── Claude scoring ────────────────────────────────────────────────────────────

async function scoreAndFormat(jobs: Job[]): Promise<string> {
  if (jobs.length === 0) return "";

  const jobList = jobs.map((j, i) => {
    const salary = j.salary ?? "not listed";
    const desc = j.description ?? "";
    return `${i + 1}. ${j.title} at ${j.company} (${j.location}) via ${j.via} | url: ${j.url || "n/a"} | salary: ${salary} | description: ${desc}`;
  }).join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
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
- Notes: 2-3 sentences summarizing what the role involves, key requirements, and comp if known. Pull from the description field. Be specific, not generic.
- OutreachStatus: New

Skip any role that is clearly below $200k, requires sponsorship, or is seed/pre-Series B.
Return only the rows, no header, no fences.`,
      },
    ],
  });

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

function appendLeads(newRows: string): void {
  const existing = existsSync(LEADS_FILE) ? readFileSync(LEADS_FILE, "utf-8") : "";
  const deduped = dedupeRows(existing, newRows);

  if (!deduped.trim()) {
    console.log("No new leads to add (all duplicates or filtered out).");
    return;
  }

  if (!existing.includes("| Source |")) {
    writeFileSync(LEADS_FILE, `# Job Leads\n\n${TABLE_HEADER}\n${deduped}\n`);
  } else {
    const updated = existing.replace(/(^\|[-| ]+\|$)/m, `$1\n${deduped}`);
    writeFileSync(LEADS_FILE, updated);
  }

  console.log(`✓ Added ${deduped.trim().split("\n").length} new leads to job_leads.md`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const allJobs: Job[] = [];

  console.log("=== Google Jobs (SerpAPI / SearchAPI) ===");
  for (const role of PROFILE.roles) {
    for (const location of PROFILE.locations) {
      console.log(`Fetching: ${role} in ${location}...`);
      const jobs = await fetchGoogleJobs(role, location);
      allJobs.push(...jobs);
    }
  }

  console.log("\n=== Direct ATS (Greenhouse / Lever) ===");
  const atsJobs = await fetchFromATS();
  allJobs.push(...atsJobs);

  console.log(`\nTotal: ${allJobs.length} raw listings. Scoring with Claude...`);
  const rows = await scoreAndFormat(allJobs);

  if (rows) {
    console.log("\nFiltered leads:\n", rows);
    appendLeads(rows);
  } else {
    console.log("No qualifying leads found.");
  }
}

main().catch(console.error);
