import { readFileSync } from "node:fs";

// What the emails show, drawn by peal-ui (`bun nx run peal-ui:email-art`).
// Names are for ever: an email in an inbox keeps asking for the ones it
// named, so a file is never renamed nor removed.

/** A picture the emails show, as the server serves it. */
export interface EmailAsset {
  readonly bytes: Uint8Array;
  readonly contentType: "image/gif" | "image/png";
}

const contentTypes = {
  "footer.png": "image/png",
  "header.gif": "image/gif",
  "header.png": "image/png",
  "mark.png": "image/png",
} as const satisfies Record<string, EmailAsset["contentType"]>;

export type EmailAssetName = keyof typeof contentTypes;

/**
 * Every picture the emails show, by its name: read when the package loads,
 * so a server whose install lacks one stops as it starts.
 */
export const emailAssets: ReadonlyMap<string, EmailAsset> = new Map(
  Object.entries(contentTypes).map(([name, contentType]) => [
    name,
    {
      bytes: readFileSync(new URL(`assets/${name}`, import.meta.url)),
      contentType,
    },
  ])
);
