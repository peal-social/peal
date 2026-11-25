import type { CSSProperties, ReactElement } from "react";
import { Heading } from "react-email";

import { colors } from "./theme.ts";
import { unbroken } from "./unbroken.tsx";

const looks = {
  1: {
    fontSize: "24px",
    letterSpacing: "-0.025em",
    lineHeight: "30px",
    margin: "0 0 16px",
  },
  2: { fontSize: "18px", lineHeight: "24px", margin: "0 0 12px" },
} as const satisfies Record<number, CSSProperties>;

/** What an email is about, or a part of it. */
export const Title = ({
  children,
  level = 1,
}: {
  readonly children: string;
  readonly level?: keyof typeof looks;
}): ReactElement => (
  <Heading
    as={level === 1 ? "h1" : "h2"}
    style={{ color: colors.ink, fontWeight: 600, ...looks[level] }}
  >
    {unbroken(children)}
  </Heading>
);
