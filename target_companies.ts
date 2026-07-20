// Companies to watch directly via their ATS.
// Add or remove entries as your target list evolves.
// Verify slugs at:
//   Greenhouse: https://boards.greenhouse.io/{slug}
//   Lever:      https://jobs.lever.co/{slug}
//   Ashby:      https://jobs.ashbyhq.com/{slug}

export interface TargetCompany {
  name: string;
  ats: "greenhouse" | "lever" | "ashby";
  slug: string;
}

export const TARGET_COMPANIES: TargetCompany[] = [
  // Greenhouse
  { name: "Anthropic",        ats: "greenhouse", slug: "anthropic"  },
  { name: "Figma",            ats: "greenhouse", slug: "figma"      },
  { name: "Glean",            ats: "greenhouse", slug: "gleanwork"  },
  { name: "Scale AI",         ats: "greenhouse", slug: "scaleai"    },

  // Lever
  { name: "Mistral",          ats: "lever",      slug: "mistral"    },

  // Ashby
  { name: "Cohere",           ats: "ashby",      slug: "cohere"     },
  { name: "Perplexity AI",    ats: "ashby",      slug: "perplexity" },
  { name: "Harvey",           ats: "ashby",      slug: "harvey"     },
  { name: "Runway",           ats: "ashby",      slug: "runway"     },
  { name: "Notion",           ats: "ashby",      slug: "notion"     },
];
