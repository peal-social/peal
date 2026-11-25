import type { ReactElement, ReactNode } from "react";
import { Img } from "react-email";

import { assetUrl } from "../letterhead.ts";
import type { Letterhead } from "../letterhead.ts";
import { Divider } from "./divider.tsx";
import { Gutter } from "./gutter.tsx";
import { radii } from "./theme.ts";

/**
 * The card's foot: why the email came and who signs it, under a hairline,
 * then the glow of the site's closing band, flush with the card's bottom.
 */
export const EmailFooter = ({
  children,
  letterhead,
}: {
  readonly children: ReactNode;
  readonly letterhead: Letterhead;
}): ReactElement => (
  <>
    <Gutter bottom="8px">
      <Divider />
      {children}
    </Gutter>
    <Img
      alt=""
      height={80}
      src={assetUrl(letterhead, "footer.png")}
      style={{
        borderBottomLeftRadius: radii.insideCard,
        borderBottomRightRadius: radii.insideCard,
        height: "auto",
        maxWidth: "100%",
        width: "100%",
      }}
      width={600}
    />
  </>
);
