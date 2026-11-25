import type { ReactElement, ReactNode } from "react";
import { Body, Container, Head, Html } from "react-email";

import type { Locale } from "../locale.ts";
import { bodyText, colors, fontFamily, pageWidth, radii } from "./theme.ts";

/** The page every email is written on. */
export const EmailFrame = ({
  children,
  locale,
}: {
  readonly children: ReactNode;
  readonly locale: Locale;
}): ReactElement => (
  <Html lang={locale}>
    <Head />
    <Body
      lang={locale}
      style={{
        ...bodyText,
        backgroundColor: colors.canvas,
        color: colors.ink,
        fontFamily,
        margin: 0,
        padding: "24px",
      }}
    >
      <Container
        style={{
          backgroundColor: colors.surface,
          borderRadius: radii.page,
          maxWidth: pageWidth,
          padding: "32px",
        }}
      >
        {children}
      </Container>
    </Body>
  </Html>
);
