// The home page's code says what the SDKs really do: every way in has its
// request, each the same post, and each SDK's names are the ones its
// generated sources declare. The highlighted runs give back the source,
// and the theme names only colours tokens.css defines.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  decodeHighlighted,
  highlightedSource,
} from "peal-ui/lib/highlighted-code";
import { describe, expect, it } from "vitest";

import { homeCode } from "../src/code/home-code.ts";
import {
  channelIds,
  cliRequest,
  idempotencyKey,
  mcpConfig,
  postText,
  publishResponse,
  publishSnippets,
  requestLanguages,
  waitSeconds,
  webhookPayload,
  workspaceId,
} from "../src/code/snippets.ts";
import { pealTheme } from "../src/code/theme.ts";

const sdkRoot = path.join(import.meta.dirname, "../../peal-sdk");

const tokensFile = readFileSync(
  path.join(import.meta.dirname, "../../peal-ui/src/styles/tokens.css"),
  "utf-8"
);

const snippets = requestLanguages.map((language) => ({
  language,
  ...publishSnippets[language],
}));

const sdkSnippets = snippets.flatMap((snippet) =>
  snippet.sdk === undefined ? [] : [{ ...snippet, sdk: snippet.sdk }]
);

const read = (folder: string, file: string) =>
  readFileSync(path.join(sdkRoot, folder, file), "utf-8");

// Every language's folder under packages/peal-sdk is an Nx project.
const sdkFolders = readdirSync(sdkRoot, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      existsSync(path.join(sdkRoot, entry.name, "project.json"))
  )
  .map((entry) => entry.name)
  .toSorted();

const code = await homeCode();

describe("the home page's requests", () => {
  it("shows curl, the CLI and every SDK", () => {
    expect(sdkFolders).toHaveLength(8);
    expect(sdkSnippets.map(({ sdk }) => sdk.folder).toSorted()).toStrictEqual(
      sdkFolders
    );
    expect(
      snippets.filter(({ sdk }) => sdk === undefined).map((s) => s.language)
    ).toStrictEqual(["curl", "cli"]);
  });

  it.each(snippets)(
    "sends the same post, now, with its key, in $language",
    ({ code: source, language }) => {
      // A key acts in its own workspace: no request names it, nor does
      // the command line.
      expect(source, language).not.toContain(workspaceId);
      expect(source, language).not.toContain("PEAL_WORKSPACE");
      expect(source).toContain(idempotencyKey);
      expect(source).toContain(postText);
      expect(source).toContain(String(waitSeconds));

      for (const channel of channelIds) {
        expect(source).toContain(channel);
      }
    }
  );

  it.each(sdkSnippets)(
    "calls what the $language SDK declares",
    ({ code: source, sdk }) => {
      expect(source).toContain(sdk.call);
      expect(read(sdk.folder, sdk.source)).toContain(sdk.declaration);

      for (const { file, name } of sdk.names) {
        expect(read(sdk.folder, file), `${file}: ${name}`).toContain(name);
      }
    }
  );
});

describe("the home page's highlighted code", () => {
  const samples = [
    ...requestLanguages.map((language) => ({
      sample: code.publish.samples.find(({ value }) => value === language),
      source: publishSnippets[language].code,
    })),
    { sample: code.publish.response, source: publishResponse },
    { sample: code.cli, source: cliRequest },
    { sample: code.mcp, source: mcpConfig },
    { sample: code.webhook, source: webhookPayload },
  ];

  it.each(samples)(
    "gives back the source of $sample.filename ($sample.value)",
    ({ sample, source }) => {
      expect(highlightedSource(sample?.highlighted ?? "")).toBe(source);
    }
  );

  it("colours strings and punctuation in every language", () => {
    for (const sample of code.publish.samples) {
      const kinds = new Set(
        decodeHighlighted(sample.highlighted).flatMap((runs) =>
          runs.map((run) => run.kind)
        )
      );

      expect(kinds, sample.value).toContain("string");
      expect(kinds, sample.value).toContain("punctuation");
    }
  });

  it("names only colours tokens.css defines", () => {
    const named = [
      ...JSON.stringify(pealTheme).matchAll(/var\(--(?<name>[a-z-]+)\)/gu),
    ].map((match) => match.groups?.["name"] ?? "");

    expect(named.length).toBeGreaterThan(5);

    for (const name of named) {
      expect(tokensFile, name).toMatch(new RegExp(`--${name}:`, "u"));
    }
  });
});
