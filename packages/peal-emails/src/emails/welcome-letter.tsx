import type { ReactElement } from "react";

import { catalogs } from "../catalog/index.ts";
import { ActionLink } from "../components/action-link.tsx";
import { EmailFrame } from "../components/email-frame.tsx";
import { FinePrint } from "../components/fine-print.tsx";
import { Paragraph } from "../components/paragraph.tsx";
import { Title } from "../components/title.tsx";
import { unbroken } from "../components/unbroken.tsx";
import type { Letterhead } from "../letterhead.ts";
import type { Locale } from "../locale.ts";
import type { WelcomeContent } from "./welcome.ts";

/** The welcome's template: the card, signed in its body by a person. */
export const Welcome = ({
  content,
  letterhead,
  locale,
}: {
  readonly content: WelcomeContent;
  readonly letterhead: Letterhead;
  readonly locale: Locale;
}): ReactElement => (
  <EmailFrame
    footer={<FinePrint>{unbroken(content.once)}</FinePrint>}
    letterhead={letterhead}
    locale={locale}
    motion="once"
    preview={content.before.join(" ")}
    subject={content.subject}
  >
    <Title>{content.subject}</Title>
    {content.before.map((paragraph) => (
      <Paragraph key={paragraph}>{paragraph}</Paragraph>
    ))}
    <ActionLink
      action={content.action}
      fallback={catalogs[locale].layout.linkFallback}
      url={content.url}
    />
    {content.closing.map((paragraph) => (
      <Paragraph key={paragraph}>{paragraph}</Paragraph>
    ))}
  </EmailFrame>
);
