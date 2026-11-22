"use client";

import { RegistryContext } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import type { Media } from "peal-contract";
import { maxAgentMessageMedia } from "peal-contract/agent";
import type { AgentMedia } from "peal-contract/agent";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

import { upload } from "#media/atoms.ts";
import { mediaItem } from "#posts/attached-media.ts";

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
export const maxAttachments = maxAgentMessageMedia;

// How long the library may take to check a file before it is given up.
const checkingFor = 2 * 60 * 1000;

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

  // Ready once the library checked the file: read again every two seconds
  // while the check is pending, failed when it ends any other way or
  // takes longer than two minutes.
  const waitUntilReady = (key: string, media: Media) => {
    const settled = (status: Media["status"]): boolean => {
      if (status._tag === "ready") {
        change(key, { state: "ready" });

        return true;
      }

      const pending =
        status._tag === "pending" ||
        (status._tag === "uploaded" && status.probe === "pending");

      if (!pending) {
        change(key, { state: "failed" });
      }

      return !pending;
    };

    if (settled(media.status)) {
      return;
    }

    const item = mediaItem(workspaceId, media.id);
    const started = Date.now();

    const stopReading = registry.subscribe(item, (result) => {
      if (AsyncResult.isSuccess(result) && settled(result.value.status)) {
        stops.current.get(key)?.();
      }
    });

    const timer = window.setInterval(() => {
      if (Date.now() - started > checkingFor) {
        change(key, { state: "failed" });
        stops.current.get(key)?.();
      } else {
        registry.refresh(item);
      }
    }, 2000);

    stops.current.set(key, () => {
      stopReading();
      window.clearInterval(timer);
      stops.current.delete(key);
    });
  };

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
          stops.current.get(key)?.();
          change(key, { mediaId: result.value.id });
          // A video may still be checked once its bytes are in.
          waitUntilReady(key, result.value);
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
