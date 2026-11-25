import type { ReactElement } from "react";

import { catalogs } from "../catalog/index.ts";
import { ActionLink } from "../components/action-link.tsx";
import { EmailFrame } from "../components/email-frame.tsx";
import type { HeaderMotion } from "../components/email-header.tsx";
import { FinePrint } from "../components/fine-print.tsx";
import { Highlight } from "../components/highlight.tsx";
import { Paragraph } from "../components/paragraph.tsx";
import { Title } from "../components/title.tsx";
import type { Letterhead } from "../letterhead.ts";
import type { Locale } from "../locale.ts";
import type { MessageContent } from "./message-content.ts";

/** The template of every email but the weekly digest. */
export const MessageEmail = ({
  content,
  letterhead,
  locale,
  motion = "still",
}: {
  readonly content: MessageContent;
  readonly letterhead: Letterhead;
  readonly locale: Locale;
  readonly motion?: HeaderMotion;
}): ReactElement => {
  const { layout } = catalogs[locale];

  return (
    <EmailFrame
      footer={
        <>
          <FinePrint>{content.ignore}</FinePrint>
          <FinePrint>{layout.signature}</FinePrint>
        </>
      }
      letterhead={letterhead}
      locale={locale}
      motion={motion}
      preview={content.body}
      subject={content.subject}
    >
      <Title>{content.subject}</Title>
      <Paragraph>{content.body}</Paragraph>
      {content.highlight === undefined ? null : (
        <Highlight>{content.highlight}</Highlight>
      )}
      <ActionLink
        action={content.action}
        fallback={layout.linkFallback}
        url={content.url}
      />
    </EmailFrame>
  );
};
