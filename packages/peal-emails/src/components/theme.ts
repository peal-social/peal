import type { CSSProperties } from "react";

// What every email looks like, in one place: the values components are
// written with. Email clients ignore stylesheets, so each is an inline style.

export const colors = {
  /** The page around the email. */
  canvas: "#f4f4f5",
  /** Text, links, buttons and the highlight's frame. */
  ink: "#18181b",
  /** What matters less: the fine print. */
  muted: "#52525b",
  /** The frame around a digest's workspace. */
  rule: "#e7e5e4",
  /** The email itself, and the words on a button. */
  surface: "#ffffff",
} as const;

export const fontFamily =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export const radii = { control: "6px", page: "8px" } as const;

export const pageWidth = "560px";

/** The body's text. */
export const bodyText = {
  fontSize: "16px",
  lineHeight: "24px",
} as const satisfies CSSProperties;

/** The fine print's. */
export const smallText = {
  fontSize: "14px",
  lineHeight: "24px",
} as const satisfies CSSProperties;

/** A link in a sentence, or written out. */
export const linkStyle = (color: string): CSSProperties => ({
  color,
  textDecorationLine: "underline",
});
