// Companies to watch directly via their ATS.
// Add or remove entries as your target list evolves.
// Verify slugs at: https://boards.greenhouse.io/{slug} or https://jobs.lever.co/{slug}

export interface TargetCompany {
  name: string;
  ats: "greenhouse" | "lever";
  slug: string;
}

export const TARGET_COMPANIES: TargetCompany[] = [
  // Greenhouse
  { name: "Anthropic",     ats: "greenhouse", slug: "anthropic"       },
  { name: "Perplexity AI", ats: "greenhouse", slug: "perplexityai"    },
  { name: "Glean",         ats: "greenhouse", slug: "glean"           },
  { name: "Cohere",        ats: "greenhouse", slug: "cohere"          },
  { name: "Weights & Biases", ats: "greenhouse", slug: "wandb"        },
  { name: "Runway",        ats: "greenhouse", slug: "runwayml"        },
  { name: "Notion",        ats: "greenhouse", slug: "notion"          },
  { name: "Figma",         ats: "greenhouse", slug: "figma"           },

  // Lever
  { name: "Scale AI",      ats: "lever",      slug: "scaleai"         },
  { name: "Hugging Face",  ats: "lever",      slug: "huggingface"     },
  { name: "Harvey",        ats: "lever",      slug: "harvey"          },
  { name: "Mistral",       ats: "lever",      slug: "mistral"         },
];
