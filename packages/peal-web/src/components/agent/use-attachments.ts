"use client";

import { RegistryContext } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import type { AgentMedia } from "peal-contract/agent";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { upload } from "#media/atoms.ts";

/** A file attached to the message being written. */
export interface Attachment {
  /** The upload's own key, the file's until the library names it. */
  readonly key: string;
  readonly kind: AgentMedia["kind"];
  /** The library's id, once the file is in it. */
  readonly mediaId: string | null;
  readonly name: string;
  readonly state: "uploading" | "ready" | "failed";
}

// What the library makes of a file, from its type.
const kindOf = (file: File): AgentMedia["kind"] => {
  if (file.type.startsWith("image/")) {
    return "image";
  }

  return file.type.startsWith("video/") ? "video" : "document";
};

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
        {
          key,
          kind: kindOf(file),
          mediaId: null,
          name: file.name,
          state: "uploading",
        },
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
    /** The files ready to send, as the message will name them. */
    media: items.flatMap(({ kind, mediaId, name, state }): AgentMedia[] =>
      state === "ready" && mediaId !== null ? [{ id: mediaId, kind, name }] : []
    ),
    remove,
  };
};
