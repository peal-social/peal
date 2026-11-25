import { catalogs } from "../catalog/index.ts";
import { fill } from "../format.ts";
import type { Locale } from "../locale.ts";

/**
 * The text of an email: what it says, its button as a link, what closes it
 * (why it came and who signs it, for most) and, where the server states it,
 * who sends. Its first address is the button's, unless what it says holds
 * one: tests that read emails take it.
 */
export const textPart = (
  {
    action,
    blocks,
    closing,
    identity,
    url,
  }: {
    readonly action: string;
    readonly blocks: readonly string[];
    readonly closing: readonly string[];
    /** Who sends, as the operator states it. */
    readonly identity: string | null;
    readonly url: string;
  },
  locale: Locale
): string =>
  [
    ...blocks,
    fill(
      catalogs[locale].layout.textLink,
      new Map([
        ["action", action],
        ["url", url],
      ])
    ),
    ...closing,
    ...(identity === null ? [] : [identity]),
  ].join("\n\n");
