"use client";

import { useTranslations } from "next-intl";
import type { Channel, CommentRule } from "peal-contract";
import { Badge } from "peal-ui/components/badge";
import { Button } from "peal-ui/components/button";
import { Checkbox } from "peal-ui/components/checkbox";
import { Input } from "peal-ui/components/input";
import { Label } from "peal-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "peal-ui/components/select";
import { Textarea } from "peal-ui/components/textarea";
import { useId } from "react";
import type { ReactNode } from "react";

import { carriesPrivately } from "#comment-rules/rules.ts";
import type { CommentRuleDraft } from "#comment-rules/rules.ts";

// The views of comment rules: a rule with what it did, and the form that
// starts one, whatever fetched them. Their state is in
// comment-rules-settings.tsx.

type Match = CommentRule["matches"][number];

// What came of a match's private reply, as its line says it: none for a
// rule without one, or a match it did not answer.
const privateOutcomeOf = (match: Match) => {
  if (match.privateReplyId !== null) {
    // Its row is purged 30 days after it settled: how it ended is gone.
    return { status: match.privateStatus ?? "gone" } as const;
  }

  if (match.privateCode === "waiting") {
    return { status: "waiting" } as const;
  }

  return match.privateCode === null
    ? undefined
    : ({ code: match.privateCode } as const);
};

/** What came of the private replies of the comments a rule answered. */
const PrivateOutcomes = ({
  matches,
}: {
  readonly matches: readonly Match[];
}) => {
  const t = useTranslations("CommentRules");

  const lines = matches.flatMap((match) => {
    const outcome = privateOutcomeOf(match);

    return outcome === undefined ? [] : [{ match, outcome }];
  });

  if (lines.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-1">
      {lines.map(({ match, outcome }) => (
        <li key={match.commentId} className="text-muted-foreground text-sm">
          {"status" in outcome
            ? t("privateMade", { status: outcome.status })
            : t("privateSkipped", { code: outcome.code })}
        </li>
      ))}
    </ul>
  );
};

/** A rule as the list shows it, with its channels and what it matched. */
export const CommentRuleView = ({
  actions,
  rule,
}: {
  readonly actions: ReactNode;
  readonly rule: CommentRule;
}) => {
  const t = useTranslations("CommentRules");
  const titleId = useId();

  const replied = rule.matches.filter(
    ({ outcome }) => outcome === "replied"
  ).length;

  return (
    <li aria-labelledby={titleId} className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span id={titleId} className="font-medium">
              {t("keywords", { keywords: rule.keywords.join(", ") })}
            </span>
            <Badge variant={rule.status === "active" ? "secondary" : "outline"}>
              {t("status", { status: rule.status })}
            </Badge>
          </div>
          <p className="text-sm whitespace-pre-wrap">{rule.reply}</p>
          {rule.privateReply === null ? null : (
            <p className="text-sm whitespace-pre-wrap">
              <span className="text-muted-foreground">
                {t("privateReplyLabel")}
              </span>{" "}
              {rule.privateReply}
            </p>
          )}
          <p className="text-muted-foreground text-sm">
            {t("replied", { count: replied })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      <ul className="flex flex-col gap-1">
        {rule.channels.map(({ channelId, platform, privateReply, reply }) => (
          <li key={channelId} className="text-muted-foreground text-sm">
            {rule.privateReply === null
              ? t("carries", { platform, reply })
              : t("carriesPrivately", { platform, privateReply, reply })}
          </li>
        ))}
      </ul>
      {rule.privateReply === null ? null : (
        <PrivateOutcomes matches={rule.matches} />
      )}
    </li>
  );
};

/** The form that starts a rule on a channel. */
export const CommentRuleFormView = ({
  busy,
  channels,
  draft,
  error,
  mayMessage,
  onChange,
  onSubmit,
}: {
  readonly busy: boolean;
  readonly channels: readonly Channel[];
  readonly draft: CommentRuleDraft;
  readonly error: string | null;
  /** Whether the member may send private messages. */
  readonly mayMessage: boolean;
  readonly onChange: (draft: CommentRuleDraft) => void;
  readonly onSubmit: () => void;
}) => {
  const t = useTranslations("CommentRules");
  const channelId = useId();
  const keywordsId = useId();
  const replyId = useId();
  const privateId = useId();
  const privateTextId = useId();

  // The draft on another channel: one without private replies takes none.
  const onChannel = (chosen: string): CommentRuleDraft => ({
    ...draft,
    channelId: chosen,
    privateReply: carriesPrivately(
      channels.find(({ id }) => id === chosen)?.platform
    )
      ? draft.privateReply
      : null,
  });

  // Offered only where the platform has private replies, to a member who
  // may send messages; the server says whether the channel can now.
  const offersPrivate =
    mayMessage &&
    carriesPrivately(
      channels.find(({ id }) => id === draft.channelId)?.platform
    );

  return (
    <form
      className="flex flex-col gap-3 rounded-md border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-col gap-1">
        <Label htmlFor={channelId}>{t("form.channel")}</Label>
        <Select
          value={draft.channelId}
          onValueChange={(value) => {
            onChange(onChannel(value ?? ""));
          }}
        >
          <SelectTrigger id={channelId}>
            <SelectValue placeholder={t("form.chooseChannel")} />
          </SelectTrigger>
          <SelectContent>
            {channels.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                {channel.displayName ?? channel.handle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={keywordsId}>{t("form.keywords")}</Label>
        <Input
          id={keywordsId}
          value={draft.keywords}
          onChange={(event) => {
            onChange({ ...draft, keywords: event.target.value });
          }}
        />
        <p className="text-muted-foreground text-xs">
          {t("form.keywordsHelp")}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={replyId}>{t("form.reply")}</Label>
        <Textarea
          id={replyId}
          value={draft.reply}
          onChange={(event) => {
            onChange({ ...draft, reply: event.target.value });
          }}
        />
      </div>
      <p className="text-muted-foreground text-xs">{t("form.public")}</p>
      {offersPrivate ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id={privateId}
              checked={draft.privateReply !== null}
              onCheckedChange={(checked) => {
                onChange({
                  ...draft,
                  privateReply: checked === true ? "" : null,
                });
              }}
            />
            <Label htmlFor={privateId}>{t("form.alsoPrivate")}</Label>
          </div>
          {draft.privateReply === null ? null : (
            <div className="flex flex-col gap-1">
              <Label htmlFor={privateTextId}>{t("form.privateReply")}</Label>
              <Textarea
                id={privateTextId}
                aria-describedby={`${privateTextId}-hint`}
                value={draft.privateReply}
                onChange={(event) => {
                  onChange({ ...draft, privateReply: event.target.value });
                }}
              />
              <p
                id={`${privateTextId}-hint`}
                className="text-muted-foreground text-xs"
              >
                {t("form.privateHint")}
              </p>
            </div>
          )}
        </div>
      ) : null}
      {error === null ? null : (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={busy}>
          {t("form.start")}
        </Button>
      </div>
    </form>
  );
};
