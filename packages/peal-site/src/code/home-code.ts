import type { CodeSample } from "peal-ui/components/code-block";
import type { SiteIcon, SiteMark } from "peal-ui/components/site-icons";
import {
  siCurl,
  siDotnet,
  siGo,
  siJson,
  siOpenjdk,
  siPhp,
  siPython,
  siRuby,
  siRust,
  siTypescript,
} from "simple-icons";
import type { SimpleIcon } from "simple-icons";

import { highlight } from "./highlight.ts";
import type { CodeGrammar } from "./highlight.ts";
import {
  cliRequest,
  mcpConfig,
  publishResponse,
  publishSnippets,
  requestLanguages,
  webhookPayload,
} from "./snippets.ts";
import type { RequestLanguage } from "./snippets.ts";

// The home page's code, highlighted once at build time, as the samples
// peal-ui's CodeBlock lays out.

/** The code each block of the home page shows. */
export interface HomeCode {
  /** The command line's row. */
  readonly cli: CodeSample;
  /** The MCP row: the client's configuration. */
  readonly mcp: CodeSample;
  /** The publishing request in every way in, and what it answers. */
  readonly publish: {
    readonly response: CodeSample;
    readonly samples: readonly CodeSample[];
  };
  /** The webhooks row: one delivery. */
  readonly webhook: CodeSample;
}

const path = (icon: SimpleIcon): SiteMark => ({
  kind: "path",
  path: icon.path,
});

/** Each way in's mark: simple-icons', or lucide's terminal for the CLI. */
const marks: Readonly<
  Record<
    RequestLanguage,
    { readonly icon?: SiteIcon; readonly mark?: SiteMark }
  >
> = {
  cli: { icon: "terminal" },
  curl: { mark: path(siCurl) },
  dotnet: { mark: path(siDotnet) },
  go: { mark: path(siGo) },
  java: { mark: path(siOpenjdk) },
  php: { mark: path(siPhp) },
  python: { mark: path(siPython) },
  ruby: { mark: path(siRuby) },
  rust: { mark: path(siRust) },
  typescript: { mark: path(siTypescript) },
};

const json = { label: "JSON", mark: path(siJson), value: "json" } as const;

const sample = async (
  code: string,
  grammar: CodeGrammar,
  details: Omit<CodeSample, "highlighted">
): Promise<CodeSample> => ({
  ...details,

  highlighted: await highlight(code, grammar),
});

export const homeCode = async (): Promise<HomeCode> => {
  const samples = await Promise.all(
    requestLanguages.map(async (language) => {
      const snippet = publishSnippets[language];

      return await sample(snippet.code, snippet.grammar, {
        ...marks[language],
        filename: snippet.filename,
        label: snippet.label,
        value: language,
      });
    })
  );

  return {
    cli: await sample(cliRequest, "bash", {
      ...marks.cli,
      filename: "peal post",
      label: publishSnippets.cli.label,
      value: "cli",
    }),
    mcp: await sample(mcpConfig, "json", { ...json, filename: "mcp.json" }),
    publish: {
      response: await sample(publishResponse, "json", {
        ...json,
        filename: "201 Created",
      }),
      samples,
    },
    webhook: await sample(webhookPayload, "json", {
      ...json,
      filename: "post.published",
    }),
  };
};
