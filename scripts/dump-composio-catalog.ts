import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Composio } from "@composio/core";

interface TargetToolkit {
  label: string;
  preferredSlug?: string;
  searchTerms?: string[];
}

const TARGET_TOOLKITS: TargetToolkit[] = [
  { label: "slack", preferredSlug: "slack" },
  { label: "linear", preferredSlug: "linear" },
  { label: "hubspot", preferredSlug: "hubspot" },
  { label: "salesforce", preferredSlug: "salesforce" },
  { label: "marketo" },
  { label: "pardot" },
  { label: "outreach" },
  { label: "salesloft" },
  { label: "apollo", preferredSlug: "apollo" },
  { label: "zoominfo", preferredSlug: "zoominfo" },
  { label: "notion", preferredSlug: "notion" },
  { label: "airtable", preferredSlug: "airtable" },
  {
    label: "google sheets",
    preferredSlug: "googlesheets",
    searchTerms: ["sheet"],
  },
  {
    label: "google bigquery",
    preferredSlug: "googlebigquery",
    searchTerms: ["bigquery"],
  },
  { label: "mailchimp", preferredSlug: "mailchimp" },
  {
    label: "customer.io",
    preferredSlug: "customerio",
    searchTerms: ["customer"],
  },
  {
    label: "microsoft teams",
    preferredSlug: "microsoft_teams",
    searchTerms: ["teams"],
  },
  { label: "asana", preferredSlug: "asana" },
  { label: "trello", preferredSlug: "trello" },
  { label: "monday", preferredSlug: "monday" },
  { label: "jira", preferredSlug: "jira" },
  { label: "gong", preferredSlug: "gong" },
  { label: "chorus" },
  { label: "typeform" },
  {
    label: "surveymonkey",
    preferredSlug: "survey_monkey",
    searchTerms: ["survey"],
  },
  { label: "zoom", preferredSlug: "zoom" },
  { label: "google ads", preferredSlug: "googleads", searchTerms: ["ads"] },
  { label: "meta ads", preferredSlug: "metaads", searchTerms: ["meta"] },
  { label: "calendly", preferredSlug: "calendly" },
  { label: "chilipiper", searchTerms: ["chili"] },
];

async function resolveToolkitSlug(
  toolkitList: any[],
  target: TargetToolkit,
): Promise<{ slug?: string; match?: any; error?: string }> {
  if (target.preferredSlug) {
    const directMatch = toolkitList.find(
      (item) =>
        item.slug?.toLowerCase() === target.preferredSlug?.toLowerCase(),
    );
    if (directMatch) {
      return { slug: directMatch.slug, match: directMatch };
    }
  }

  const terms = [target.label, ...(target.searchTerms ?? [])];
  for (const term of terms) {
    const lower = term.toLowerCase();
    const match = toolkitList.find(
      (item) =>
        item.slug?.toLowerCase().includes(lower) ||
        item.name?.toLowerCase().includes(lower),
    );
    if (match) {
      return { slug: match.slug, match };
    }
  }

  return { error: "Toolkit not found" };
}

async function main() {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    throw new Error("Missing COMPOSIO_API_KEY");
  }

  const composio = new Composio({ apiKey });
  const toolkitList = await composio.toolkits.get();

  const summaries = await Promise.all(
    TARGET_TOOLKITS.map(async (target) => {
      try {
        const resolved = await resolveToolkitSlug(toolkitList, target);
        if (!resolved.slug) {
          return {
            label: target.label,
            status: "missing",
            error: resolved.error ?? "Unknown error",
          };
        }

        const detail = await composio.toolkits.get(resolved.slug);
        const authDetails = detail.authConfigDetails?.map((cfg: any) => ({
          name: cfg.name,
          mode: cfg.mode,
          defaultScopes:
            cfg.fields?.authConfigCreation?.optional?.find(
              (field: any) => field.name === "scopes",
            )?.default || null,
        }));

        let sampleTools: { slug: string; name: string }[] = [];
        try {
          const toolsResponse = await composio.tools.getRawComposioTools({
            toolkits: [resolved.slug],
            limit: 5,
          });
          const items = (toolsResponse as any)?.items ?? toolsResponse;
          if (Array.isArray(items)) {
            sampleTools = items.slice(0, 5).map((tool: any) => ({
              slug: tool.slug,
              name: tool.name,
            }));
          }
        } catch (toolsError) {
          sampleTools = [
            {
              slug: "ERROR",
              name:
                toolsError instanceof Error
                  ? toolsError.message
                  : String(toolsError),
            },
          ];
        }

        return {
          label: target.label,
          status: "resolved",
          slug: resolved.slug,
          name: detail.name,
          description: detail.meta?.description,
          authConfigs: authDetails ?? [],
          sampleTools,
        };
      } catch (error) {
        return {
          label: target.label,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const timestamp = new Date().toISOString();
  const outputLines: string[] = [];
  outputLines.push(`# Composio Toolkit Audit`);
  outputLines.push("");
  outputLines.push(`Generated: ${timestamp}`);
  outputLines.push("");

  for (const summary of summaries) {
    outputLines.push(`## ${summary.label}`);
    outputLines.push("");
    outputLines.push("```json");
    outputLines.push(JSON.stringify(summary, null, 2));
    outputLines.push("```");
    outputLines.push("");
  }

  const outputPath = resolve(
    process.cwd(),
    "..",
    "..",
    "docs",
    "composio-toolkit-audit.md",
  );
  writeFileSync(outputPath, outputLines.join("\n"), "utf8");
  console.log(`Wrote ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
