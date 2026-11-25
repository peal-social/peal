import type { ReactElement } from "react";
import { Link, Section, Text } from "react-email";

import { catalogs } from "../catalog/index.ts";
import { ActionLink } from "../components/action-link.tsx";
import { EmailFrame } from "../components/email-frame.tsx";
import { FinePrint } from "../components/fine-print.tsx";
import { Paragraph } from "../components/paragraph.tsx";
import {
  bodyText,
  colors,
  linkStyle,
  radii,
  smallText,
} from "../components/theme.ts";
import type { Locale } from "../locale.ts";
import type { DigestContent, DigestPart } from "./digest-content.ts";

const DigestList = ({
  heading,
  lines,
}: {
  readonly heading: string;
  readonly lines: readonly string[];
}): ReactElement | null =>
  lines.length === 0 ? null : (
    <>
      <Text style={{ ...bodyText, fontWeight: 600, margin: "0 0 4px" }}>
        {heading}
      </Text>
      <ul style={{ ...bodyText, margin: "0 0 12px", paddingLeft: "20px" }}>
        {/* Two lines may read alike; none moves. */}
        {lines.map((line, position) => (
          <li key={`${position}`}>{line}</li>
        ))}
      </ul>
    </>
  );

const DigestWorkspacePart = ({
  content,
  part,
}: {
  readonly content: DigestContent;
  readonly part: DigestPart;
}): ReactElement => (
  <Section
    style={{
      border: `1px solid ${colors.rule}`,
      borderRadius: radii.control,
      margin: "0 0 24px",
      padding: "16px",
    }}
  >
    <Text
      style={{
        ...bodyText,
        fontSize: "18px",
        fontWeight: 600,
        margin: "0 0 8px",
      }}
    >
      {part.name}
    </Text>
    <Text style={{ ...bodyText, margin: "0 0 12px" }}>{part.counts}</Text>
    {part.figures.map((figure) => (
      <Text
        key={figure}
        style={{ ...smallText, color: colors.muted, margin: "0 0 12px" }}
      >
        {figure}
      </Text>
    ))}
    <DigestList heading={content.wentOutHeading} lines={part.wentOut} />
    <DigestList heading={content.plannedHeading} lines={part.planned} />
    <Text style={{ ...smallText, margin: 0 }}>
      <Link href={part.calendarUrl} style={linkStyle(colors.ink)}>
        {part.calendar}
      </Link>
    </Text>
  </Section>
);

/** The weekly digest's template. */
export const WeeklyDigest = ({
  content,
  locale,
}: {
  readonly content: DigestContent;
  readonly locale: Locale;
}): ReactElement => {
  const { layout } = catalogs[locale];

  return (
    <EmailFrame locale={locale}>
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
      <FinePrint>
        {content.why.before}
        <Link href={content.preferencesUrl} style={linkStyle(colors.muted)}>
          {content.preferences}
        </Link>
        {content.why.after}
      </FinePrint>
      <FinePrint last>{layout.signature}</FinePrint>
    </EmailFrame>
  );
};
