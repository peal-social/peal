import { catalogs } from "../catalog/index.ts";
import { fill } from "../format.ts";
import type { Locale } from "../locale.ts";

/**
 * The text of an email: what it says, its button as a link, why it came,
 * who signs it and, where the server states it, who sends. Its first address is the button's, unless what it says holds
 * one: tests that read emails take it.
 */
export const textPart = (
  {
    action,
    blocks,
    identity,
    ignore,
    url,
  }: {
    readonly action: string;
    readonly blocks: readonly string[];
    /** Who sends, as the operator states it. */
    readonly identity: string | null;
    readonly ignore: string;
    readonly url: string;
  },
  locale: Locale
): string => {
  const { layout } = catalogs[locale];

  return [
    ...blocks,
    fill(
      layout.textLink,
      new Map([
        ["action", action],
        ["url", url],
      ])
    ),
    ignore,
    layout.signature,
    ...(identity === null ? [] : [identity]),
  ].join("\n\n");
};
