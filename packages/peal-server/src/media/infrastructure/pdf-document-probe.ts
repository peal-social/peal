import { Duration, Effect, Option, Schema, Stream } from "effect";
import { Headers, HttpClient } from "effect/http";
import type { HttpClientError } from "effect/http";

import { MediaProbeFailed } from "#media/application/media-probe-failed.ts";
import { MediaStorageFailed } from "#media/application/media-storage-failed.ts";
import { MediaTypeMismatch } from "#media/application/media-type-mismatch.ts";
import type {
  MediaSource,
  ProbeOutcome,
} from "#media/application/ports/media-probe.ts";
import { maxByteSize, maxDocumentPages } from "#media/domain/media-format.ts";
import { MediaMetadata } from "#media/domain/media-metadata.ts";

import { readPdfArriving } from "./pdf-pages.ts";

const probeTimeout = Duration.minutes(1);

const decodeContentLength = Schema.decodeUnknownOption(Schema.FiniteFromString);

const tooLarge = (byteSize: number): boolean => byteSize > maxByteSize.document;

// A store that fails to serve the file is a storage failure, which a later
// probe can retry, not a damaged file.
const storageFailed = (cause: HttpClientError.HttpClientError) =>
  new MediaStorageFailed({ cause, operation: "read a file to probe" });

/**
 * Reads a PDF without a PDF library, as its bytes arrive from the store
 * (`readPdfArriving`): the file is up to 100 MiB, and only a few
 * mebibytes of it are held at a time, never the whole of it. It checks
 * that it starts as a PDF does (anything else was not the type declared),
 * and reads its pages from its page tree's root, a slice at a time, so
 * this probe's timeout fires on a file made to be slow. A store that
 * serves more than a document may hold is refused as it does
 * (`tooLarge`). A document of more pages than a platform shows is refused
 * (`tooManyPages`); one whose pages cannot be counted, as an encrypted
 * file, is kept without a count, for the platform to judge. The file is
 * never rendered nor run: Peal only stores it and hands it over.
 */
export const makePdfDocumentProbe = Effect.fn("PdfDocumentProbe.make")(
  function* makePdfDocumentProbe() {
    const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient);

    const readDocument = Effect.fn("PdfDocumentProbe.read")(
      function* readDocument(url: string) {
        const response = yield* client.get(url);

        // Refused before the body is read.
        const announced = Headers.get(response.headers, "content-length").pipe(
          Option.flatMap(decodeContentLength)
        );

        if (Option.exists(announced, tooLarge)) {
          return yield* new MediaProbeFailed({ reason: "tooLarge" });
        }

        let received = 0;

        // Counted as they arrive: past the most a document holds, the
        // reading stops.
        const counted = response.stream.pipe(
          Stream.mapEffect((chunk) => {
            received += chunk.length;

            return tooLarge(received)
              ? Effect.fail(new MediaProbeFailed({ reason: "tooLarge" }))
              : Effect.succeed(chunk);
          })
        );

        return yield* readPdfArriving(counted);
      },
      Effect.catchTag("HttpClientError", (cause) =>
        Effect.fail(storageFailed(cause))
      )
    );

    return Effect.fn("PdfDocumentProbe.probe")(function* probe(
      source: MediaSource
    ) {
      const read = yield* readDocument(source.url).pipe(
        Effect.timeoutOrElse({
          duration: probeTimeout,
          orElse: () =>
            Effect.fail(new MediaProbeFailed({ reason: "timedOut" })),
        })
      );

      if (read._tag === "notPdf") {
        return yield* new MediaTypeMismatch({ declared: source.contentType });
      }

      const { pages } = read;

      if (Option.exists(pages, (count) => count > maxDocumentPages)) {
        return yield* new MediaProbeFailed({ reason: "tooManyPages" });
      }

      const outcome: ProbeOutcome = {
        _tag: "probed",
        metadata: new MediaMetadata({
          codec: Option.none(),
          dimensions: Option.none(),
          duration: Option.none(),
          pages,
        }),
      };

      return outcome;
    });
  }
);
