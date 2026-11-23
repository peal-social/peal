"use client";

import { useAtomValue } from "@effect/atom-react";
import { AsyncResult, Atom } from "effect/reactivity";
import type { Media } from "peal-contract";

import { mediaItem } from "#posts/attached-media.ts";

// Media ids are UUIDs: neither a slash nor a comma appears in one.
const files = Atom.family((key: string) => {
  const [workspaceId = "", ids = ""] = key.split("/");
  const mediaIds = ids === "" ? [] : ids.split(",");

  return Atom.make((get) =>
    mediaIds.map((mediaId) => get(mediaItem(workspaceId, mediaId)))
  );
});

/** The library files a document names, once every one has answered. */
export interface LibraryFiles {
  /** Whether a file is still being read. */
  readonly loading: boolean;
  /** Each file read, by id; one the library no longer has is missing. */
  readonly byId: ReadonlyMap<string, Media>;
}

/** Reads the library's files by id, with addresses that work for an hour. */
export const useLibraryFiles = (
  workspaceId: string,
  mediaIds: readonly string[]
): LibraryFiles => {
  const results = useAtomValue(files(`${workspaceId}/${mediaIds.join(",")}`));

  return {
    byId: new Map(
      results.flatMap((result) =>
        AsyncResult.isSuccess(result) ? [[result.value.id, result.value]] : []
      )
    ),
    loading: results.some(
      (result) =>
        !AsyncResult.isSuccess(result) && !AsyncResult.isFailure(result)
    ),
  };
};
