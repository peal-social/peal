"use client";

import { DateTime, Option } from "effect";
import { CheckIcon, EyeOffIcon, HeartIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  inboxOptionalPlatforms,
  inboxRetentionDays,
  inboxStandardPlatforms,
  inboxWindowDays,
} from "peal-contract";
import type {
  SocialChannel,
  InboxAbilityStanding,
  InboxAuthor,
  InboxComment,
  InboxPrivateReply,
  InboxReply,
  InboxThread,
  Platform,
} from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Avatar, AvatarFallback } from "peal-ui/components/avatar";
import { Button } from "peal-ui/components/button";
import { Label } from "peal-ui/components/label";
import { Textarea } from "peal-ui/components/textarea";
import { useId } from "react";
import type { ChangeEvent, ReactNode, SubmitEvent } from "react";

import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import type { InboxError } from "#inbox/errors.ts";
import type { ReplyFit } from "#inbox/reply-text.ts";
import { webAddressOf } from "#inbox/web-address.ts";

// The inbox's views: what a thread's row, a comment, a reply and the reply
// box look like, whatever fetched them. Their state lives in
// threads-list.tsx and thread-screen.tsx. What people wrote on a platform is
// shown as text, never as markup: React escapes it, and nothing here reads
// it as HTML or Markdown.

/** Writes a link of the app, which the page makes with its own navigation. */
export type InboxLink = (href: string, label: string) => ReactNode;

/** Writes why an inbox action failed, in the reader's language. */
export const useInboxErrorText = () => {
  const t = useTranslations("Inbox.errors");

  return (error: InboxError): string => {
    if (error.key === "actionFailed") {
      return t("actionFailed", { reason: error.reason });
    }

    if (error.key === "replyTooLong") {
      return t("replyTooLong", {
        length: error.length,
        maximum: error.maximum,
      });
    }

    if (error.key === "mentionsOutside") {
      return t("mentionsOutside", { mentions: error.mentions });
    }

    if (error.key === "statusConflict") {
      return t("statusConflict", { status: error.status });
    }

    if (error.key === "unavailable") {
      return t("unavailable", { standing: error.standing });
    }

    if (error.key === "privateReplyNotPossible") {
      return t("privateReplyNotPossible", { reason: error.reason });
    }

    return t(error.key);
  };
};

/** Names a channel as the composer does, or says it was disconnected. */
export const useChannelName = () => {
  const t = useTranslations("Posts");

  return (channel: SocialChannel | undefined): string =>
    channel === undefined
      ? t("disconnectedChannel")
      : t("Composer.channelDetail", {
          handle: channel.handle,
          platform: t("platform", { platform: channel.platform }),
        });
};

const useInstant = () => {
  const format = useFormatter();

  return (at: DateTime.Utc) =>
    format.dateTime(DateTime.toDate(at), {
      dateStyle: "medium",
      timeStyle: "short",
    });
};

// A link to a platform's page, in a new tab, when its address is one a
// link may open.
const PlatformLink = ({
  address,
  children,
}: {
  readonly address: string | null;
  readonly children: ReactNode;
}) =>
  Option.match(webAddressOf(address), {
    onNone: () => null,
    onSome: (href) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="underline underline-offset-4"
      >
        {children}
      </a>
    ),
  });

/** What Peal collects, where and for how long. */
export const CollectionNote = () => {
  const t = useTranslations("Inbox");
  const tPosts = useTranslations("Posts");
  const format = useFormatter();

  return (
    <p className="text-muted-foreground text-sm">
      {t("collected", {
        optionalPlatforms: format.list(
          inboxOptionalPlatforms.map((platform) =>
            tPosts("platform", { platform })
          ),
          { type: "conjunction" }
        ),
        platforms: format.list(
          inboxStandardPlatforms.map((platform) =>
            tPosts("platform", { platform })
          ),
          { type: "conjunction" }
        ),
        retentionDays: inboxRetentionDays,
        windowDays: inboxWindowDays,
      })}
    </p>
  );
};

/**
 * A thread's heading on its own page: its channel, since when the post is
 * live, why its comments are no longer read, and the ways out.
 */
export const ThreadSummaryView = ({
  channel,
  link,
  thread,
  workspaceId,
}: {
  readonly channel: SocialChannel | undefined;
  readonly link: InboxLink;
  readonly thread: InboxThread;
  readonly workspaceId: string;
}) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("Inbox");
  const channelName = useChannelName();
  const instant = useInstant();

  return (
    <div className="flex flex-col gap-2 border-b pb-4">
      <p className="text-sm">
        {t("thread.channel", {
          at: instant(thread.publishedAt),
          channel: channelName(channel),
        })}
      </p>
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5 tabular-nums">
          {thread.unanswered > 0 ? (
            <span aria-hidden className="bg-brand size-1.5 rounded-full" />
          ) : null}
          {t("row.counts", {
            comments: thread.comments,
            unanswered: thread.unanswered,
          })}
        </span>
        {thread.collectionEnded === null ? null : (
          <span>{t("row.ended", { reason: thread.collectionEnded })}</span>
        )}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {link(
          workspaceHref(workspaceId, `/posts/${thread.postId}`),
          t("row.openPost")
        )}
        <PlatformLink address={thread.permalink}>
          {t("row.onPlatform")}
        </PlatformLink>
      </div>
    </div>
  );
};

/**
 * Why nobody can reply in this thread: the account must be connected
 * again (`reconnect`, with `channels`, the way to the channels page), the
 * platform does not offer replies (`unsupported`), or the channel is gone.
 */
export const ReplyAbilityNotice = ({
  channels,
  disconnected,
  standing,
}: {
  readonly channels: ReactNode;
  /** Whether the thread's channel was disconnected. */
  readonly disconnected: boolean;
  readonly standing: InboxAbilityStanding;
}) => {
  const t = useTranslations("Inbox.abilities");

  if (disconnected) {
    return (
      <Alert>
        <AlertDescription>{t("disconnected")}</AlertDescription>
      </Alert>
    );
  }

  if (standing === "available") {
    return null;
  }

  return (
    <Alert>
      <AlertDescription>
        {standing === "reconnect" ? (
          <span className="flex flex-col gap-2">
            {t("reconnect")}
            <span>{channels}</span>
          </span>
        ) : (
          t("unsupported")
        )}
      </AlertDescription>
    </Alert>
  );
};

/** How a comment's author is addressed: with one "@" before the handle. */
export const handleOf = ({ handle }: InboxAuthor): string =>
  handle.startsWith("@") ? handle : `@${handle}`;

/**
 * What a comment's author is called where their platform gives neither a
 * name nor a handle: on LinkedIn, whose commenters Peal keeps by URN and
 * never by name, a member or a page by the kind of URN; elsewhere,
 * someone.
 */
export const namelessKey = (
  author: InboxAuthor | null,
  platform: Platform | null
): "linkedinMember" | "linkedinPage" | "unknownAuthor" => {
  if (platform !== "linkedin" || author === null) {
    return "unknownAuthor";
  }

  return author.platformId.startsWith("urn:li:organization:")
    ? "linkedinPage"
    : "linkedinMember";
};

/** Whether the platform gives the author neither a name nor a handle. */
export const isNameless = (author: InboxAuthor | null): boolean =>
  author === null ||
  ((author.displayName === null || author.displayName === "") &&
    author.handle === "");

// Who wrote a comment, as their platform shows them: plain text, each in
// a `bdi`, so a name written right to left never reorders what stands
// beside it.
const AuthorLine = ({
  author,
  platform,
}: {
  readonly author: InboxAuthor | null;
  readonly platform: Platform | null;
}) => {
  const t = useTranslations("Inbox.comment");

  // A missing author, or one their platform names by neither name nor
  // handle.
  if (author === null || isNameless(author)) {
    return (
      <span className="font-medium">{t(namelessKey(author, platform))}</span>
    );
  }

  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      {author.displayName === null || author.displayName === "" ? null : (
        <bdi className="font-medium break-words">{author.displayName}</bdi>
      )}
      {/* Facebook shows a name and no handle. */}
      {author.handle === "" ? null : (
        <bdi className="text-muted-foreground text-sm break-all">
          {handleOf(author)}
        </bdi>
      )}
    </span>
  );
};

// Where a comment stands, in its meta line: the brand's dot while it
// waits, as its row in the list has, and a quiet icon otherwise.
const CommentState = ({
  expired,
  state,
}: {
  readonly expired: boolean;
  readonly state: InboxComment["state"];
}) => {
  const t = useTranslations("Inbox.comment");
  const label = expired ? t("expiredState") : t("state", { state });

  return (
    <span className="flex items-center gap-1">
      {state === "new" ? (
        <span aria-hidden className="bg-brand size-1.5 rounded-full" />
      ) : null}
      {state === "answered" ? (
        <CheckIcon aria-hidden className="size-3" />
      ) : null}
      {state === "hidden" ? (
        <EyeOffIcon aria-hidden className="size-3" />
      ) : null}
      {label}
    </span>
  );
};

/** The first letter of a name, for its avatar; "?" for none. */
export const initialOfName = (name: string): string => {
  const [first] = new Intl.Segmenter().segment(name.replace(/^@/u, ""));

  return first === undefined ? "?" : first.segment.toUpperCase();
};

// The first letter of who wrote, for their avatar.
const initialOf = (author: InboxAuthor | null): string =>
  initialOfName(
    author === null ? "" : (author.displayName ?? "") || author.handle
  );

/**
 * A reply sent from Peal, as the journal has it: on its way, sent, failed
 * with its reason, to check on the platform, or withdrawn. `actions` are
 * what the reader may do about it.
 */
export const ReplyView = ({
  actions,
  reply,
}: {
  readonly actions?: ReactNode;
  readonly reply: InboxReply;
}) => {
  const t = useTranslations("Inbox.reply");
  const instant = useInstant();
  const reason = t("reason", { reason: reply.reason ?? "unknown" });

  const troubled = reply.status === "failed" || reply.status === "unconfirmed";

  return (
    <li className="flex flex-col gap-1 border-l-2 pl-3">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span>{t("from", { at: instant(reply.createdAt) })}</span>
        <span aria-hidden>·</span>
        <span className={troubled ? "text-destructive font-medium" : undefined}>
          {t("status", { status: reply.status })}
        </span>
        {reply.status === "sent" ? (
          <>
            <span aria-hidden>·</span>
            <PlatformLink address={reply.permalink}>
              {t("onPlatform")}
            </PlatformLink>
          </>
        ) : null}
      </div>
      <p dir="auto" className="text-sm break-words whitespace-pre-wrap">
        {reply.text}
      </p>
      {reply.status === "failed" ? (
        <p className="text-sm">{t("failed", { reason })}</p>
      ) : null}
      {reply.status === "unconfirmed" ? (
        <p className="text-sm">{t("unconfirmed", { reason })}</p>
      ) : null}
      {reply.status === "withdrawn" ? (
        <p className="text-muted-foreground text-sm">{t("withdrawnNote")}</p>
      ) : null}
      {actions === undefined ? null : (
        <div className="-ml-2 flex flex-wrap gap-1 empty:hidden">{actions}</div>
      )}
    </li>
  );
};

/**
 * One comment: who wrote it and when, its text as plain text, its state,
 * what the reader may do (`actions`), then the replies sent from Peal
 * (`replies`), its private reply or what sends one (`privateReply`), and
 * the comments that answer it (`children`). The thread's one composer
 * answers it.
 */
export const CommentView = ({
  actions,
  children,
  comment,
  platform,
  privateReply,
  replies,
}: {
  readonly actions?: ReactNode;
  readonly children?: ReactNode;
  readonly comment: InboxComment;
  /** The thread's platform, which a comment forgotten for its age names. */
  readonly platform?: Platform | null;
  /** The comment's private reply, or what sends one. */
  readonly privateReply?: ReactNode;
  readonly replies?: ReactNode;
}) => {
  const t = useTranslations("Inbox.comment");
  const tPosts = useTranslations("Posts");
  const instant = useInstant();
  const deleted = comment.state === "deleted";
  // Forgotten because its platform bounds how long Peal keeps a comment
  // without reading it again: not the same as gone from the platform.
  const expired = deleted && comment.forgotten === "expired";

  return (
    <li className="flex gap-3">
      <Avatar size="sm">
        <AvatarFallback>{initialOf(comment.author)}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <AuthorLine author={comment.author} platform={platform ?? null} />
          <span className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
            <span>{t("writtenAt", { at: instant(comment.writtenAt) })}</span>
            <span aria-hidden>·</span>
            <CommentState expired={expired} state={comment.state} />
            {comment.liked && !deleted ? (
              <>
                <span aria-hidden>·</span>
                <span className="flex items-center gap-1">
                  <HeartIcon aria-hidden className="size-3" />
                  {t("liked")}
                </span>
              </>
            ) : null}
          </span>
        </div>
        {deleted ? (
          <p className="text-muted-foreground text-sm italic">
            {expired
              ? t("expired", {
                  platform:
                    platform === undefined || platform === null
                      ? t("somePlatform")
                      : tPosts("platform", { platform }),
                })
              : t("deleted")}
          </p>
        ) : (
          <p dir="auto" className="text-sm break-words whitespace-pre-wrap">
            {comment.text}
          </p>
        )}
        <div className="text-muted-foreground -ml-2 flex flex-wrap items-center gap-1 text-xs">
          {actions}
          {deleted ? null : (
            <span className="px-2">
              <PlatformLink address={comment.permalink}>
                {t("onPlatform")}
              </PlatformLink>
            </span>
          )}
        </div>
        {replies === undefined ? null : (
          <ul aria-label={t("replies")} className="mt-2 flex flex-col gap-3">
            {replies}
          </ul>
        )}
        {privateReply}
        {children === undefined ? null : (
          <ul aria-label={t("answers")} className="mt-3 flex flex-col gap-4">
            {children}
          </ul>
        )}
      </div>
    </li>
  );
};

/**
 * The box to answer a comment: the text, its length against the platform's
 * limit, the mention Peal puts first on Mastodon, and why another reply
 * must wait (`pending`: the status of the one to settle first).
 */
export const ReplyBoxView = ({
  author,
  error,
  fit,
  inputId,
  onChange,
  onSend,
  pending,
  sending,
  text,
}: {
  /** Who the reply answers, as the label names them. */
  readonly author: string;
  /** The text field's id, so a comment's Reply can focus it. */
  readonly inputId?: string;
  /** Why the last send failed, already written. */
  readonly error: string | null;
  readonly fit: ReplyFit;
  readonly onChange: (text: string) => void;
  readonly onSend: () => void;
  readonly pending: "sending" | "unconfirmed" | null;
  /** Whether a send is being asked of the server. */
  readonly sending: boolean;
  readonly text: string;
}) => {
  const t = useTranslations("Inbox.box");
  const ownId = useId();
  const id = inputId ?? ownId;
  const hintId = useId();
  const countId = useId();
  const tooLong = fit.remaining < 0;
  const blocked = pending !== null;

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card flex flex-col gap-2 rounded-lg border p-3 shadow-sm"
    >
      <Label htmlFor={id}>{t("label", { author })}</Label>
      <Textarea
        dir="auto"
        id={id}
        value={text}
        disabled={blocked || sending}
        aria-invalid={tooLong}
        aria-describedby={`${hintId} ${countId}`}
        onChange={handleChange}
      />
      <div id={hintId} className="text-muted-foreground flex flex-col text-xs">
        <span>{t("public")}</span>
        {fit.mention === null ? null : (
          <span>{t("mention", { mention: fit.mention })}</span>
        )}
      </div>
      {error === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {blocked ? (
        <output className="text-sm">{t("pending", { status: pending })}</output>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          id={countId}
          aria-live="polite"
          className={
            tooLong
              ? "text-destructive text-sm"
              : "text-muted-foreground text-sm"
          }
        >
          {t("count", {
            length: fit.length,
            maximum: fit.maximum,
            unit: fit.unit,
          })}
          {tooLong ? (
            <span className="ml-2 font-medium">
              {t("tooLong", { over: -fit.remaining })}
            </span>
          ) : null}
        </span>
        <Button
          type="submit"
          size="sm"
          disabled={blocked || sending || fit.empty || tooLong}
          focusableWhenDisabled
        >
          {sending ? t("sending") : t("send")}
        </Button>
      </div>
    </form>
  );
};

/**
 * The private message sent from Peal to a comment's author, as the
 * journal has it: on its way, sent, failed with its reason, or to check
 * in the person's conversation. `actions` are what the reader may do.
 */
export const PrivateReplyView = ({
  actions,
  reply,
}: {
  readonly actions?: ReactNode;
  readonly reply: InboxPrivateReply;
}) => {
  const t = useTranslations("Inbox.privateReply");
  const instant = useInstant();
  const reason = t("reason", { reason: reply.reason ?? "unknown" });

  return (
    <div className="flex flex-col gap-1 border-l-2 pl-3">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span>{t("from", { at: instant(reply.createdAt) })}</span>
        <span aria-hidden>·</span>
        <span
          className={
            reply.status === "failed" || reply.status === "unconfirmed"
              ? "text-destructive font-medium"
              : undefined
          }
        >
          {t("status", { status: reply.status })}
        </span>
      </div>
      <p dir="auto" className="text-sm break-words whitespace-pre-wrap">
        {reply.text}
      </p>
      {reply.status === "failed" ? (
        <p className="text-sm">{t("failed", { reason })}</p>
      ) : null}
      {reply.status === "unconfirmed" ? (
        <p className="text-sm">{t("unconfirmed", { reason })}</p>
      ) : null}
      {actions === undefined ? null : (
        <div className="-ml-2 flex flex-wrap gap-1 empty:hidden">{actions}</div>
      )}
    </div>
  );
};

/**
 * What a private reply's dialog asks: one message to the comment's
 * author, its length against the platform's, until when it may go, and
 * the hint that saying it is automatic is the member's to write.
 */
export const PrivateReplyFormView = ({
  author,
  error,
  fit,
  onCancel,
  onChange,
  onSend,
  sending,
  text,
  until,
}: {
  /** Who gets the message, as the description names them. */
  readonly author: string;
  /** Why the last send failed, already written. */
  readonly error: string | null;
  readonly fit: ReplyFit;
  readonly onCancel: () => void;
  readonly onChange: (text: string) => void;
  readonly onSend: () => void;
  /** Whether a send is being asked of the server. */
  readonly sending: boolean;
  readonly text: string;
  /** Until when the platform takes it, less Peal's hour. */
  readonly until: DateTime.Utc;
}) => {
  const t = useTranslations("Inbox.privateReply");
  const instant = useInstant();
  const id = useId();
  const hintId = useId();
  const countId = useId();
  const tooLong = fit.remaining < 0;

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">
        {t("description", { author, until: instant(until) })}
      </p>
      <Label htmlFor={id}>{t("label")}</Label>
      <Textarea
        dir="auto"
        id={id}
        value={text}
        disabled={sending}
        aria-invalid={tooLong}
        aria-describedby={`${hintId} ${countId}`}
        onChange={handleChange}
      />
      <p id={hintId} className="text-muted-foreground text-xs">
        {t("automatic")}
      </p>
      {error === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          id={countId}
          aria-live="polite"
          className={
            tooLong
              ? "text-destructive text-sm"
              : "text-muted-foreground text-sm"
          }
        >
          {t("count", {
            length: fit.length,
            maximum: fit.maximum,
            unit: fit.unit,
          })}
          {tooLong ? (
            <span className="ml-2 font-medium">
              {t("tooLong", { over: -fit.remaining })}
            </span>
          ) : null}
        </span>
        <span className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={sending || fit.empty || tooLong}
            focusableWhenDisabled
          >
            {sending ? t("sending") : t("send")}
          </Button>
        </span>
      </div>
    </form>
  );
};
