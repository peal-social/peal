import {
  supportAttributes,
  supportWebsiteId,
} from "peal-ui/lib/support/settings";

// The docs' support chat, from DOCS_CRISP_WEBSITE_ID, read when the docs are
// built: the launcher the site and the blog have, from peal-ui.

const websiteId = supportWebsiteId(
  process.env.DOCS_CRISP_WEBSITE_ID,
  "DOCS_CRISP_WEBSITE_ID"
);

/** The launcher's attributes, or none while the chat is off. */
export const docsSupport = (locale: string | undefined) =>
  websiteId === undefined
    ? undefined
    : supportAttributes(websiteId, {
        locale: locale === "fr" ? "fr" : "en",
        placement: "float",
        source: "docs",
      });
