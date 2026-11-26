"use client";

import { DateTime, Option } from "effect";
import { CopyIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { PostContentInvalid } from "peal-contract";
import type {
  ApprovalPolicy,
  ChannelSet,
  SocialChannel,
  MediaAttachment,
  Permission,
  Post,
  PostContent,
  PostDraft,
  PostSchedule,
  PostStatus,
} from "peal-contract";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import { useMemo, useRef, useState, useTransition } from "react";

import { canGenerateImages } from "#assistant/permissions.ts";
import { appliedSet } from "#channel-sets/selection.ts";
import { OfferUpgrade } from "#components/billing/offer-upgrade.tsx";
import type { MediaUploaderHandle } from "#components/media/media-uploader.tsx";
import { AddToPost } from "#components/posts/add-to-post.tsx";
import { AiLabelsNotice } from "#components/posts/ai-labels-notice.tsx";
import { AssistantMenu } from "#components/posts/assistant-menu.tsx";
import { ChannelCustomizations } from "#components/posts/channel-customizations.tsx";
import type { ChannelEntry } from "#components/posts/channel-customizations.tsx";
import { ChannelMediaField } from "#components/posts/channel-media-field.tsx";
import { ChannelsProperty } from "#components/posts/channel-picker.tsx";
import {
  SaveSelectionDialog,
  useChannelSets,
} from "#components/posts/channel-set-picker.tsx";
import { ChannelTextField } from "#components/posts/channel-text-field.tsx";
import { ComposerActions } from "#components/posts/composer-actions.tsx";
import type { ComposerAction } from "#components/posts/composer-actions.tsx";
import { ComposerErrors } from "#components/posts/composer-errors.tsx";
import {
  DefaultSignatures,
  useDefaultSigning,
} from "#components/posts/default-signatures.tsx";
import { DuplicatePost } from "#components/posts/duplicate-post.tsx";
import { EmojiMenu, useEmojiTarget } from "#components/posts/emoji-menu.tsx";
import { FollowUpParts } from "#components/posts/follow-up-parts.tsx";
import { LinkWarnings } from "#components/posts/link-warnings.tsx";
import { MediaAttachments } from "#components/posts/media-attachments.tsx";
import { PlainTextEditor } from "#components/posts/plain-text-editor.tsx";
import { PostPoll } from "#components/posts/post-poll.tsx";
import {
  PostPreviews,
  PreviewToggle,
} from "#components/posts/post-previews.tsx";
import { PostStateLine } from "#components/posts/post-state-line.tsx";
import { PostTagsField } from "#components/posts/post-tags-field.tsx";
import { useChosenQueue } from "#components/posts/queue-choice.tsx";
import type { Placement } from "#components/posts/queue-choice.tsx";
import { instantOfChoice } from "#components/posts/schedule-fields.tsx";
import type { ScheduleChoice } from "#components/posts/schedule-fields.tsx";
import {
  savableWith,
  ShortenLinks,
  textsOf,
  useShortLinking,
} from "#components/posts/shorten-links.tsx";
import { SignatureMenu } from "#components/posts/signature-menu.tsx";
import { SignaturePause } from "#components/posts/signature-pause.tsx";
import {
  TargetOptionsPanel,
  takesOptions,
} from "#components/posts/target-options-panel.tsx";
import { TargetStatuses } from "#components/posts/target-statuses.tsx";
import { useAiLabels } from "#components/posts/use-ai-labels.ts";
import { WhenProperty } from "#components/posts/when-property.tsx";
import { PageActions, PageTitle } from "#components/shell/frame-view.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { useTimeOptions } from "#i18n/hour-cycle.ts";
import { getPathname, useRouter } from "#i18n/navigation.ts";
import { useAttachedMedia } from "#posts/attached-media.ts";
import {
  channelMediaOf,
  channelTextsOf,
  isUnwritten,
  mediaWaitingForText,
  overridesFrom,
  withChannelMedia,
} from "#posts/channel-media.ts";
import type { ByChannel, ChannelMedia } from "#posts/channel-media.ts";
import { connectedTargets } from "#posts/channel-selection.ts";
import { fitOn, fits } from "#posts/character-count.ts";
import { capabilitiesOf } from "#posts/composer-capabilities.ts";
import { composerTitleOf } from "#posts/composer-title.ts";
import {
  mediaFitOn,
  mediaFits,
  showsAltText,
  showsPhotosOnly,
} from "#posts/media-fit.ts";
import type { AttachedMedia } from "#posts/media-fit.ts";
import { oneAtATime } from "#posts/one-at-a-time.ts";
import {
  chosenOptionsCount,
  copiedOptions,
  copiesOptions,
  missingRequired,
  refusedChannelsOf,
  violationsOf,
} from "#posts/option-rows.ts";
import { addPart, followUpsOf, partsFitOn, partsOf } from "#posts/parts.ts";
import type { PartDraft } from "#posts/parts.ts";
import { newPoll, pollContentOf, pollFitsOn, pollOf } from "#posts/poll.ts";
import type { PollDraft } from "#posts/poll.ts";
import { postViewPath } from "#posts/post-list-filter.ts";
import { publishNowOf, whereItGoes } from "#posts/publish-now.ts";
import { queuedSlotFormat, queuedSlotWeek } from "#posts/queued-slot.ts";
import { startChoiceOf } from "#posts/start-time.ts";
import {
  channelOptionsOf,
  initialValues,
  mediaKindsOf,
  valuesOfPost,
} from "#posts/target-options.ts";
import type { OptionValues, ValuesByChannel } from "#posts/target-options.ts";
import { usePartsOffered } from "#posts/use-parts-offered.ts";
import { usePostRequests } from "#posts/use-post-requests.ts";
import {
  browserTimeZone,
  dateKey,
  timeKey,
  wallClockOf,
} from "#posts/zoned-time.ts";
import { withSignatureUnderLastPart } from "#signatures/insert.ts";
import { pausesToCheck } from "#signatures/signing-pause.ts";

const utcZone = "UTC";

// The next full hour on the zone's clock: where a new post starts.
const nextHour = (timeZone: string): ScheduleChoice =>
  Option.match(
    wallClockOf(DateTime.add(DateTime.nowUnsafe(), { hours: 1 }), timeZone),
    {
      onNone: () => nextHour(utcZone),
      onSome: ({ date, time }) => ({
        date,
        time: timeKey({ hour: time.hour, minute: 0 }),
        timeZone,
      }),
    }
  );

// A scheduled post's time, on the clock of the zone it was scheduled in.
const choiceOf = (schedule: PostSchedule | null): ScheduleChoice =>
  schedule === null
    ? nextHour(browserTimeZone())
    : Option.match(wallClockOf(schedule.at, schedule.timeZone), {
        onNone: () => nextHour(browserTimeZone()),
        onSome: ({ date, time }) => ({
          date,
          time: timeKey(time),
          timeZone: schedule.timeZone,
        }),
      });

// Saves the channels chosen as a set, for a member who may change posts
// while the post is written; none otherwise.
const savesSet = (
  writable: boolean,
  permissions: readonly Permission[],
  open: () => void
) => (writable && permissions.includes("post:update") ? open : undefined);

// The overrides with the channel's own text, or without it.
const withOverride = (
  overrides: Readonly<Record<string, string>>,
  channelId: string,
  own: string | undefined
): Record<string, string> => {
  const others = Object.entries(overrides).filter(([id]) => id !== channelId);

  const entry: [string, string][] = own === undefined ? [] : [[channelId, own]];

  return Object.fromEntries([...others, ...entry]);
};

// What the post says, from the composer's fields: a text, and media, of
// its own only for the channels it goes to (`overridesFrom`), then the
// parts that follow it.
const contentOf = (
  composed: ByChannel,
  media: readonly MediaAttachment[],
  parts: readonly PartDraft[],
  poll: PollDraft | undefined
): PostContent => ({
  followUps: followUpsOf(parts, composed.channelIds),
  media,
  overrides: overridesFrom(composed),
  ...pollContentOf(poll),
  text: composed.text,
});

type Translate = ReturnType<typeof useTranslations<"Posts.Composer">>;

// Whether the post may be saved: the server's short links known, no
// option it would refuse, and no channel's media waiting for a text.
const savableUnless = (
  linking: Parameters<typeof savableWith>[0],
  problems: readonly unknown[],
  blocked: string | undefined
) => savableWith(linking, problems.length === 0 && blocked === undefined);

// Why the post is neither saved nor scheduled while channels have media
// of their own and no text to go out with; none otherwise.
const ownMediaBlock = (
  t: Translate,
  list: ReturnType<typeof useFormatter>["list"],
  selected: readonly SocialChannel[],
  waiting: readonly string[]
) =>
  waiting.length === 0
    ? undefined
    : t("ownMediaBlocks", {
        handles: list(
          selected.flatMap(({ handle, id }) =>
            waiting.includes(id) ? [handle] : []
          ),
          { type: "conjunction" }
        ),
      });

const noticeOf = (
  t: Translate,
  status: PostStatus,
  {
    canSchedule,
    canWrite,
    willWait,
  }: { canSchedule: boolean; canWrite: boolean; willWait: boolean }
) => {
  if (status === "awaitingApproval") {
    return t("awaitingText");
  }

  if (status === "scheduled") {
    return t("lockedText");
  }

  if (status !== "draft") {
    return t("readOnly");
  }

  if (!canWrite) {
    return t("notAllowed");
  }

  if (!canSchedule) {
    return t("cannotSchedule");
  }

  return willWait ? t("willWait") : null;
};

const calendarOf = (
  href: (workspaceId: string, rest?: string) => string,
  workspaceId: string,
  date: ScheduleChoice["date"]
) => href(workspaceId, `/posts?layout=calendar&date=${dateKey(date)}`);

// What the composer starts with: the post's, or nothing for a new one.
const startOf = (post: Post | undefined) => ({
  media: post?.content.media ?? [],
  schedule: post?.schedule ?? null,
  tagIds: post?.tagIds ?? [],
  text: post?.content.text ?? "",
});

interface ComposerProps {
  /** Which of the workspace's posts wait for an approval; none while unknown. */
  readonly approvalPolicy: ApprovalPolicy | undefined;
  readonly channels: readonly SocialChannel[];
  readonly permissions: readonly Permission[];
  /** None for a new post. */
  readonly post: Post | undefined;
  /** Where a new post's schedule starts, as `?at=` wrote it; none otherwise. */
  readonly startAt?: string | undefined;
  /** The signed-in user. */
  readonly userId: string;
  readonly workspaceId: string;
}

// Writes a post: its text, a text of its own on some channels, its images
// and videos, the parts that follow it in a thread, the options of the
// channels whose platform takes some, where it goes and when. A draft is saved as it is, or discarded; scheduling
// checks it against each platform's limits, which the counters show as the
// user types, and the options each platform needs, which the options fields
// show once scheduling refused them. A scheduled post keeps its text and
// options, and can be moved, cancelled, or taken back to draft to change
// them.
export const Composer = ({
  approvalPolicy,
  channels,
  permissions,
  post,
  startAt,
  userId,
  workspaceId,
}: ComposerProps) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("Posts.Composer");
  const tPosts = useTranslations("Posts");
  const tOptions = useTranslations("Posts.Options");
  const tSets = useTranslations("ChannelSets");
  const format = useFormatter();
  const timeOptions = useTimeOptions();
  const router = useRouter();
  const locale = useLocale();
  const requests = usePostRequests(workspaceId);
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<ComposerAction | null>(null);
  const guard = useMemo(() => oneAtATime(), []);

  const start = startOf(post);
  const [text, setText] = useState(start.text);
  // Counts the texts accepted from the assistant: each starts fresh editors.
  const [accepted, setAccepted] = useState(0);

  const [overrides, setOverrides] = useState(() =>
    channelTextsOf(post?.content)
  );

  // The media some channels show instead of the post's, by channel.
  const [channelMedia, setChannelMedia] = useState<ChannelMedia>(() =>
    channelMediaOf(post?.content)
  );

  // The options each channel's fields hold, by channel.
  const [optionValues, setOptionValues] = useState<ValuesByChannel>(() =>
    valuesOfPost(post, (channelId) =>
      Option.fromUndefinedOr(
        channels.find(({ id }) => id === channelId)?.platform
      )
    )
  );

  const [media, setMedia] = useState<readonly MediaAttachment[]>(start.media);

  // The parts that follow the post, in order.
  const [parts, setParts] = useState<readonly PartDraft[]>(() =>
    partsOf(post?.content)
  );

  // The poll it asks with its first part, if any.
  const [poll, setPoll] = useState<PollDraft | undefined>(() => pollOf(post));

  const partsOffered = usePartsOffered(workspaceId);

  const [channelIds, setChannelIds] = useState<readonly string[]>(() =>
    connectedTargets(post, channels)
  );

  const [tagIds, setTagIds] = useState<readonly string[]>(start.tagIds);

  // A time chosen, or a queue's next free slot.
  const [placement, setPlacement] = useState<Placement>({ _tag: "time" });
  // Whether the column shows the previews instead of the properties.
  const [previewing, setPreviewing] = useState(false);
  // Whether the dialog that saves the channels as a set is open.
  const [savingSet, setSavingSet] = useState(false);
  const queueId = useChosenQueue(workspaceId, placement);

  const [choice, setChoice] = useState<ScheduleChoice>(() =>
    Option.getOrElse(
      startChoiceOf(startAt, browserTimeZone(), DateTime.nowUnsafe()),
      () => choiceOf(start.schedule)
    )
  );

  // A new post is saved once, then updated. It gets its own address, without
  // leaving the page, so what the composer shows, errors included, stays.
  const [postId, setPostId] = useState(post?.id);

  const {
    canCancel,
    canDiscard,
    canReschedule,
    canSchedule,
    canUnschedule,
    canWrite,
    status,
    willWait,
  } = capabilitiesOf({
    approvalPolicy,
    permissions,
    post,
    saved: postId !== undefined,
    userId,
  });

  const busy = isPending ? action : null;
  const channelSets = useChannelSets(workspaceId, canWrite);
  const locked = !canWrite || busy !== null;
  const signing = useDefaultSigning(workspaceId, postId === undefined);
  const linking = useShortLinking(workspaceId, post);
  // Whether scheduling stopped for the person to read the signed text.
  const [signedPause, setSignedPause] = useState(false);

  const selected = channelIds.flatMap((channelId) =>
    channels.filter(({ id }) => id === channelId)
  );

  const composed: ByChannel = { channelIds, channelMedia, overrides, text };
  const content = contentOf(composed, media, parts, poll);
  const waitingForText = mediaWaitingForText(composed);

  const attached = useAttachedMedia(workspaceId, media);

  const ownAttached = useAttachedMedia(
    workspaceId,
    Object.values(channelMedia).flat()
  );

  // A channel's own media with their files once read; none while it shows
  // the post's.
  const ownAttachedOn = (channelId: string) =>
    channelMedia[channelId]?.map((item): AttachedMedia => ({
      altText: item.altText,
      media:
        ownAttached.find(({ mediaId }) => mediaId === item.mediaId)?.media ??
        Option.none(),
      mediaId: item.mediaId,
    }));

  // What the channel shows: its own media, or the post's.
  const attachedOn = (channelId: string) =>
    ownAttachedOn(channelId) ?? attached;

  // Files pasted into the post's texts are uploaded and attached to it.
  const uploader = useRef<MediaUploaderHandle>(null);
  // Names the parts the text's toolbar adds, apart from those
  // `FollowUpParts` adds (`added-…`) and the post's own.
  const partsAdded = useRef(0);
  const emoji = useEmojiTarget();

  // The kinds of the attached media, which some options follow; unknown,
  // so every option shows, while one is still being read.
  const mediaKinds = mediaKindsOf(attached);

  // Every attachment of the post, its follow-up parts' included: media
  // made by AI in any part presets the AI labels.
  const everyAttached = useAttachedMedia(workspaceId, [
    ...media,
    ...Object.values(channelMedia).flat(),
    ...parts.flatMap((part) => part.media),
  ]);

  const aiLabels = useAiLabels({
    attached: everyAttached,
    optionValues,
    post,
    selected,
    setOptionValues,
    writable: canWrite,
  });

  // The options to send, and what is wrong with those filled in: while
  // anything is, the post is neither saved nor scheduled. An option the
  // media hide is not sent; a channel whose AI label was settled always
  // sends its options, so the label is kept as chosen.
  const { options, problems: optionProblems } = channelOptionsOf(
    selected,
    optionValues,
    mediaKinds,
    aiLabels.labelled
  );

  // Nothing is saved before the server says whether it shortens links, so
  // a new post takes the workspace's default.
  // A channel's own media with no text to go out with: nothing is saved,
  // so they are never lost silently, and the actions say why.
  const blocked = ownMediaBlock(t, format.list, selected, waitingForText);

  const optionsTaken = savableUnless(linking, optionProblems, blocked);

  // What a save sends, which the previews check too.
  const draft: PostDraft = {
    channelIds,
    content,
    options,
    tagIds,
    ...signing.payload,
    ...linking.payload,
  };

  const optionsOfChannel = (channelId: string) =>
    options.find((chosen) => chosen.channelId === channelId)?.options;

  const valuesOn = (channel: SocialChannel): OptionValues =>
    optionValues[channel.id] ?? initialValues(channel.platform);

  const channelFits = selected.map((channel) => {
    const own = content.overrides.find(
      ({ channelId }) => channelId === channel.id
    );

    return {
      channel,
      fit: fitOn(
        channel.platform,
        own?.text ?? text,
        attachedOn(channel.id).length,
        optionsOfChannel(channel.id)
      ),
      media: mediaFitOn(
        channel.platform,
        attachedOn(channel.id),
        optionsOfChannel(channel.id)
      ),
    };
  });

  // Whether every channel takes the parts that follow and the poll, as
  // the server will check them.
  const partsFit = [
    partsFitOn(selected, parts, optionsOfChannel, partsOffered),
    pollFitsOn(selected, poll, (id) => attachedOn(id).length, optionsOfChannel),
  ].every(Boolean);

  const formatted = (at: DateTime.Utc, timeZone?: string) =>
    format.dateTime(DateTime.toDate(at), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timeZone ?? choice.timeZone,
      ...timeOptions,
    });

  // A post put on a queue: told the time it got there, on the queue's
  // clock with its zone named.
  const placed = (queued: Post) => {
    if (queued.schedule === null) {
      return;
    }

    const { at, timeZone } = queued.schedule;

    toast.success(
      t(queued.status === "awaitingApproval" ? "queuedForApproval" : "queued", {
        at: format.dateTime(DateTime.toDate(at), {
          ...queuedSlotFormat(timeZone),
          ...timeOptions,
        }),
      })
    );
  };

  // The calendar, on the week of the slot a queue gave the post.
  const toSlotWeek = (queued: Post) => {
    const week =
      queued.schedule === null
        ? undefined
        : queuedSlotWeek(queued.schedule, browserTimeZone());

    router.push(
      week === undefined
        ? workspaceHref(workspaceId, "/posts?layout=calendar")
        : calendarOf(workspaceHref, workspaceId, week)
    );
  };

  const opened = (saved: Post) => {
    if (postId === undefined) {
      const signed = signing.textsOf(saved);

      // A new draft takes the defaults of the channels it was sent no
      // options for: the fields show them, and the next save keeps them.
      setOptionValues((current) => ({
        ...current,
        ...valuesOfPost(saved, (channelId) =>
          Option.fromUndefinedOr(
            channels.find(({ id }) => id === channelId)?.platform
          )
        ),
      }));

      // Saved with the default signatures: the texts are now the server's.
      if (signed !== undefined) {
        setText(signed.text);
        setOverrides(signed.overrides);
        // A post of several parts is signed under its last.
        setParts(partsOf(saved.content));
        setAccepted((count) => count + 1);
      }

      setPostId(saved.id);
      window.history.replaceState(
        null,
        "",
        getPathname({
          href: workspaceHref(workspaceId, `/posts/${saved.id}`),
          locale,
        })
      );
    }
  };

  // A post sent out now, or held for an approval after all: its page shows
  // how it goes.
  const wentOut = (sent: Post, at: DateTime.Utc) => {
    toast.success(
      sent.status === "awaitingApproval"
        ? t("sentForApproval", { at: formatted(at, browserTimeZone()) })
        : t("publishedNow")
    );
    router.push(workspaceHref(workspaceId, `/posts/${sent.id}`));
  };

  const saveDraft = async () => {
    if (!optionsTaken) {
      return;
    }

    const saved = await requests.save(postId, draft);

    if (Option.isSome(saved)) {
      toast.success(t("saved"));
      opened(saved.value);
    }
  };

  // Schedules the draft at the time chosen, on the queue chosen, or, for
  // "Publish now", at `now` on the viewer's clock: the same save, signature
  // pause and request either way.
  const scheduleDraft = async (now?: DateTime.Utc) => {
    const at = now === undefined ? instantOfChoice(choice) : Option.some(now);
    const timeZone = now === undefined ? choice.timeZone : browserTimeZone();
    const queued = now === undefined && placement._tag === "queue";

    if (!queued && Option.isNone(at)) {
      requests.fail({ _tag: "InvalidTime" });

      return;
    }

    if (!optionsTaken) {
      return;
    }

    const saved = await requests.save(postId, draft);

    const [first, ...rest] = channelIds;

    if (Option.isNone(saved)) {
      return;
    }

    // Just created with the default signatures, which no counter counted:
    // the person reads the text as saved, then chooses Schedule again.
    if (
      pausesToCheck({
        asked: signing.payload.defaultSignatures === true,
        created: postId === undefined,
        saved: saved.value,
        sent: content,
      })
    ) {
      opened(saved.value);
      setSignedPause(true);

      return;
    }

    // On a queue, a draft for no channel takes the queue's.
    if (queued) {
      // No queue read yet: the server takes the default.
      const enqueued = await requests.enqueue(
        saved.value.id,
        Option.match(queueId, {
          onNone: () => ({}),
          onSome: (id) => ({ queueId: id }),
        })
      );

      if (Option.isNone(enqueued)) {
        opened(saved.value);

        return;
      }

      placed(enqueued.value);
      toSlotWeek(enqueued.value);

      return;
    }

    if (first === undefined || Option.isNone(at)) {
      requests.fail(
        new PostContentInvalid({ violations: [{ _tag: "noChannels" }] })
      );
      opened(saved.value);

      return;
    }

    const scheduled = await requests.schedule(saved.value.id, {
      at: at.value,
      channelIds: [first, ...rest],
      timeZone,
    });

    if (Option.isNone(scheduled)) {
      opened(saved.value);

      return;
    }

    if (now !== undefined) {
      wentOut(scheduled.value, now);

      return;
    }

    toast.success(
      t(
        scheduled.value.status === "awaitingApproval"
          ? "sentForApproval"
          : "scheduled",
        { at: formatted(at.value) }
      )
    );
    router.push(calendarOf(workspaceHref, workspaceId, choice.date));
  };

  // Moves the post to the time chosen, to its queue's next free slot, or,
  // for "Publish now", to `now` on the viewer's clock.
  const move = async (id: string, now?: DateTime.Utc) => {
    if (now !== undefined) {
      const moved = await requests.reschedule(id, {
        at: now,
        timeZone: browserTimeZone(),
      });

      if (Option.isSome(moved)) {
        wentOut(moved.value, now);
      }

      return;
    }

    if (placement._tag === "queue") {
      const queued = await requests.enqueue(
        id,
        Option.match(queueId, {
          onNone: () => ({}),
          onSome: (chosen) => ({ queueId: chosen }),
        })
      );

      if (Option.isSome(queued)) {
        placed(queued.value);
        opened(queued.value);
      }

      return;
    }

    const at = instantOfChoice(choice);

    if (Option.isNone(at)) {
      requests.fail({ _tag: "InvalidTime" });

      return;
    }

    const moved = await requests.reschedule(id, {
      at: at.value,
      timeZone: choice.timeZone,
    });

    if (Option.isSome(moved)) {
      toast.success(t("rescheduled", { at: formatted(at.value) }));
    }
  };

  const cancel = async (id: string) => {
    const cancelled = await requests.cancel(id);

    if (Option.isSome(cancelled)) {
      toast.success(t("cancelled"));
      router.push(calendarOf(workspaceHref, workspaceId, choice.date));
    }
  };

  const unschedule = async (id: string) => {
    const unscheduled = await requests.unschedule(id);

    if (Option.isSome(unscheduled)) {
      toast.success(t("unscheduled"));
    }
  };

  const discard = async (id: string) => {
    if (await requests.discard(id)) {
      toast.success(t("discarded"));
      router.push(workspaceHref(workspaceId, postViewPath("drafts")));
    }
  };

  const work: Record<ComposerAction, () => Promise<void>> = {
    cancel: async () => {
      if (post !== undefined) {
        await cancel(post.id);
      }
    },
    discard: async () => {
      if (postId !== undefined) {
        await discard(postId);
      }
    },
    // "Now" is when the person confirmed, before the save.
    publishNow: async () => {
      const now = DateTime.nowUnsafe();

      if (status === "draft") {
        await scheduleDraft(now);
      } else if (post !== undefined) {
        await move(post.id, now);
      }
    },
    reschedule: async () => {
      if (post !== undefined) {
        await move(post.id);
      }
    },
    save: saveDraft,
    schedule: async () => {
      await scheduleDraft();
    },
    unschedule: async () => {
      if (post !== undefined) {
        await unschedule(post.id);
      }
    },
  };

  // One action at a time, refused synchronously: a double click on a
  // dialog's confirm button, still clickable while it closes, sends nothing
  // twice.
  const perform = (next: ComposerAction) => {
    startTransition(async () => {
      await guard.run(async () => {
        setAction(next);
        setSignedPause(false);
        await work[next]();
      });
    });
  };

  const notice = noticeOf(t, status, { canSchedule, canWrite, willWait });
  const schedulable = canWrite && canSchedule;

  const publishable =
    channelFits.every(
      ({ fit, media: mediaFit }) => fits(fit) && mediaFits(mediaFit)
    ) &&
    partsFit &&
    optionsTaken;

  // The channels whose options the last request refused: their rows open.
  const refused = refusedChannelsOf(requests.failure);
  const violations = violationsOf(requests.failure);

  const entries: readonly ChannelEntry[] = channelFits.map(
    ({ channel, fit, media: mediaFit }) => {
      const values = optionValues[channel.id];

      return {
        attention:
          refused.includes(channel.id) ||
          waitingForText.includes(channel.id) ||
          optionProblems.some(({ channelId }) => channelId === channel.id),
        channel,
        fit,
        media: mediaFit,
        missing: missingRequired(channel.platform, values, mediaKinds),
        optionsChosen: chosenOptionsCount(channel.platform, values),
        ownMedia: channelMedia[channel.id] !== undefined,
        ownText: (overrides[channel.id] ?? "").trim() !== "",
      };
    }
  );

  // Gives a channel's options to the other channels of its platform the
  // post goes to, but what each account holds of its own.
  const shareOptions = (channel: SocialChannel) => {
    const others = selected.filter(
      ({ id, platform }) => platform === channel.platform && id !== channel.id
    );

    const from = valuesOn(channel);

    for (const other of others) {
      const values = copiedOptions(
        channel.platform,
        from,
        optionValues[other.id]
      );

      aiLabels.changed(other.id, values);
      setOptionValues((current) => ({ ...current, [other.id]: values }));
    }

    toast.success(
      t("optionsCopied", {
        count: others.length,
        platform: tPosts("platform", { platform: channel.platform }),
      })
    );
  };

  // Starts the post from a channel set: its connected channels, and the
  // options it keeps for them; a channel no longer connected is told.
  const applySet = (set: ChannelSet) => {
    const applied = appliedSet(set, channels);

    setChannelIds(applied.channelIds);
    setOptionValues((current) => ({ ...current, ...applied.values }));

    if (applied.dropped > 0) {
      toast.warning(
        tSets("pickerDropped", { count: applied.dropped, name: set.name })
      );
    }
  };

  // The first part after the post, from the text's toolbar.
  const addFirstPart = () => {
    partsAdded.current += 1;

    const key = `first-${String(partsAdded.current)}`;

    setParts((current) => addPart(current, key));
  };

  const insertSignature = (
    channelId: string | undefined,
    signature: string
  ) => {
    // A post of several parts is signed under its last.
    const signed = withSignatureUnderLastPart(
      { overrides, parts, text },
      channelId,
      signature
    );

    setText(signed.text);
    setOverrides(signed.overrides);
    setParts(signed.parts);
    setAccepted((count) => count + 1);
  };

  // What a channel's row holds once open, as a property list: its text,
  // its images and videos, then its platform's options.
  const channelBody = (channel: SocialChannel) => {
    const platform = tPosts("platform", { platform: channel.platform });

    const sharing = selected.filter(
      ({ platform: on }) => on === channel.platform
    ).length;

    return (
      <div className="flex flex-col gap-3">
        <ChannelTextField
          key={`${channel.id}/${String(accepted)}`}
          channel={channel}
          readOnly={locked}
          value={overrides[channel.id] ?? ""}
          onEditorFocus={emoji.handleFocus}
          onPasteFiles={(files) => uploader.current?.add(files) ?? false}
          onOverride={(channelId, own) => {
            setOverrides((current) => withOverride(current, channelId, own));
          }}
        />
        <ChannelMediaField
          canBrowse={permissions.includes("media:read")}
          canGenerate={canGenerateImages(permissions)}
          canUpload={permissions.includes("media:upload")}
          channel={channel}
          disabled={locked}
          editable={canWrite}
          own={ownAttachedOn(channel.id)}
          platforms={
            showsAltText(channel.platform, optionsOfChannel(channel.id))
              ? [channel.platform]
              : []
          }
          postMedia={media}
          waitingForText={waitingForText.includes(channel.id)}
          workspaceId={workspaceId}
          onChange={(update) => {
            setChannelMedia((current) =>
              withChannelMedia(
                current,
                channel.id,
                update(current[channel.id] ?? [])
              )
            );
          }}
        />
        {takesOptions([channel], mediaKinds) ? (
          <TargetOptionsPanel
            bare
            channels={[channel]}
            disabled={locked}
            media={mediaKinds}
            photos={showsPhotosOnly(attached)}
            workspaceId={workspaceId}
            valuesOf={valuesOn}
            violations={violations}
            onChange={(channelId, values) => {
              aiLabels.changed(channelId, values);
              setOptionValues((current) => ({
                ...current,
                [channelId]: values,
              }));
            }}
          />
        ) : null}
        {takesOptions([channel], mediaKinds) &&
        canWrite &&
        sharing > 1 &&
        copiesOptions(channel.platform) ? (
          <div>
            <Button
              variant="ghost"
              size="xs"
              disabled={locked}
              focusableWhenDisabled
              onClick={() => {
                shareOptions(channel);
              }}
            >
              <CopyIcon data-icon="inline-start" aria-hidden />
              {t("useForEvery", { count: sharing - 1, platform })}
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <PageTitle>{t(composerTitleOf(post, postId !== undefined))}</PageTitle>
      <PageActions>
        <PreviewToggle
          pressed={previewing}
          writable={canWrite}
          onPressedChange={setPreviewing}
        />
      </PageActions>
      <div className="grid gap-y-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-x-10">
        <aside
          aria-label={t("propertiesLabel")}
          className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1"
        >
          {previewing ? (
            <PostPreviews
              channels={channels}
              draft={draft}
              media={media}
              optionsTaken={optionsTaken}
              parts={parts}
              workspaceId={workspaceId}
              onClose={() => {
                setPreviewing(false);
              }}
            />
          ) : (
            <>
              <ChannelsProperty
                channels={channels}
                connectHref={
                  permissions.includes("channel:connect")
                    ? workspaceHref(workspaceId, "/channels/new")
                    : null
                }
                disabled={locked}
                selected={channelIds}
                sets={channelSets}
                onApplySet={applySet}
                onChange={setChannelIds}
                onSaveSet={savesSet(canWrite, permissions, () => {
                  setSavingSet(true);
                })}
              />
              <WhenProperty
                choice={choice}
                placement={placement}
                workspaceId={workspaceId}
                disabled={!(canSchedule || canReschedule) || busy !== null}
                onChoice={setChoice}
                onPlacement={setPlacement}
              />
              <PostTagsField
                property
                disabled={busy !== null}
                permissions={permissions}
                savedOn={canWrite ? undefined : postId}
                tagIds={tagIds}
                workspaceId={workspaceId}
                onChange={setTagIds}
              />
              {post === undefined || status === "draft" ? null : (
                <TargetStatuses channels={channels} post={post} />
              )}
            </>
          )}
        </aside>
        <div className="flex min-w-0 flex-col gap-8 lg:col-start-1 lg:row-start-1">
          <PostStateLine
            post={post}
            status={status}
            viewerId={userId}
            workspaceId={workspaceId}
          />
          {notice === null ? null : (
            <p className="text-muted-foreground text-sm">{notice}</p>
          )}
          <section aria-labelledby="text-title" className="flex flex-col gap-2">
            <h2 id="text-title" className="sr-only">
              {t("textLegend")}
            </h2>
            <span id="text-label" className="sr-only">
              {t("textLabel")}
            </span>
            <PlainTextEditor
              key={accepted}
              bare
              id="post-text"
              labelledBy="text-label"
              describedBy="text-hint"
              placeholder={t("textPlaceholder")}
              readOnly={locked}
              value={text}
              onChange={setText}
              onEditorFocus={emoji.handleFocus}
              onEditorReady={emoji.handleMain}
              onPasteFiles={(files) => uploader.current?.add(files) ?? false}
            />
            <p id="text-hint" className="sr-only">
              {t("textHint")}
            </p>
            <MediaAttachments
              attached={attached}
              canBrowse={permissions.includes("media:read")}
              canGenerate={canGenerateImages(permissions)}
              canUpload={permissions.includes("media:upload")}
              disabled={locked}
              editable={canWrite}
              platforms={selected.flatMap(({ id, platform }) =>
                showsAltText(platform, optionsOfChannel(id)) ? [platform] : []
              )}
              toolbar={{
                // After the media's buttons, the text's tools, then the
                // assistant at the toolbar's end.
                end: (
                  <>
                    <EmojiMenu disabled={locked} target={emoji.target} />
                    <AddToPost
                      disabled={locked}
                      hasParts={parts.length > 0}
                      hasPoll={poll !== undefined}
                      writable={canWrite}
                      onPart={addFirstPart}
                      onPoll={() => {
                        setPoll(newPoll());
                      }}
                    />
                    <SignatureMenu
                      channels={selected}
                      disabled={locked}
                      workspaceId={workspaceId}
                      onInsert={insertSignature}
                    />
                    <span className="flex-1" />
                    <AssistantMenu
                      disabled={locked}
                      permissions={permissions}
                      platforms={selected.map(({ platform }) => platform)}
                      showsMedia={media.length > 0}
                      text={text}
                      workspaceId={workspaceId}
                      onAccept={(suggested) => {
                        setText(suggested);
                        setAccepted((count) => count + 1);
                      }}
                    />
                  </>
                ),
              }}
              uploader={uploader}
              workspaceId={workspaceId}
              onChange={setMedia}
            />
            <AiLabelsNotice labels={aiLabels} />
            <LinkWarnings
              texts={[text, ...content.overrides.map((own) => own.text)]}
            />
            <DefaultSignatures disabled={locked} signing={signing} />
            <ShortenLinks
              disabled={locked}
              linking={linking}
              platforms={selected.map(({ platform }) => platform)}
              texts={textsOf(content)}
            />
          </section>
          {/* Offered from the text's toolbar: each shows once it is used. */}
          {poll === undefined ? null : (
            <PostPoll
              disabled={locked}
              editable={canWrite}
              mediaOn={(id) => attachedOn(id).length}
              optionsOn={optionsOfChannel}
              poll={poll}
              selected={selected}
              onChange={setPoll}
            />
          )}
          {parts.length === 0 ? null : (
            <FollowUpParts
              disabled={locked}
              editable={canWrite}
              offered={partsOffered}
              options={options}
              parts={parts}
              permissions={permissions}
              selected={selected}
              workspaceId={workspaceId}
              onChange={setParts}
              onEditorFocus={emoji.handleFocus}
            />
          )}
          {/* There once the post goes somewhere. */}
          {entries.length === 0 ? null : (
            <section
              aria-labelledby="each-channel-title"
              className="flex flex-col gap-2"
            >
              <h2
                id="each-channel-title"
                className="text-muted-foreground text-xs font-medium"
              >
                {t("eachChannelTitle")}
              </h2>
              {optionProblems.length > 0 ? (
                <output className="text-destructive-text text-xs">
                  {tOptions("fixToSend")}
                </output>
              ) : null}
              <ChannelCustomizations
                bodyOf={channelBody}
                entries={entries}
                opens={[
                  ...new Set([
                    ...refused,
                    ...optionProblems.map(({ channelId }) => channelId),
                  ]),
                ]}
                unwritten={isUnwritten(composed, media)}
              />
            </section>
          )}
          <SignaturePause shown={signedPause} willWait={willWait} />
          <ComposerErrors
            channels={channels}
            failure={requests.failure}
            media={attached}
          />
          <OfferUpgrade failure={requests.failure} />
        </div>
      </div>
      <SaveSelectionDialog
        channelIds={channelIds}
        open={savingSet}
        options={options}
        workspaceId={workspaceId}
        onOpenChange={setSavingSet}
      />
      <div className="bg-card sticky bottom-0 z-10 mt-8 border-t py-3">
        <ComposerActions
          busy={busy}
          canSave={canWrite}
          savable={optionsTaken}
          blocked={blocked}
          canSchedule={schedulable}
          canReschedule={canReschedule}
          canUnschedule={canUnschedule}
          willWait={willWait}
          canDiscard={canDiscard}
          canCancel={canCancel}
          channels={selected}
          publishable={publishable}
          publishNow={publishNowOf({
            canReschedule,
            canSchedule: schedulable,
            channels: whereItGoes(selected).publishing.length,
            policyKnown: approvalPolicy !== undefined,
            publishable,
            running: busy !== null,
            status,
            willWait,
          })}
          onAction={perform}
          extra={
            <DuplicatePost
              disabled={busy !== null}
              permissions={permissions}
              postId={postId}
              workspaceId={workspaceId}
            />
          }
        />
      </div>
    </div>
  );
};
