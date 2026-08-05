/**
 * Deterministic, weighted content classification.
 *
 * The old system treated `Channel.category` (operator-typed, or the discovery query's
 * label) as the creator's niche — it described the SEARCH, not the creator. This module
 * derives the niche from what the creator actually publishes: titles, descriptions and,
 * where available, transcripts.
 *
 * Deliberately never forces one category: a creator is returned as weighted categories
 * (e.g. AI development 45%, automation 25%, SaaS founders 20%, productivity 10%),
 * because pretending a creator is exactly one thing is what produces bad matches.
 * Every weight carries the evidence terms that earned it.
 */

export interface AudienceCategory {
  key: string;
  label: string;
  /** Terms whose presence indicates this audience. Matched on word boundaries. */
  terms: string[];
  /** Terms that count double — strongly diagnostic of this audience specifically. */
  strongTerms?: string[];
}

/**
 * Audience taxonomy. Categories are audiences (who watches), not video formats,
 * because sponsorship fit is decided by who is watching and what they buy.
 */
export const AUDIENCE_CATEGORIES: AudienceCategory[] = [
  {
    key: "ai_developers",
    label: "AI developers",
    terms: ["llm", "prompt", "openai", "anthropic", "claude", "gpt", "gemini", "rag", "embedding", "fine-tune", "fine tune", "inference", "hugging face", "langchain", "vector database", "ai agent", "agentic"],
    strongTerms: ["rag", "langchain", "fine-tune", "agentic", "vector database"],
  },
  {
    key: "ai_automation",
    label: "AI automation users",
    terms: ["automation", "automate", "workflow", "n8n", "zapier", "make.com", "no code automation", "ai workflow", "agent workflow"],
    strongTerms: ["n8n", "zapier", "make.com"],
  },
  {
    key: "software_engineers",
    label: "Software engineers",
    terms: ["javascript", "typescript", "python", "react", "rust", "golang", "api", "framework", "refactor", "codebase", "unit test", "debugging", "compiler", "algorithm", "backend", "frontend", "full stack"],
    strongTerms: ["refactor", "codebase", "compiler", "unit test"],
  },
  {
    key: "devops",
    label: "DevOps / platform engineers",
    terms: ["kubernetes", "docker", "ci/cd", "terraform", "ansible", "helm", "observability", "prometheus", "grafana", "pipeline", "sre", "infrastructure as code", "deployment"],
    strongTerms: ["kubernetes", "terraform", "sre", "helm"],
  },
  {
    key: "cloud",
    label: "Cloud engineers",
    terms: ["aws", "azure", "gcp", "google cloud", "serverless", "lambda", "s3", "cloudfront", "vpc", "cloud architecture"],
    strongTerms: ["vpc", "serverless", "cloud architecture"],
  },
  {
    key: "cybersecurity",
    label: "Cybersecurity professionals",
    terms: ["security", "pentest", "penetration test", "vulnerability", "exploit", "malware", "ctf", "soc", "siem", "zero trust", "encryption", "threat"],
    strongTerms: ["pentest", "ctf", "siem", "exploit"],
  },
  {
    key: "technical_founders",
    label: "Technical founders",
    terms: ["startup", "founder", "mvp", "build in public", "indie hacker", "bootstrapped", "product market fit", "fundraising", "solopreneur"],
    strongTerms: ["indie hacker", "build in public", "product market fit", "bootstrapped"],
  },
  {
    key: "saas_founders",
    label: "SaaS founders",
    terms: ["saas", "subscription business", "mrr", "arr", "churn", "pricing page", "b2b software", "recurring revenue"],
    strongTerms: ["mrr", "arr", "churn"],
  },
  {
    key: "no_code",
    label: "No-code builders",
    terms: ["no code", "nocode", "low code", "bubble.io", "webflow", "airtable", "notion database", "glide"],
    strongTerms: ["bubble.io", "webflow", "nocode"],
  },
  {
    key: "data",
    label: "Data engineers / analysts",
    terms: ["sql", "data pipeline", "etl", "warehouse", "snowflake", "dbt", "bigquery", "pandas", "analytics", "dashboard", "data engineering"],
    strongTerms: ["dbt", "etl", "snowflake", "bigquery"],
  },
  {
    key: "business_owners",
    label: "Business owners",
    terms: ["small business", "agency owner", "ecommerce", "shopify", "client work", "invoice", "business owner", "freelance"],
    strongTerms: ["agency owner", "shopify"],
  },
  {
    key: "marketers",
    label: "Marketers",
    terms: ["seo", "marketing", "content strategy", "funnel", "ads", "copywriting", "email marketing", "growth", "conversion"],
    strongTerms: ["seo", "copywriting", "conversion"],
  },
  {
    key: "productivity",
    label: "Productivity users",
    terms: ["productivity", "note taking", "obsidian", "notion", "second brain", "task management", "workflow setup", "time management"],
    strongTerms: ["second brain", "obsidian", "note taking"],
  },
  {
    key: "students",
    label: "Students / learners",
    terms: ["tutorial for beginners", "learn to code", "roadmap", "bootcamp", "computer science degree", "study", "beginner guide", "course"],
    strongTerms: ["bootcamp", "learn to code", "roadmap"],
  },
  {
    key: "enterprise_it",
    label: "Enterprise IT professionals",
    terms: ["active directory", "microsoft 365", "sharepoint", "intune", "enterprise", "compliance", "sysadmin", "windows server"],
    strongTerms: ["active directory", "intune", "sysadmin"],
  },
  {
    key: "self_hosting",
    label: "Self-hosting / homelab",
    terms: ["self host", "selfhost", "homelab", "proxmox", "truenas", "raspberry pi", "nas", "unraid", "home server"],
    strongTerms: ["homelab", "proxmox", "self host", "unraid"],
  },
  {
    key: "open_source",
    label: "Open-source users",
    terms: ["open source", "oss", "github repo", "contributor", "mit license", "fork the repo", "maintainer"],
    strongTerms: ["open source", "maintainer"],
  },
];

/** Technical-depth vocabulary: advanced terms imply a senior, higher-value audience. */
const ADVANCED_TERMS = ["architecture", "distributed", "concurrency", "kernel", "compiler", "benchmark", "latency", "throughput", "scalability", "internals", "protocol", "memory management"];
const BEGINNER_TERMS = ["beginner", "getting started", "introduction", "for dummies", "first time", "basics", "step by step", "what is"];

export interface CategoryWeight {
  key: string;
  label: string;
  weight: number;
  /** Matched terms that produced this weight — the evidence behind the classification. */
  evidence: string[];
}

export interface ContentClassification {
  primaryNiche: string | null;
  secondaryNiche: string | null;
  nicheWeights: CategoryWeight[];
  recurringTopics: string[];
  technicalDepth: "beginner" | "intermediate" | "advanced" | null;
  /** How much text was available to classify from — feeds profile completeness. */
  documentsAnalysed: number;
}

function countTermHits(haystack: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Word-boundary-ish matching that still works for multi-word and dotted terms.
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "gi");
  return (haystack.match(pattern) ?? []).length;
}

/**
 * Classifies a creator from their own content.
 *
 * @param documents one string per video (title + description [+ transcript]) — using
 *   separate documents rather than one blob lets a term that recurs ACROSS videos
 *   outweigh one that appears many times in a single video, which is what
 *   distinguishes a creator's actual beat from a one-off topic.
 */
export function classifyContent(documents: string[]): ContentClassification {
  const usable = documents.map((d) => (d ?? "").toLowerCase()).filter((d) => d.trim().length > 0);

  if (usable.length === 0) {
    return {
      primaryNiche: null,
      secondaryNiche: null,
      nicheWeights: [],
      recurringTopics: [],
      technicalDepth: null,
      documentsAnalysed: 0,
    };
  }

  const scores: CategoryWeight[] = [];

  for (const category of AUDIENCE_CATEGORIES) {
    let score = 0;
    const evidence = new Set<string>();

    for (const term of category.terms) {
      // Number of DISTINCT videos mentioning the term — recurrence across the
      // catalogue, not raw repetition inside one description.
      const documentHits = usable.filter((doc) => countTermHits(doc, term) > 0).length;
      if (documentHits === 0) continue;
      const isStrong = category.strongTerms?.includes(term) ?? false;
      score += documentHits * (isStrong ? 2 : 1);
      evidence.add(term);
    }

    if (score > 0) {
      scores.push({ key: category.key, label: category.label, weight: score, evidence: Array.from(evidence).slice(0, 8) });
    }
  }

  const total = scores.reduce((sum, s) => sum + s.weight, 0);
  if (total === 0) {
    return {
      primaryNiche: null,
      secondaryNiche: null,
      nicheWeights: [],
      recurringTopics: [],
      technicalDepth: null,
      documentsAnalysed: usable.length,
    };
  }

  // Normalise to shares, keep meaningful categories only (>=5%), cap at 5.
  const normalised = scores
    .map((s) => ({ ...s, weight: s.weight / total }))
    .filter((s) => s.weight >= 0.05)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  // Re-normalise after filtering so weights still sum to ~1.
  const keptTotal = normalised.reduce((sum, s) => sum + s.weight, 0);
  const nicheWeights = normalised.map((s) => ({ ...s, weight: Number((s.weight / keptTotal).toFixed(3)) }));

  const joined = usable.join("\n");
  const advancedHits = ADVANCED_TERMS.filter((t) => countTermHits(joined, t) > 0).length;
  const beginnerHits = BEGINNER_TERMS.filter((t) => countTermHits(joined, t) > 0).length;
  let technicalDepth: ContentClassification["technicalDepth"] = null;
  if (advancedHits > 0 || beginnerHits > 0) {
    if (advancedHits >= beginnerHits + 2) technicalDepth = "advanced";
    else if (beginnerHits >= advancedHits + 2) technicalDepth = "beginner";
    else technicalDepth = "intermediate";
  }

  // Recurring topics: terms appearing across at least a third of videos (min 2).
  const threshold = Math.max(2, Math.ceil(usable.length / 3));
  const recurringTopics = Array.from(
    new Set(
      AUDIENCE_CATEGORIES.flatMap((c) => c.terms).filter(
        (term) => usable.filter((doc) => countTermHits(doc, term) > 0).length >= threshold,
      ),
    ),
  ).slice(0, 12);

  return {
    primaryNiche: nicheWeights[0]?.label ?? null,
    secondaryNiche: nicheWeights[1]?.label ?? null,
    nicheWeights,
    recurringTopics,
    technicalDepth,
    documentsAnalysed: usable.length,
  };
}
