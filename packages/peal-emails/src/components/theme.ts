import type { CSSProperties } from "react";

// What every email looks like, in one place: DESIGN.md's values, which
// components are written with (DESIGN.md, Email). Some mail clients drop a
// stylesheet, so each is an inline style.

export const colors = {
  /** A link. */
  brandText: "#2f47c9",
  /** The page around the card. */
  canvas: "#fafaf9",
  /** Every border and rule. */
  hairline: "#e7e5e4",
  /** Text, and the button. */
  ink: "#0c0a09",
  /** What matters less: the fine print. */
  muted: "#716b66",
  /** The words on the button. */
  onInk: "#fafaf9",
  /** The callout. */
  quiet: "#f5f5f4",
  /** The card. */
  surface: "#ffffff",
} as const;

/** The dot of each state a digest counts posts in (DESIGN.md, States). */
export const stateDots = {
  approval: "#e0a800",
  failed: "#d92d20",
  published: "#16a34a",
  scheduled: "#415eee",
  /** To check on its platform: Draft's. */
  unconfirmed: "#a8a29e",
} as const;

// Geist where the reader has it: an email loads no font.
export const fontFamily =
  "Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export const monoFamily =
  "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

export const radii = {
  card: "12px",
  control: "8px",
  /** A picture flush with the card's corner, inside its border. */
  insideCard: "11px",
} as const;

export const cardWidth = "600px";

/** The card's gutters, and a phone's (`phoneStyles`). */
export const gutter = "32px";

export const phoneGutter = "20px";

/** The body's text. */
export const bodyText = {
  fontSize: "16px",
  lineHeight: "24px",
} as const satisfies CSSProperties;

/** The fine print's. */
export const smallText = {
  fontSize: "14px",
  lineHeight: "21px",
} as const satisfies CSSProperties;

/** A caption's. */
export const captionText = {
  fontSize: "12px",
  lineHeight: "18px",
} as const satisfies CSSProperties;

/** A link in a sentence, or written out. */
export const linkStyle = (color: string): CSSProperties => ({
  color,
  textDecorationLine: "underline",
});
