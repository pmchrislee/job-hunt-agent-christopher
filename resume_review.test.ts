import { describe, it, expect } from "bun:test";
import { openOnProfileLeads, inputsHash, storedHash, readSuggestions } from "./resume_review";
import type { Lead } from "./daily_digest";

const lead = (role: string, company: string, status: string, notes = ""): Lead =>
  ({ source: "Greenhouse", role, company, location: "New York, NY", link: "", matchReason: "", notes, status });

describe("openOnProfileLeads", () => {
  it("keeps open leads that match Target Roles and drops the rest", () => {
    const kept = openOnProfileLeads([
      lead("Software Engineer, API", "Stripe", "New"),
      lead("Senior Software Engineer", "Glean", "Ready"),
      lead("Product Manager", "Figma", "Ready"),
      lead("Software Engineer", "Cohere", "Skip"),
      lead("Software Engineer", "Notion", "Applied"),
    ], ["Software Engineer"]);
    expect(kept.map(l => l.company)).toEqual(["Stripe", "Glean"]);
  });
});

describe("inputsHash", () => {
  const a = [lead("Software Engineer", "Stripe", "New"), lead("Software Engineer", "Glean", "New")];

  it("ignores lead order, notes, and status", () => {
    const b = [lead("Software Engineer", "Glean", "Ready", "Verified 2026-10-12"), lead("Software Engineer", "Stripe", "New")];
    expect(inputsHash("resume", a)).toBe(inputsHash("resume", b));
  });

  it("changes when the resume or the set of leads changes", () => {
    expect(inputsHash("resume v2", a)).not.toBe(inputsHash("resume", a));
    expect(inputsHash("resume", a.slice(0, 1))).not.toBe(inputsHash("resume", a));
  });
});

describe("suggestions file", () => {
  const file = `# Resume Suggestions\n\n<!-- inputs: 0123456789abcdef -->\nReviewed 2026-10-12.\n\n1. Add a Projects section. Why: 5 of 7 leads.\n2. List languages. Needs from you: the languages.\n`;

  it("reads back the stored inputs hash", () => {
    expect(storedHash(file)).toBe("0123456789abcdef");
    expect(storedHash("# Resume Suggestions\n")).toBeNull();
  });

  it("reads the numbered suggestions without their numbers", () => {
    expect(readSuggestions(file)).toEqual([
      "Add a Projects section. Why: 5 of 7 leads.",
      "List languages. Needs from you: the languages.",
    ]);
  });
});
