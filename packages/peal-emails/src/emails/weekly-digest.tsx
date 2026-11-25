import type { ReactElement } from "react";
import { Link, Text } from "react-email";

import { catalogs } from "../catalog/index.ts";
import { ActionLink } from "../components/action-link.tsx";
import { EmailFrame } from "../components/email-frame.tsx";
import { Eyebrow } from "../components/eyebrow.tsx";
import { FinePrint } from "../components/fine-print.tsx";
import { ListRows } from "../components/list-rows.tsx";
import { Panel } from "../components/panel.tsx";
import { Paragraph } from "../components/paragraph.tsx";
import { StatRows } from "../components/stat-rows.tsx";
import { colors, linkStyle, smallText } from "../components/theme.ts";
import { Title } from "../components/title.tsx";
import type { Letterhead } from "../letterhead.ts";
import type { Locale } from "../locale.ts";
import { digestPreview } from "./digest-content.ts";
import type {
  DigestContent,
  DigestList,
  DigestPart,
} from "./digest-content.ts";

const DigestPosts = ({
  heading,
  list: { more, rows },
}: {
  readonly heading: string;
  readonly list: DigestList;
}): ReactElement | null =>
  rows.length === 0 ? null : (
    <>
      <Eyebrow>{heading}</Eyebrow>
      <ListRows more={more} rows={rows} />
    </>
  );

const DigestWorkspacePart = ({
  content,
  part,
}: {
  readonly content: DigestContent;
  readonly part: DigestPart;
}): ReactElement => (
  <Panel>
    <Title level={2}>{part.name}</Title>
    <StatRows rows={part.counts} />
    {part.figures.map((figure) => (
      <FinePrint key={figure}>{figure}</FinePrint>
    ))}
    <DigestPosts heading={content.wentOutHeading} list={part.wentOut} />
    <DigestPosts heading={content.plannedHeading} list={part.planned} />
    <Text style={{ ...smallText, margin: "0 0 16px" }}>
      <Link href={part.calendarUrl} style={linkStyle(colors.brandText)}>
        {part.calendar}
      </Link>
    </Text>
  </Panel>
);

/** The weekly digest's template. */
export const WeeklyDigest = ({
  content,
  letterhead,
  locale,
}: {
  readonly content: DigestContent;
  readonly letterhead: Letterhead;
  readonly locale: Locale;
}): ReactElement => {
  const { layout } = catalogs[locale];

  return (
    <EmailFrame
      footer={
        <>
          <FinePrint>
            {content.why.before}
            <Link href={content.preferencesUrl} style={linkStyle(colors.muted)}>
              {content.preferences}
            </Link>
            {content.why.after}
          </FinePrint>
          <FinePrint>{layout.signature}</FinePrint>
        </>
      }
      letterhead={letterhead}
      locale={locale}
      motion="once"
      preview={digestPreview(content)}
      subject={content.subject}
    >
      <Title>{content.title}</Title>
      <Paragraph>{content.intro}</Paragraph>
      {content.parts.map((part) => (
        <DigestWorkspacePart
          content={content}
          key={part.calendarUrl}
          part={part}
        />
      ))}
      <ActionLink
        action={content.action}
        fallback={layout.linkFallback}
        url={content.url}
      />
    </EmailFrame>
  );
};
