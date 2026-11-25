import type { Locale } from "../locale.ts";
import type { EmailCatalog } from "./email-catalog.ts";
import { english } from "./english.ts";
import { french } from "./french.ts";

/** Every email's words, by language. */
export const catalogs: Readonly<Record<Locale, EmailCatalog>> = {
  en: english,
  fr: french,
};
