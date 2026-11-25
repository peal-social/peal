import type { ReactElement } from "react";
import { Button, Link, Text } from "react-email";

import { bodyText, colors, linkStyle, radii, smallText } from "./theme.ts";

/**
 * An email's button (DESIGN.md's `email-button`), and its link written out
 * beneath it, for the clients that do not show it.
 */
export const ActionLink = ({
  action,
  fallback,
  url,
}: {
  readonly action: string;
  /** What introduces the link written out. */
  readonly fallback: string;
  readonly url: string;
}): ReactElement => (
  <>
    <Text style={{ ...bodyText, margin: "0 0 24px" }}>
      <Button
        href={url}
        style={{
          backgroundColor: colors.ink,
          borderRadius: radii.control,
          color: colors.onInk,
          fontSize: bodyText.fontSize,
          fontWeight: 500,
          // React Email's button writes its words on a line of 1.2 times
          // their size (19.2px): 44px in all.
          padding: "12.4px 20px",
        }}
      >
        {action}
      </Button>
    </Text>
    <Text style={{ ...smallText, color: colors.muted, margin: "0 0 4px" }}>
      {fallback}
    </Text>
    <Text style={{ ...smallText, margin: "0 0 24px", wordBreak: "break-all" }}>
      <Link href={url} style={linkStyle(colors.brandText)}>
        {url}
      </Link>
    </Text>
  </>
);
