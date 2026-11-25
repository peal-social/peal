import type { ReactElement, ReactNode } from "react";
import { Body, Container, Head, Html, Preview, Text } from "react-email";

import type { Letterhead } from "../letterhead.ts";
import type { Locale } from "../locale.ts";
import { EmailFooter } from "./email-footer.tsx";
import { EmailHeader } from "./email-header.tsx";
import type { HeaderMotion } from "./email-header.tsx";
import { enhancements, gutterClass } from "./enhancements.ts";
import { Gutter } from "./gutter.tsx";
import {
  bodyText,
  captionText,
  cardWidth,
  colors,
  fontFamily,
  gutter,
  radii,
} from "./theme.ts";

/** Who sends, under the card, where the server states it. */
const Identity = ({
  children,
}: {
  readonly children: string;
}): ReactElement => (
  <Container
    style={{ maxWidth: cardWidth, padding: `16px ${gutter} 0` }}
    tdClassName={gutterClass}
  >
    <Text style={{ ...captionText, color: colors.muted, margin: 0 }}>
      {children}
    </Text>
  </Container>
);

/** The card every email is written on, its head and its foot. */
export const EmailFrame = ({
  children,
  footer,
  letterhead,
  locale,
  motion = "still",
  preview,
  subject,
}: {
  readonly children: ReactNode;
  /** What the email says last: why it came, who signs it. */
  readonly footer: ReactNode;
  readonly letterhead: Letterhead;
  readonly locale: Locale;
  readonly motion?: HeaderMotion;
  /** What an inbox shows after the subject. */
  readonly preview: string;
  readonly subject: string;
}): ReactElement => (
  <Html lang={locale}>
    <Head>
      <meta content="light only" name="color-scheme" />
      <meta content="light only" name="supported-color-schemes" />
      <title>{subject}</title>
      <style>{enhancements}</style>
    </Head>
    <Body
      lang={locale}
      style={{
        ...bodyText,
        backgroundColor: colors.canvas,
        color: colors.ink,
        fontFamily,
        margin: 0,
        padding: "24px 12px",
      }}
    >
      <Preview useTitleTag={false}>{preview}</Preview>
      <Container
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.hairline}`,
          borderRadius: radii.card,
          maxWidth: cardWidth,
        }}
      >
        <EmailHeader letterhead={letterhead} motion={motion} />
        <Gutter top="8px">{children}</Gutter>
        <EmailFooter letterhead={letterhead}>{footer}</EmailFooter>
      </Container>
      {letterhead.identity === null ? null : (
        <Identity>{letterhead.identity}</Identity>
      )}
    </Body>
  </Html>
);
