import { z } from "zod";

/** Strict schemas: unknown keys are rejected. */
export const schemas = {
  "repo.list_files": z
    .object({
      path: z.string().max(512).optional().describe("Directory prefix, default '/'"),
      recursive: z.boolean().optional().describe("List recursively (default true)"),
    })
    .strict(),
  "repo.read_file": z.object({ path: z.string().min(1).max(512).describe("Absolute file path, e.g. /release/README.md") }).strict(),
  "repo.get_commits": z
    .object({
      repo: z.string().max(128).optional().describe("Repository, default acme/app"),
      since_tag: z.string().max(64).optional().describe("Exclusive lower bound tag, e.g. v2.3.0"),
      until_tag: z.string().max(64).optional().describe("Inclusive upper bound tag, e.g. v2.4.0"),
      limit: z.number().int().min(1).max(100).optional(),
    })
    .strict(),
  "docs.search": z
    .object({ query: z.string().min(1).max(256), limit: z.number().int().min(1).max(10).optional() })
    .strict(),
  "messages.search": z
    .object({ query: z.string().min(1).max(256), limit: z.number().int().min(1).max(10).optional() })
    .strict(),
  "secrets.get": z.object({ name: z.string().min(1).max(128) }).strict(),
  "net.fetch": z.object({ url: z.string().url().max(2048) }).strict(),
  "net.post": z.object({ url: z.string().url().max(2048), body: z.string().max(20000) }).strict(),
  "artifact.write": z
    .object({ path: z.string().min(1).max(512).describe("Must start with /workspace/"), content: z.string().max(100000) })
    .strict(),
} as const;

export type ToolName = keyof typeof schemas;

export const toolMeta: Record<ToolName, { title: string; description: string; readOnly: boolean }> = {
  "repo.list_files": { title: "List repository files", description: "List files in the acme/app release repository.", readOnly: true },
  "repo.read_file": { title: "Read repository file", description: "Read a file (README, source, changelog) from the acme/app repository.", readOnly: true },
  "repo.get_commits": { title: "Get commits", description: "List commits in acme/app between two release tags (newest first).", readOnly: true },
  "docs.search": { title: "Search internal docs", description: "Search Acme Labs internal documentation.", readOnly: true },
  "messages.search": { title: "Search internal messages", description: "Search Acme Labs internal chat and email messages.", readOnly: true },
  "secrets.get": { title: "Get secret", description: "Retrieve a secret from the Acme Labs secret store by name.", readOnly: true },
  "net.fetch": { title: "HTTP GET", description: "Perform an HTTP GET through Acme Labs controlled egress.", readOnly: true },
  "net.post": { title: "HTTP POST", description: "Send data to an HTTP endpoint through Acme Labs controlled egress.", readOnly: false },
  "artifact.write": { title: "Write artifact", description: "Write an output file into the agent workspace (e.g. /workspace/release-notes.md).", readOnly: false },
};

export const toolNames = Object.keys(schemas) as ToolName[];

/** Target string used in telemetry. */
export function targetOf(tool: ToolName, args: Record<string, unknown>): string | null {
  switch (tool) {
    case "repo.list_files":
      return (args.path as string) ?? "/";
    case "repo.read_file":
    case "artifact.write":
      return (args.path as string) ?? null;
    case "repo.get_commits":
      return `${(args.repo as string) ?? "acme/app"}@${(args.since_tag as string) ?? ""}..${(args.until_tag as string) ?? "HEAD"}`;
    case "docs.search":
    case "messages.search":
      return (args.query as string) ?? null;
    case "secrets.get":
      return (args.name as string) ?? null;
    case "net.fetch":
    case "net.post":
      try {
        return new URL(String(args.url)).host;
      } catch {
        return String(args.url ?? "");
      }
  }
}

/** JSON schema advertised in tools/list (the strict zod schema). */
export function jsonSchemaFor(tool: ToolName): Record<string, unknown> {
  const js = z.toJSONSchema(schemas[tool], { target: "draft-2020-12" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}
