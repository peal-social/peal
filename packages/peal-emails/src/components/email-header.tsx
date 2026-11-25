import type { ReactElement } from "react";
import { Column, Img, Row } from "react-email";

import type { EmailAssetName } from "../assets.ts";
import { assetUrl } from "../letterhead.ts";
import type { Letterhead } from "../letterhead.ts";
import { gutterClass, movingClass, stillClass } from "./enhancements.ts";
import { colors, gutter, radii } from "./theme.ts";

/** Whether the header's glow moves, once, or is still. */
export type HeaderMotion = "once" | "still";

const artStyle = {
  borderTopRightRadius: radii.insideCard,
  height: "auto",
  maxWidth: "300px",
  width: "100%",
} as const;

// Shown by the stylesheet alone, under reduced motion. Outlook's Word engine
// ignores `display: none` on a picture, and takes it on what holds it; its
// size hides it where a client takes neither.
const hiddenStyle = {
  display: "none",
  fontSize: 0,
  lineHeight: 0,
  maxHeight: 0,
  msoHide: "all",
  overflow: "hidden",
} as const;

const HeaderArt = ({
  className,
  letterhead,
  name,
}: {
  readonly className?: string;
  readonly letterhead: Letterhead;
  readonly name: EmailAssetName;
}): ReactElement => (
  <Img
    alt=""
    className={className}
    height={90}
    src={assetUrl(letterhead, name)}
    style={artStyle}
    width={300}
  />
);

/**
 * The card's head: the mark and the name, as text for readers without
 * pictures, and the glow of the site's hero beside them.
 */
export const EmailHeader = ({
  letterhead,
  motion,
}: {
  readonly letterhead: Letterhead;
  readonly motion: HeaderMotion;
}): ReactElement => (
  <Row>
    <Column
      className={gutterClass}
      style={{
        paddingLeft: gutter,
        paddingRight: gutter,
        verticalAlign: "middle",
      }}
    >
      <table border={0} cellPadding={0} cellSpacing={0} role="presentation">
        <tbody>
          <tr>
            <td style={{ paddingRight: "8px", verticalAlign: "middle" }}>
              <Img
                alt=""
                height={28}
                src={assetUrl(letterhead, "mark.png")}
                width={28}
              />
            </td>
            <td
              style={{
                color: colors.ink,
                fontSize: "18px",
                fontWeight: 600,
                lineHeight: "28px",
                verticalAlign: "middle",
              }}
            >
              Peal
            </td>
          </tr>
        </tbody>
      </table>
    </Column>
    <Column
      align="right"
      style={{ height: "72px", verticalAlign: "top", width: "50%" }}
    >
      {motion === "once" ? (
        <>
          <HeaderArt
            className={movingClass}
            letterhead={letterhead}
            name="header.gif"
          />
          <div className={stillClass} style={hiddenStyle}>
            <HeaderArt letterhead={letterhead} name="header.png" />
          </div>
        </>
      ) : (
        <HeaderArt letterhead={letterhead} name="header.png" />
      )}
    </Column>
  </Row>
);
