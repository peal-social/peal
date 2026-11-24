import { Effect, Option, Schema } from "effect";
import { HttpClient } from "effect/http";
import { forWorkspace } from "peal-contract";

import { fetchFrom } from "#api/client.ts";

/** The name of the file an answer's `Content-Disposition` gives, if any. */
export const fileNameOf = (disposition: string | null): string | null =>
  /filename="(?<name>[^"]+)"/u.exec(disposition ?? "")?.groups?.["name"] ??
  null;

/**
 * What the API answered a request for an export: the file, under the name
 * the server gives if it gives one; a session that ran out or was signed
 * out; a member who may not read the numbers; a workspace that now
 * requires two-step verification (the page shows its notice, as for every
 * call); or anything else, the server's or the network's.
 */
export type ExportAnswer =
  | {
      readonly _tag: "File";
      readonly file: Blob;
      readonly name: string | null;
    }
  | { readonly _tag: "Failed" | "Refused" | "SignedOut" | "TwoStepRequired" };

const decodeReason = Schema.decodeUnknownOption(
  Schema.Struct({ reason: Schema.String })
);

/**
 * Fetches an export of the workspace's analytics through the API's client,
 * so its refusals are read as every call's are (the notice of a workspace
 * that now requires two-step verification included). A link cannot carry
 * the header the API reads the workspace from, hence the fetch.
 */
export const fetchExport = (
  workspaceId: string,
  url: string,
  baseUrl = ""
): Effect.Effect<ExportAnswer> =>
  Effect.gen(function* fetched() {
    const client = yield* HttpClient.HttpClient;

    const answer = yield* client.get(url, {
      headers: forWorkspace(workspaceId),
    });

    if (answer.status === 401) {
      return { _tag: "SignedOut" as const };
    }

    if (answer.status === 403) {
      const reason = decodeReason(yield* answer.json).pipe(
        Option.map((refusal) => refusal.reason),
        Option.getOrUndefined
      );

      return reason === "twoStepRequired"
        ? { _tag: "TwoStepRequired" as const }
        : { _tag: "Refused" as const };
    }

    if (answer.status >= 300) {
      return { _tag: "Failed" as const };
    }

    const bytes = yield* answer.arrayBuffer;

    return {
      _tag: "File" as const,
      file: new Blob([bytes], {
        type: answer.headers["content-type"] ?? "text/csv",
      }),
      name: fileNameOf(answer.headers["content-disposition"] ?? null),
    };
  }).pipe(
    Effect.catch(() => Effect.succeed({ _tag: "Failed" as const })),
    Effect.provide(fetchFrom(baseUrl))
  );

/** What became of a download, for the page to tell. */
export type ExportOutcome = ExportAnswer["_tag"];

/**
 * Saves an export of the workspace's analytics under the name the server
 * gives, else `fallbackName`, and answers what became of it. The anchor is
 * put in the document for its click, as some browsers ignore one outside.
 */
export const downloadExport = async (
  workspaceId: string,
  url: string,
  fallbackName: string
): Promise<ExportOutcome> => {
  const answer = await Effect.runPromise(fetchExport(workspaceId, url));

  if (answer._tag !== "File") {
    return answer._tag;
  }

  const href = URL.createObjectURL(answer.file);
  const anchor = document.createElement("a");

  anchor.href = href;
  anchor.download = answer.name ?? fallbackName;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Some browsers start the download after the click returns.
  setTimeout(() => {
    URL.revokeObjectURL(href);
  }, 1000);

  return "File";
};
