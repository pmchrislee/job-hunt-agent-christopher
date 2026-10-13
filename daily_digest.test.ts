import { describe, it, expect } from "bun:test";
import { parseLeads, buildDigest, coverLetterFilename, type Lead } from "./daily_digest";

const HEADER = `# Job Leads

| Source | Role | Company | Location | Link | MatchReason | Notes | OutreachStatus |
|--------|------|---------|----------|------|-------------|-------|----------------|
`;

function row(role: string, company: string, notes: string, status: string): string {
  return `| Greenhouse | ${role} | ${company} | New York, NY | https://example.com/${company} | fit | ${notes} | ${status} |\n`;
}

const opts = (over = {}) => ({
  today: "2026-10-12",
  targetRoles: ["Software Engineer"],
  hasCoverLetter: () => false,
  ...over,
});

describe("parseLeads", () => {
  it("skips the header and separator rows", () => {
    const leads = parseLeads(HEADER + row("Software Engineer", "Figma", "Found 2026-10-12", "New"));
    expect(leads).toHaveLength(1);
    expect(leads[0].company).toBe("Figma");
    expect(leads[0].status).toBe("New");
  });
});

describe("buildDigest", () => {
  const leads: Lead[] = parseLeads(
    HEADER +
    row("Software Engineer, Platform", "Scale AI", "Found 2026-10-12", "New") +
    row("Senior Software Engineer", "Databricks", "Verified 2026-10-10", "Ready") +
    row("Product Manager, Growth", "Figma", "Verified 2026-08-25", "Ready") +
    row("Software Engineer, API", "Stripe", "Applied 2026-10-03", "Applied") +
    row("Software Engineer, Data", "Glean", "Applied 2026-09-01", "Applied") +
    row("Software Engineer, Tools", "Notion", "Applied 2026-10-11", "Applied") +
    row("Software Engineer, Infra", "Cohere", "no fit", "Skip")
  );

  it("sorts leads into the right sections", () => {
    const { counts } = buildDigest(leads, opts());
    expect(counts).toEqual({ apply: 1, review: 1, outreach: 0, followUp: 1, stale: 1, offProfile: 1 });
  });

  it("leaves open leads that no longer match Target Roles out of the action lists", () => {
    const { text } = buildDigest(leads, opts());
    expect(text).not.toContain("Product Manager, Growth");
    expect(text).toContain("1 open lead(s) no longer match Target Roles");
  });

  it("points at the cover letter file only when it exists", () => {
    const file = coverLetterFilename(leads[1]);
    expect(file).toBe("databricks-senior-software-engineer.md");
    expect(buildDigest(leads, opts()).text).toContain("no cover letter yet");
    expect(buildDigest(leads, opts({ hasCoverLetter: (f: string) => f === file })).text)
      .toContain(`cover_letters/${file}`);
  });

  it("lists unsent outreach drafts with their file", () => {
    const withDraft = parseLeads(HEADER + row("Software Engineer", "Anthropic",
      "Found 2026-10-12. Outreach drafted 2026-10-12: outreach/anthropic-software-engineer.md (not sent).", "New"));
    const d = buildDigest(withDraft, opts());
    expect(d.counts.outreach).toBe(1);
    expect(d.text).toContain("Draft: outreach/anthropic-software-engineer.md");
  });

  it("does not ask for a follow-up that was already drafted", () => {
    const done = parseLeads(HEADER + row("Software Engineer", "Stripe", "Applied 2026-10-03. Follow-up drafted 2026-10-11", "Applied"));
    expect(buildDigest(done, opts()).counts.followUp).toBe(0);
  });

  it("caps each section and says how many were left out", () => {
    const many = parseLeads(HEADER + [1, 2, 3].map(n => row(`Software Engineer ${n}`, `Co${n}`, "Found 2026-10-12", "New")).join(""));
    const { text } = buildDigest(many, opts({ limit: 2 }));
    expect(text).toContain("... and 1 more in job_leads.md");
    expect(text).not.toContain("Software Engineer 3");
  });

  it("reports failed run steps and flags them in the subject", () => {
    const d = buildDigest(leads, opts({ steps: [{ name: "Scrape new leads", ok: false, tail: "401 invalid x-api-key" }] }));
    expect(d.subject).toContain("(run had problems)");
    expect(d.text).toContain("Scrape new leads failed:");
    expect(d.text).toContain("401 invalid x-api-key");
  });

  it("counts actions in the subject", () => {
    expect(buildDigest(leads, opts()).subject).toBe("Job hunt: 4 actions to review, 2026-10-12");
  });
});
