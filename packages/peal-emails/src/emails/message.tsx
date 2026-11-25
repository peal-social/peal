import type { ReactElement } from "react";

import { catalogs } from "../catalog/index.ts";
import { ActionLink } from "../components/action-link.tsx";
import { EmailFrame } from "../components/email-frame.tsx";
import { FinePrint } from "../components/fine-print.tsx";
import { Highlight } from "../components/highlight.tsx";
import { Paragraph } from "../components/paragraph.tsx";
import type { Locale } from "../locale.ts";
import type { MessageContent } from "./message-content.ts";

/** The template of every email but the weekly digest. */
export const MessageEmail = ({
  content,
  locale,
}: {
  readonly content: MessageContent;
  readonly locale: Locale;
}): ReactElement => {
  const { layout } = catalogs[locale];

  return (
    <EmailFrame locale={locale}>
      <Paragraph>{content.body}</Paragraph>
      {content.highlight === undefined ? null : (
        <Highlight>{content.highlight}</Highlight>
      )}
      <ActionLink
        action={content.action}
        fallback={layout.linkFallback}
        url={content.url}
      />
      <FinePrint>{content.ignore}</FinePrint>
      <FinePrint last>{layout.signature}</FinePrint>
    </EmailFrame>
  );
};
