// Rewrites the Studio SDK's own address constants for its WebAssembly,
// emoji and fonts so they go through the editor's relay on the page's
// origin (`src/studio/asset-relay.ts`), and puts its licence's notice at
// the top of its build. Its catalogue of Google fonts (an address each,
// as object values) is left as it is: the editor's engine sends those
// through the relay as they are fetched (`relayFetches`,
// `components/studio/studio-engine.ts`). Run on the SDK's ES build when
// the SDK is upgraded, inside `bun patch`, then commit the patch:
//
//   bun patch @shotstack/shotstack-studio
//   bun packages/peal-web/scripts/relay-studio-assets.ts <the folder bun patch named>/dist/shotstack-studio.es.js
//   bun patch --commit <the folder bun patch named>
import { readFileSync, writeFileSync } from "node:fs";

import { relayPrefix, relayedHosts } from "../src/studio/asset-relay.ts";

const [file] = process.argv.slice(2);

if (file === undefined) {
  throw new Error("Name the SDK's ES build to rewrite.");
}

// The text with each constant or argument `= "https://<host>/…"` or
// `("https://<host>/…"` read from the page's origin through the relay,
// and how many it rewrote. A plain search: a host is never a pattern.
const relayed = (text: string, host: string) => {
  const opening = `"https://${host}/`;
  let out = "";
  let from = 0;
  let count = 0;
  let at = text.indexOf(opening);

  while (at !== -1) {
    const end = text.indexOf('"', at + opening.length);
    const before = text.slice(from, at).trimEnd().at(-1);

    if (end !== -1 && (before === "=" || before === "(")) {
      const path = text.slice(at + opening.length, end);

      out += `${text.slice(from, at)}((globalThis.location?.origin ?? "") + "${relayPrefix}/${host}/${path}")`;
      from = end + 1;
      count += 1;
    }

    at = text.indexOf(opening, Math.max(from, at + 1));
  }

  return { count, text: `${out}${text.slice(from)}` };
};

let rewritten = readFileSync(file, "utf-8");
let count = 0;

for (const host of relayedHosts) {
  const result = relayed(rewritten, host);

  rewritten = result.text;
  count += result.count;
}

// The SDK's terms travel with every copy of it, the browser's included:
// minifiers keep a `/*!` comment.
const notice =
  "/*! @shotstack/shotstack-studio, PolyForm Shield License 1.0.0 (https://polyformproject.org/licenses/shield/1.0.0). Required Notice: Copyright Shotstack Pty Ltd (https://shotstack.io). Changed by Peal to fetch its fonts and WebAssembly from the page's origin. */\n";

writeFileSync(
  file,
  rewritten.startsWith("/*! @shotstack") ? rewritten : `${notice}${rewritten}`
);

process.stdout.write(`Relayed ${String(count)} addresses.\n`);
