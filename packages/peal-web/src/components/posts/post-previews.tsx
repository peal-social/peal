"use client";

import { useAtomSet } from "@effect/atom-react";
import { Exit, Option } from "effect";
import { PanelRightIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { forWorkspace } from "peal-contract";
import type {
  SocialChannel,
  MediaAttachment,
  PostDraft,
  PostValidation,
} from "peal-contract";
import { Button } from "peal-ui/components/button";
import { useEffect, useEffectEvent, useReducer, useRef, useState } from "react";

import { validatePost } from "#posts/api.ts";
import { useAttachedMedia } from "#posts/attached-media.ts";
import { failureOf } from "#posts/outcome.ts";
import type { PartDraft } from "#posts/parts.ts";
import {
  noPreview,
  previewed,
  previewOf,
  previewRequestOf,
  shouldAsk,
} from "#posts/post-preview.ts";
import type { PreviewEvent, PreviewState } from "#posts/post-preview.ts";

import { PostPreviewsView } from "./post-previews-view.tsx";

// How long the composer waits after the last change before it asks.
const previewDelayMillis = 1000;

const reducer = (
  state: PreviewState<PostValidation>,
  event: PreviewEvent<PostValidation>
) => previewed(state, event);

/**
 * Asks `posts.validate` for the post as it stands, a second after the last
 * change, and only when something changed: one request at a time in
 * effect, as an answer to an older request is dropped. Nothing is asked
 * while `request` is none.
 */
const usePostPreview = (
  workspaceId: string,
  request: PostDraft | undefined
) => {
  const validate = useAtomSet(validatePost, { mode: "promiseExit" });
  const [state, dispatch] = useReducer(reducer, undefined, noPreview);
  const requests = useRef(0);
  // Bumped by "Try again": the same post, asked once more.
  const [attempt, setAttempt] = useState(0);

  const key =
    request === undefined
      ? undefined
      : `${String(attempt)}:${JSON.stringify(request)}`;

  const ask = useEffectEvent(async (asked: string) => {
    if (request === undefined) {
      return;
    }

    requests.current += 1;
    const number = requests.current;

    dispatch({ _tag: "asked", key: asked, request: number });

    const exit = await validate({
      headers: forWorkspace(workspaceId),
      payload: previewRequestOf(request),
    });

    dispatch(
      Exit.isSuccess(exit)
        ? { _tag: "answered", request: number, value: exit.value }
        : {
            _tag: "failed",
            forbidden: Option.exists(
              failureOf(exit),
              ({ _tag }) => _tag === "Forbidden"
            ),
            request: number,
          }
    );
  });

  // Nothing is asked again while the post is the one last asked about.
  // Asked once the post differs from the last one asked about, and never
  // again once the member was refused.
  const due = shouldAsk(state, key);

  useEffect(() => {
    const timer =
      due && key !== undefined
        ? window.setTimeout(() => {
            void ask(key);
          }, previewDelayMillis)
        : undefined;

    return () => {
      window.clearTimeout(timer);
    };
  }, [key, due]);

  return {
    retry: () => {
      setAttempt((count) => count + 1);
    },
    state: previewOf(state, key),
  };
};

/**
 * The composer's Preview, docked in its column (no backdrop: the post
 * stays in reach beside it), while **Preview**
 * in the page's header is pressed: what each selected channel will
 * receive, from the same request a save sends (`draft`), asked while it
 * shows, the post can be written, goes to a channel and holds no option
 * the API would refuse.
 */
export const PostPreviews = ({
  channels,
  draft,
  media,
  onClose,
  optionsTaken,
  parts,
  workspaceId,
}: {
  readonly channels: readonly SocialChannel[];
  /** What a save of the post sends now. */
  readonly draft: PostDraft;
  readonly media: readonly MediaAttachment[];
  /** Takes the panel away, as Preview in the header does. */
  readonly onClose: () => void;
  /** Whether the API takes the options as filled in. */
  readonly optionsTaken: boolean;
  readonly parts: readonly PartDraft[];
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Posts.Preview");

  const asked = optionsTaken && draft.channelIds.length > 0 ? draft : undefined;

  const { retry, state } = usePostPreview(workspaceId, asked);

  // The post's media and then each part's, read once, split back in order.
  const attached = useAttachedMedia(workspaceId, [
    ...media,
    ...parts.flatMap((part) => part.media),
  ]);

  const partMedia = parts.map((part, index) => {
    const from =
      media.length +
      parts
        .slice(0, index)
        .reduce((count, before) => count + before.media.length, 0);

    return attached.slice(from, from + part.media.length);
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-muted-foreground px-2 text-xs font-medium">
          {t("title")}
        </h2>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("close")}
          onClick={onClose}
        >
          <XIcon aria-hidden />
        </Button>
      </div>
      <PostPreviewsView
        channels={channels}
        headed={false}
        media={attached.slice(0, media.length)}
        parts={partMedia}
        selected={draft.channelIds.length}
        shortenLinks={draft.shortenLinks === true}
        state={state}
        waitingForOptions={!optionsTaken}
        onRetry={retry}
      />
    </div>
  );
};

/**
 * **Preview**, in the composer's header: a toggle that shows the
 * previews in place of the post's properties, and takes them away.
 */
export const PreviewToggle = ({
  onPressedChange,
  pressed,
  writable,
}: {
  readonly onPressedChange: (pressed: boolean) => void;
  readonly pressed: boolean;
  /** The post can still be written; otherwise nothing shows. */
  readonly writable: boolean;
}) => {
  const t = useTranslations("Posts.Preview");

  return writable ? (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={pressed}
      onClick={() => {
        onPressedChange(!pressed);
      }}
    >
      <PanelRightIcon data-icon="inline-start" aria-hidden />
      {t("open")}
    </Button>
  ) : null;
};
