import { Config, Option } from "effect";
import { supportWebsiteId } from "peal-ui/lib/support/settings";

/**
 * The Crisp website the support chat opens (DESIGN.md, "Support chat"):
 * PEAL_CRISP_WEBSITE_ID, read at request time; none when it is unset or
 * empty, and the frame then shows no launcher. A value that is not a
 * Crisp website's id fails the page, naming the setting.
 */
export const supportChatConfig = Config.option(
  Config.String("PEAL_CRISP_WEBSITE_ID")
).pipe(
  Config.map((value) =>
    value.pipe(
      Option.flatMapNullishOr((id) =>
        supportWebsiteId(id, "PEAL_CRISP_WEBSITE_ID")
      ),
      Option.getOrNull
    )
  )
);
