import { Option, Schema } from "effect";

/**
 * How long a visitor's answer to the site's consent notice holds, in days:
 * peal-ui's `consentDays`, which the registry's `siteConsent` gives the
 * privacy policy.
 */
export const siteAnswerDays = 183;

const dayMs = 86_400_000;

// `peal.consent=1.a.<day>`: allowed on that day, whole days since the
// Unix epoch (peal-ui's `answerCookie`).
const AllowedSchema = Schema.String.check(
  Schema.isPattern(/^1\.a\.\d{1,6}$/u, { expected: "an allowing answer" })
);

const decodeAllowed = Schema.decodeUnknownOption(AllowedSchema);

/**
 * Whether a request's cookies hold an answer to the site's consent notice
 * that allows following the visitor at `now`: given, allowing, and less
 * than `siteAnswerDays` old.
 */
export const siteAnswerAllows = (
  cookieHeader: string | null | undefined,
  now: number
): boolean =>
  Option.match(
    Option.fromNullishOr(
      (cookieHeader ?? "")
        .split(";")
        .map((cookie) => cookie.trim())
        .find((cookie) => cookie.startsWith("peal.consent="))
    ).pipe(
      Option.flatMap((cookie) =>
        decodeAllowed(cookie.slice("peal.consent=".length))
      )
    ),
    {
      onNone: () => false,
      onSome: (answer) => {
        const age = Math.floor(now / dayMs) - Number(answer.slice(4));

        return age >= 0 && age < siteAnswerDays;
      },
    }
  );

/**
 * Whether a request's browser asks not to be followed, as the site honours
 * it: Global Privacy Control (`Sec-GPC: 1`) or Do Not Track (`DNT: 1`).
 */
export const asksNotToBeFollowed = (
  headers: Headers | null | undefined
): boolean => headers?.get("sec-gpc") === "1" || headers?.get("dnt") === "1";
