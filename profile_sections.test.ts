import { describe, it, expect } from "bun:test";
import { extractSection } from "./profile_sections";

const PROFILE = `# Job Search Profile

## Target Roles
- Product Manager
- Senior Product Manager

## Target Locations
- SF Bay Area (SF, South Bay, Peninsula, East Bay)
- Remote
`;

describe("extractSection", () => {
  it("returns the bullets of a section followed by another heading", () => {
    expect(extractSection(PROFILE, "Target Roles")).toEqual([
      "Product Manager",
      "Senior Product Manager",
    ]);
  });

  it("returns the bullets of the last section in the file", () => {
    expect(extractSection(PROFILE, "Target Locations")).toEqual([
      "SF Bay Area (SF, South Bay, Peninsula, East Bay)",
      "Remote",
    ]);
  });

  it("returns the last section when the file has no trailing newline", () => {
    expect(extractSection("## Target Locations\n- Remote", "Target Locations")).toEqual(["Remote"]);
  });

  it("does not truncate at a bullet containing the letter z", () => {
    const md = `## Target Locations
- Zurich, Switzerland
- Phoenix, Arizona
- Remote

## Compensation
- $200,000+ base salary
`;
    expect(extractSection(md, "Target Locations")).toEqual([
      "Zurich, Switzerland",
      "Phoenix, Arizona",
      "Remote",
    ]);
  });

  it("does not truncate at a z in the last section", () => {
    const md = "## Target Roles\n- Product Manager, Monetization\n- Analyzer Lead\n- Staff PM\n";
    expect(extractSection(md, "Target Roles")).toEqual([
      "Product Manager, Monetization",
      "Analyzer Lead",
      "Staff PM",
    ]);
  });

  it("treats regex metacharacters in the heading literally", () => {
    const md = "## Roles (Primary)\n- PM\n\n## Roles XPrimaryX\n- Other\n";
    expect(extractSection(md, "Roles (Primary)")).toEqual(["PM"]);
    expect(extractSection(md, "Roles .Primary.")).toEqual([]);
  });

  it("returns an empty array when the heading is missing", () => {
    expect(extractSection(PROFILE, "Industries")).toEqual([]);
  });
});
