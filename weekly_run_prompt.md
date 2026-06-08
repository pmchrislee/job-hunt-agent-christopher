# Weekly Run Prompt

Copy and paste the block below at the start of each Monday session.

---

It's my weekly job hunt session. Let's go through this in order:

1. **Profile check** — Open `job_search_profile.md` and read it back to me. Ask if anything needs updating before we proceed. Wait for my confirmation before moving on.

2. **Run the workflow** — Follow every step in `weekly_job_hunt_workflow.md` in order. For any step that requires my input (applications submitted, follow-up approvals), pause and ask me before continuing.

3. **Scrape new leads** — Run `bun run scrape_jobs.ts` and append any qualifying leads to `job_leads.md`. Show me what was added.

4. **Draft one outreach email** — Identify the strongest new lead in `job_leads.md`. Draft a short outreach email under 200 words in my voice (direct, no em dashes, clear ask for a 20-minute call). Base it on `resume.md` and `job_search_profile.md`. Show me the draft before saving anything.

When the session is done, print the weekly summary from Step 7 of the workflow.
