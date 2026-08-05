/**
 * Product taxonomy and relatedness layer.
 *
 * The previous matcher compared brand and creator categories with exact string
 * equality (`slugify(a) === slugify(b)`), so PostHog and Mixpanel were unrelated,
 * Railway and Vercel were unrelated, and genuinely strong matches scored zero while
 * keyword coincidences scored high.
 *
 * This module gives the system a structural understanding of product families: which
 * products compete, which are adjacent, and which audiences actually buy them. It is
 * deterministic and inspectable (no embedding service required, no API cost, no
 * hallucination risk) — an embedding provider can later be layered on top of the same
 * `relatednessScore` interface without changing any caller.
 */

export interface ProductFamily {
  key: string;
  label: string;
  /** Known members — matched against brand name and domain label. */
  members: string[];
  /** Audience categories (from the creator taxonomy) that plausibly buy this. */
  buyerAudiences: string[];
  /** Families whose buyers substantially overlap with this one. */
  adjacentFamilies?: string[];
  /** Words that indicate this family when the specific brand isn't in `members`. */
  categoryTerms: string[];
}

export const PRODUCT_FAMILIES: ProductFamily[] = [
  {
    key: "product_analytics",
    label: "Product analytics",
    members: ["posthog", "mixpanel", "amplitude", "plausible", "heap", "fathom", "matomo", "june", "pendo"],
    buyerAudiences: ["saas_founders", "technical_founders", "software_engineers", "data", "marketers"],
    adjacentFamilies: ["error_monitoring", "data_stack"],
    categoryTerms: ["product analytics", "user analytics", "web analytics", "event tracking"],
  },
  {
    key: "hosting_deployment",
    label: "Hosting & deployment",
    members: ["railway", "render", "fly.io", "fly", "digitalocean", "vercel", "netlify", "heroku", "koyeb", "cloudflare pages", "coolify"],
    buyerAudiences: ["software_engineers", "technical_founders", "devops", "cloud", "no_code"],
    adjacentFamilies: ["cloud_infra", "devtools"],
    categoryTerms: ["hosting", "deploy", "deployment", "paas", "serverless hosting"],
  },
  {
    key: "cloud_infra",
    label: "Cloud infrastructure",
    members: ["aws", "amazon web services", "azure", "google cloud", "gcp", "linode", "hetzner", "oracle cloud"],
    buyerAudiences: ["devops", "cloud", "software_engineers", "enterprise_it"],
    adjacentFamilies: ["hosting_deployment", "devops_tooling"],
    categoryTerms: ["cloud provider", "cloud infrastructure", "virtual machine", "iaas"],
  },
  {
    key: "ai_assistants",
    label: "AI assistants",
    members: ["chatgpt", "claude", "gemini", "copilot", "perplexity", "grok", "mistral", "deepseek"],
    buyerAudiences: ["ai_developers", "productivity", "software_engineers", "students", "marketers", "business_owners"],
    adjacentFamilies: ["ai_coding", "ai_infra"],
    categoryTerms: ["ai assistant", "chatbot", "language model", "ai chat"],
  },
  {
    key: "ai_coding",
    label: "AI coding tools",
    members: ["cursor", "github copilot", "codeium", "windsurf", "tabnine", "replit", "coderabbit", "greptile", "sourcegraph", "cody", "bolt.new", "lovable", "v0"],
    buyerAudiences: ["software_engineers", "ai_developers", "technical_founders", "students"],
    adjacentFamilies: ["ai_assistants", "devtools"],
    categoryTerms: ["ai coding", "code completion", "ai pair programming", "code review ai", "ai ide"],
  },
  {
    key: "ai_infra",
    label: "AI infrastructure & APIs",
    members: ["openai", "anthropic", "huggingface", "hugging face", "replicate", "together ai", "modal", "langchain", "llamaindex", "pinecone", "weaviate", "chroma", "qdrant"],
    buyerAudiences: ["ai_developers", "software_engineers", "data", "technical_founders"],
    adjacentFamilies: ["ai_assistants", "data_stack"],
    categoryTerms: ["llm api", "vector database", "model hosting", "inference api", "rag"],
  },
  {
    key: "automation",
    label: "Automation & workflow",
    members: ["zapier", "make", "make.com", "n8n", "activepieces", "pipedream", "windmill", "ifttt"],
    buyerAudiences: ["ai_automation", "no_code", "business_owners", "marketers", "productivity"],
    adjacentFamilies: ["no_code_builders", "ai_assistants"],
    categoryTerms: ["automation", "workflow automation", "integration platform"],
  },
  {
    key: "no_code_builders",
    label: "No-code builders",
    members: ["bubble", "webflow", "framer", "softr", "glide", "adalo", "airtable", "retool"],
    buyerAudiences: ["no_code", "business_owners", "technical_founders", "marketers"],
    adjacentFamilies: ["automation", "hosting_deployment"],
    categoryTerms: ["no code", "app builder", "website builder", "internal tools"],
  },
  {
    key: "devtools",
    label: "Developer tools",
    members: ["github", "gitlab", "jetbrains", "warp", "postman", "insomnia", "linear", "raycast", "docker"],
    buyerAudiences: ["software_engineers", "devops", "technical_founders", "open_source"],
    adjacentFamilies: ["ai_coding", "devops_tooling"],
    categoryTerms: ["developer tool", "ide", "terminal", "api client", "version control"],
  },
  {
    key: "devops_tooling",
    label: "DevOps & observability",
    members: ["datadog", "grafana", "new relic", "sentry", "honeycomb", "pagerduty", "terraform", "hashicorp", "circleci", "jenkins"],
    buyerAudiences: ["devops", "cloud", "software_engineers", "enterprise_it"],
    adjacentFamilies: ["cloud_infra", "error_monitoring"],
    categoryTerms: ["observability", "monitoring", "ci/cd", "infrastructure as code", "incident"],
  },
  {
    key: "error_monitoring",
    label: "Error monitoring",
    members: ["sentry", "bugsnag", "rollbar", "raygun", "logrocket"],
    buyerAudiences: ["software_engineers", "devops", "saas_founders"],
    adjacentFamilies: ["devops_tooling", "product_analytics"],
    categoryTerms: ["error tracking", "crash reporting", "exception monitoring"],
  },
  {
    key: "data_stack",
    label: "Data & warehousing",
    members: ["snowflake", "databricks", "bigquery", "dbt", "fivetran", "airbyte", "clickhouse", "supabase", "planetscale", "neon", "mongodb"],
    buyerAudiences: ["data", "software_engineers", "technical_founders", "devops"],
    adjacentFamilies: ["product_analytics", "ai_infra"],
    categoryTerms: ["data warehouse", "database", "etl", "data pipeline"],
  },
  {
    key: "security",
    label: "Security",
    members: ["1password", "bitwarden", "nordvpn", "expressvpn", "surfshark", "proton", "snyk", "cloudflare", "okta", "auth0", "clerk"],
    buyerAudiences: ["cybersecurity", "enterprise_it", "software_engineers", "self_hosting"],
    adjacentFamilies: ["devtools"],
    categoryTerms: ["vpn", "password manager", "authentication", "security scanning"],
  },
  {
    key: "productivity_tools",
    label: "Productivity & notes",
    members: ["notion", "obsidian", "evernote", "todoist", "asana", "monday", "clickup", "slack", "coda", "mem"],
    buyerAudiences: ["productivity", "business_owners", "students", "marketers"],
    adjacentFamilies: ["no_code_builders", "automation"],
    categoryTerms: ["note taking", "task management", "project management", "knowledge base"],
  },
  {
    key: "learning",
    label: "Learning platforms",
    members: ["brilliant", "coursera", "udemy", "datacamp", "codecademy", "pluralsight", "skillshare", "educative", "boot.dev"],
    buyerAudiences: ["students", "software_engineers", "data", "ai_developers"],
    adjacentFamilies: ["devtools"],
    categoryTerms: ["online course", "learning platform", "tutorial platform", "certification"],
  },
];

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9. ]/g, "")
    .trim();
}

/** Strips a domain to its registrable label, e.g. "https://posthog.com/x" -> "posthog". */
function domainToLabel(domain: string): string {
  const host = domain.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
  return normalise(host.split(".")[0] ?? host);
}

export interface FamilyMatch {
  family: ProductFamily;
  /** "member" = the brand IS a known member; "category" = matched by category wording. */
  via: "member" | "category";
  matched: string;
}

/**
 * Identifies which product families a brand belongs to, by name, domain, or its
 * category text. A brand can legitimately sit in several (Sentry is both error
 * monitoring and DevOps tooling).
 */
export function identifyFamilies(brand: {
  name: string;
  domain?: string | null;
  category?: string | null;
}): FamilyMatch[] {
  const name = normalise(brand.name);
  const domainLabel = brand.domain ? domainToLabel(brand.domain) : "";
  const category = brand.category ? normalise(brand.category) : "";
  const matches: FamilyMatch[] = [];

  for (const family of PRODUCT_FAMILIES) {
    const member = family.members.find((m) => {
      const n = normalise(m);
      return n === name || (domainLabel !== "" && n === domainLabel) || name.includes(n) || (domainLabel !== "" && domainLabel.includes(n));
    });
    if (member) {
      matches.push({ family, via: "member", matched: member });
      continue;
    }

    const term = family.categoryTerms.find((t) => category.includes(normalise(t)) || name.includes(normalise(t)));
    if (term) matches.push({ family, via: "category", matched: term });
  }

  return matches;
}

export interface RelatednessResult {
  /** 0–1. 1 = same family, 0.6 = adjacent family, 0 = unrelated. */
  score: number;
  reason: string;
  sharedFamilies: string[];
}

/**
 * How related two brands are — the replacement for exact category-string equality.
 * Used to recognise competitor conflicts (same family) and relevant sponsorship
 * history (adjacent family) that the old matcher was blind to.
 */
export function relatednessScore(
  a: { name: string; domain?: string | null; category?: string | null },
  b: { name: string; domain?: string | null; category?: string | null },
): RelatednessResult {
  if (normalise(a.name) === normalise(b.name)) {
    return { score: 1, reason: "Same brand.", sharedFamilies: [] };
  }

  const aFamilies = identifyFamilies(a);
  const bFamilies = identifyFamilies(b);
  if (aFamilies.length === 0 || bFamilies.length === 0) {
    return { score: 0, reason: "No known product family for one or both brands.", sharedFamilies: [] };
  }

  const aKeys = new Set(aFamilies.map((f) => f.family.key));
  const bKeys = new Set(bFamilies.map((f) => f.family.key));

  const shared = Array.from(aKeys).filter((k) => bKeys.has(k));
  if (shared.length > 0) {
    const labels = shared.map((k) => PRODUCT_FAMILIES.find((f) => f.key === k)?.label ?? k);
    return {
      score: 1,
      reason: `Both are ${labels.join(" / ")} products — direct competitors or close substitutes.`,
      sharedFamilies: shared,
    };
  }

  for (const aFamily of aFamilies) {
    for (const adjacentKey of aFamily.family.adjacentFamilies ?? []) {
      if (bKeys.has(adjacentKey)) {
        const adjacentLabel = PRODUCT_FAMILIES.find((f) => f.key === adjacentKey)?.label ?? adjacentKey;
        return {
          score: 0.6,
          reason: `${aFamily.family.label} and ${adjacentLabel} serve substantially overlapping buyers.`,
          sharedFamilies: [],
        };
      }
    }
  }

  return { score: 0, reason: "Different product families with little buyer overlap.", sharedFamilies: [] };
}

/**
 * Audience categories that plausibly buy a brand's product, used to score creator
 * audience fit against the creator's weighted niche profile.
 */
export function buyerAudiencesFor(brand: { name: string; domain?: string | null; category?: string | null }): {
  audiences: string[];
  families: string[];
} {
  const families = identifyFamilies(brand);
  const audiences = new Set<string>();
  for (const match of families) {
    for (const audience of match.family.buyerAudiences) audiences.add(audience);
  }
  return { audiences: Array.from(audiences), families: families.map((f) => f.family.label) };
}
