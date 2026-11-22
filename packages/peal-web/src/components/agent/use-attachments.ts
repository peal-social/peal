"use client";

import { RegistryContext } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { upload } from "#media/atoms.ts";

/** A file attached to the message being written. */
export interface Attachment {
  /** The upload's own key, the file's until the library names it. */
  readonly key: string;
  /** The library's id, once the file is in it. */
  readonly mediaId: string | null;
  readonly name: string;
  readonly state: "uploading" | "ready" | "failed";
}

/** At most this many files a message, as the server takes. */
export const maxAttachments = 10;

/**
 * The files attached to a message: each one added to the workspace's
 * library as it is chosen (the media page's upload), then sent with the
 * message by its id. Sending waits while one is on its way.
 */
export const useAttachments = (workspaceId: string) => {
  const registry = useContext(RegistryContext);
  const [items, setItems] = useState<readonly Attachment[]>([]);
  const stops = useRef(new Map<string, () => void>());

  const change = useCallback(
    (key: string, next: Partial<Attachment>) => {
      setItems((current) =>
        current.map((item) => (item.key === key ? { ...item, ...next } : item))
      );
    },
    [setItems]
  );

  const add = (files: readonly File[]) => {
    const room = maxAttachments - items.length;

    for (const file of files.slice(0, Math.max(0, room))) {
      const key = `agent-attachment-${crypto.randomUUID()}`;
      const atom = upload(key);

      setItems((current) => [
        ...current,
        { key, mediaId: null, name: file.name, state: "uploading" },
      ]);

      const stop = registry.subscribe(atom, (result) => {
        if (AsyncResult.isSuccess(result) && !result.waiting) {
          change(key, { mediaId: result.value.id, state: "ready" });
          stops.current.get(key)?.();
        } else if (AsyncResult.isFailure(result) && !result.waiting) {
          change(key, { state: "failed" });
          stops.current.get(key)?.();
        }
      });

      stops.current.set(key, () => {
        stop();
        stops.current.delete(key);
      });

      registry.set(atom, { altText: "", file, workspaceId });
    }
  };

  const remove = (key: string) => {
    stops.current.get(key)?.();
    setItems((current) => current.filter((item) => item.key !== key));
  };

  // Nothing listens once the composer is gone.
  useEffect(
    () => () => {
      for (const stop of stops.current.values()) {
        stop();
      }
    },
    []
  );

  return {
    add,
    /** Something attached is still on its way. */
    blocked: items.some(({ state }) => state === "uploading"),
    /** Empties the list, once its files went with a message. */
    clear: () => {
      setItems([]);
    },
    items,
    /** The library's ids of the files ready to send. */
    mediaIds: items.flatMap(({ mediaId, state }) =>
      state === "ready" && mediaId !== null ? [mediaId] : []
    ),
    remove,
  };
};
