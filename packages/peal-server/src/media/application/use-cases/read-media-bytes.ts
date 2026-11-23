import { Effect, Stream } from "effect";

import { MediaNotReadable } from "#media/application/media-not-readable.ts";
import { getAsset } from "#media/application/ports/media-assets.ts";
import { MediaStorage } from "#media/application/ports/media-storage.ts";
import type { MediaAssetId } from "#media/domain/media-asset-id.ts";
import type {
  MediaContentType,
  MediaKind,
} from "#media/domain/media-format.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";

/** Which asset to read, and what the use takes. */
export interface ReadMediaRequest {
  readonly assetId: MediaAssetId;
  /** The kinds the use takes. */
  readonly kinds: readonly MediaKind[];
  /** The largest file the use takes, in bytes. */
  readonly maxBytes: number;
  readonly workspaceId: WorkspaceId;
}

/** A ready file's bytes, whole, with its format. */
export interface MediaBytes {
  readonly bytes: Uint8Array;
  readonly contentType: MediaContentType;
}

// The chunks as one array of bytes.
const joined = (chunks: readonly Uint8Array[]): Uint8Array => {
  const bytes = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  );

  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
};

/**
 * A ready asset's bytes, read whole from the store, for a use that sends
 * them on (a transcript): of a kind it takes and at most `maxBytes`, both
 * checked on the asset before anything is read (`MediaNotReadable`).
 */
export const readMediaBytes = Effect.fn("Media.readMediaBytes")(
  function* readMediaBytes({
    assetId,
    kinds,
    maxBytes,
    workspaceId,
  }: ReadMediaRequest) {
    const asset = yield* getAsset(workspaceId, assetId);

    if (!kinds.includes(asset.kind)) {
      return yield* new MediaNotReadable({ reason: "wrongKind" });
    }

    if (asset.status._tag !== "ready") {
      return yield* new MediaNotReadable({ reason: "notReady" });
    }

    if (asset.byteSize > maxBytes) {
      return yield* new MediaNotReadable({ reason: "tooLarge" });
    }

    const chunks = yield* MediaStorage.use((storage) =>
      Stream.runCollect(storage.read(asset.storageKey))
    );

    const bytes = joined(chunks);

    if (bytes.byteLength > maxBytes) {
      return yield* new MediaNotReadable({ reason: "tooLarge" });
    }

    const read: MediaBytes = { bytes, contentType: asset.contentType };

    return read;
  }
);
