import { Effect, Option } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { emailAssets } from "peal-emails";

/** Where the emails' pictures are: `ReactEmailRenderer` writes it in them. */
export const emailAssetPath = "/api/email-assets/:name";

const noIndex = { "x-robots-tag": "noindex" };

// Any cache may keep a picture for a day, as it is the same for everyone.
const kept = {
  ...noIndex,
  "cache-control": "public, max-age=86400",
  "x-content-type-options": "nosniff",
};

/**
 * `GET /api/email-assets/:name` (and `HEAD`): a picture the emails show,
 * outside the contract and without credentials, as mail clients and the
 * proxies of mail services fetch it. The name is looked up among those
 * peal-emails lists, which it read as it loaded, and nowhere else; any
 * other answers 404. Every reader asks for the same addresses, their query
 * is not read, and the request is never traced (`untracedPrefixes`).
 */
export const EmailAssetsLive = HttpRouter.use((router) =>
  router.add(
    "GET",
    emailAssetPath,
    HttpRouter.params.pipe(
      Effect.map(({ name = "" }) =>
        Option.match(Option.fromUndefinedOr(emailAssets.get(name)), {
          onNone: () =>
            HttpServerResponse.empty({ headers: noIndex, status: 404 }),
          onSome: ({ bytes, contentType }) =>
            HttpServerResponse.uint8Array(bytes, {
              contentType,
              headers: kept,
            }),
        })
      )
    )
  )
);
