import type { ReactElement } from "react";

import { captionText, colors, monoFamily, smallText } from "./theme.ts";

/** When something is, and what. */
export interface ListRow {
  readonly at: string;
  readonly text: string;
}

const cell = {
  borderTop: `1px solid ${colors.hairline}`,
  padding: "8px 0",
};

/** Things with a time, between hairlines, then how many more there are. */
export const ListRows = ({
  more,
  rows,
}: {
  readonly more: string | null;
  readonly rows: readonly ListRow[];
}): ReactElement => (
  <table
    border={0}
    cellPadding={0}
    cellSpacing={0}
    role="presentation"
    style={{ margin: "0 0 16px", width: "100%" }}
    width="100%"
  >
    <tbody>
      {/* Two rows may read alike; none moves. */}
      {rows.map(({ at, text }, position) => (
        <tr key={`${position}`}>
          <td style={cell}>
            <div
              style={{
                ...captionText,
                color: colors.muted,
                fontFamily: monoFamily,
              }}
            >
              {at}
            </div>
            <div style={smallText}>{text}</div>
          </td>
        </tr>
      ))}
      {more === null ? null : (
        <tr>
          <td style={{ ...cell, ...smallText, color: colors.muted }}>{more}</td>
        </tr>
      )}
    </tbody>
  </table>
);
