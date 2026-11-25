import type { ReactElement } from "react";

import { bodyText, stateDots } from "./theme.ts";

/** What is counted in one state, in words. */
export interface StatRow {
  readonly state: keyof typeof stateDots;
  readonly text: string;
}

/** Counted things, a line each, after the dot of the state they are in. */
export const StatRows = ({
  rows,
}: {
  readonly rows: readonly StatRow[];
}): ReactElement => (
  <table
    border={0}
    cellPadding={0}
    cellSpacing={0}
    role="presentation"
    style={{ margin: "0 0 16px" }}
  >
    <tbody>
      {rows.map(({ state, text }) => (
        <tr key={state}>
          <td
            aria-hidden="true"
            style={{
              color: stateDots[state],
              fontSize: "10px",
              lineHeight: "24px",
              paddingRight: "8px",
              verticalAlign: "top",
            }}
          >
            ●
          </td>
          <td style={{ ...bodyText, verticalAlign: "top" }}>{text}</td>
        </tr>
      ))}
    </tbody>
  </table>
);
