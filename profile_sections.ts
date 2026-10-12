// Side-effect-free markdown helpers for job_search_profile.md, kept separate from
// scrape_jobs.ts (which reads files and calls APIs at import) so they can be tested.

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Returns the bullet items under a `## heading`, up to the next `## ` heading or end of file.
export function extractSection(md: string, heading: string): string[] {
  // JS has no \Z anchor (it matches a literal "Z"), so end-of-input is `$(?![\s\S])`.
  const re = new RegExp(`^##\\s*${escapeRegExp(heading)}\\s*$([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, "mi");
  const match = md.match(re);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map(l => l.replace(/^-\s*/, "").trim())
    .filter(Boolean);
}
