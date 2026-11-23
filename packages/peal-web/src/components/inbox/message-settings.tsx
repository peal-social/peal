"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Exit, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { isSocialChannel } from "peal-contract";
import type { InboxMessageSettings, SocialChannel } from "peal-contract";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "peal-ui/components/alert-dialog";
import { Badge } from "peal-ui/components/badge";
import { Button } from "peal-ui/components/button";
import { Input } from "peal-ui/components/input";
import { Label } from "peal-ui/components/label";
import {
  SettingsCard,
  SettingsCardBody,
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowLabel,
  SettingsRowText,
} from "peal-ui/components/settings";
import { Switch } from "peal-ui/components/switch";
import { toast } from "peal-ui/components/toast";
import { useId, useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { channelsOf, reconnectChannel } from "#channels/channels-api.ts";
import { rememberConnection } from "#channels/pending-connection.ts";
import { messagePlatforms } from "#channels/platform-features.ts";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { SettingsGroup } from "#components/settings/settings-group.tsx";
import { inboxErrorOf } from "#inbox/errors.ts";
import {
  messageSettings,
  messageSettingsChanged,
  setChannelMessages,
  setMessageApplication,
} from "#inbox/message-atoms.ts";
import { readsNoMessages } from "#inbox/message-channels.ts";

import { useChannelName } from "./inbox-views.tsx";

// Whether the channel is Meta's, whose messages its review gates.
const isMeta = (channel: SocialChannel) =>
  channel.platform === "facebook" || channel.platform === "instagram";

// Whether the switch was refused for the standing given: `reconnect`
// until the account allows its messages, `unsupported` where Peal reads
// none of them.
const refusedAs = <A, E extends { readonly _tag: string }>(
  exit: Exit.Exit<A, E>,
  standing: "reconnect" | "unsupported"
) =>
  inboxErrorOf(exit).pipe(
    Option.exists(
      (explained) =>
        explained.key === "unavailable" && explained.standing === standing
    )
  );

/**
 * One channel's row: its name, and its switch at the end, messages read
 * or not. `onGrant`, for an account that must allow its messages first
 * (Bluesky's chat, Meta's messaging permissions), puts the sign-in that
 * asks for them in place of the switch. A Meta channel says who may write
 * before Meta's review, and an Instagram one the setting its owner turns
 * on in Instagram. Where Peal reads none of the channel's messages
 * (`unsupported`), it says so in place of the switch, which stays only to
 * turn off messages read before. Turning a channel's messages off deletes
 * what Peal kept of them, which cannot be undone: the switch asks first.
 */
export const ChannelMessagesView = ({
  channel,
  disabled,
  on,
  onGrant,
  onSwitch,
  unsupported = false,
}: {
  readonly channel: SocialChannel;
  readonly disabled: boolean;
  readonly on: boolean;
  readonly onGrant?: () => void;
  readonly onSwitch: (on: boolean) => void;
  readonly unsupported?: boolean;
}) => {
  const t = useTranslations("InboxMessages.settings");
  const settings = useTranslations("Settings");
  const channelName = useChannelName();
  const [confirming, setConfirming] = useState(false);
  const switchId = useId();
  const hintId = useId();
  const meta = isMeta(channel);

  if (unsupported && !on) {
    return (
      <SettingsRow>
        <SettingsRowText>
          <SettingsRowLabel>{channelName(channel)}</SettingsRowLabel>
          <SettingsRowDescription>
            {t("unsupported", { connection: channel.connection ?? "none" })}
          </SettingsRowDescription>
        </SettingsRowText>
        <SettingsRowControl>
          <Badge variant="outline">{t("off")}</Badge>
        </SettingsRowControl>
      </SettingsRow>
    );
  }

  const hints = [
    ...(meta ? [t("metaReview")] : []),
    ...(channel.platform === "instagram" ? [t("instagramConnectedTools")] : []),
  ];

  return (
    <SettingsRow>
      <SettingsRowText>
        {onGrant === undefined ? (
          <SettingsRowLabel htmlFor={switchId}>
            {channelName(channel)}
          </SettingsRowLabel>
        ) : (
          <SettingsRowLabel>{channelName(channel)}</SettingsRowLabel>
        )}
        {hints.length === 0 ? null : (
          <div id={hintId} className="flex flex-col gap-0.5">
            {hints.map((hint) => (
              <SettingsRowDescription key={hint}>{hint}</SettingsRowDescription>
            ))}
          </div>
        )}
      </SettingsRowText>
      <SettingsRowControl>
        {onGrant === undefined ? (
          <Switch
            id={switchId}
            checked={on}
            disabled={disabled}
            {...(hints.length === 0 ? {} : { "aria-describedby": hintId })}
            onCheckedChange={(checked: boolean) => {
              if (checked) {
                onSwitch(true);
              } else {
                setConfirming(true);
              }
            }}
          />
        ) : (
          <>
            <span className="text-muted-foreground text-sm">
              {meta ? t("metaGrantNeeded") : t("grantNeeded")}
            </span>
            <Button size="sm" disabled={disabled} onClick={onGrant}>
              {meta
                ? t("metaGrant", {
                    app:
                      channel.connection === "instagramLogin"
                        ? "instagram"
                        : "facebook",
                  })
                : t("grant")}
            </Button>
          </>
        )}
      </SettingsRowControl>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("turnOffTitle", { channel: channelName(channel) })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("turnOffDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{settings("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                onSwitch(false);
              }}
            >
              {t("turnOff")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsRow>
  );
};

// The applications let read the messages, each with its way to take that
// back, then the form that lets another by its client id.
const Applications = ({
  disabled,
  onAllow,
  settings,
}: {
  readonly disabled: boolean;
  readonly onAllow: (clientId: string, allowed: boolean) => void;
  readonly settings: InboxMessageSettings;
}) => {
  const t = useTranslations("InboxMessages.settings");
  const [clientId, setClientId] = useState("");
  const id = useId();

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAllow(clientId.trim(), true);
    setClientId("");
  };

  return (
    <SettingsGroup
      title={t("applications")}
      description={t("applicationsDescription")}
    >
      <SettingsCard>
        {settings.applications.length === 0 ? (
          <SettingsRow>
            <SettingsRowDescription>
              {t("noApplications")}
            </SettingsRowDescription>
          </SettingsRow>
        ) : (
          <ul className="divide-y">
            {settings.applications.map((application) => (
              <li
                key={application.clientId}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <code className="text-sm">{application.clientId}</code>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => {
                    onAllow(application.clientId, false);
                  }}
                >
                  {t("revoke")}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <SettingsCardBody>
          <form
            onSubmit={handleSubmit}
            className="flex flex-wrap items-end gap-2"
          >
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <Label htmlFor={id}>{t("clientId")}</Label>
              <Input
                id={id}
                value={clientId}
                onChange={(event) => {
                  setClientId(event.target.value);
                }}
              />
            </span>
            <Button
              type="submit"
              disabled={disabled || clientId.trim() === ""}
              focusableWhenDisabled
            >
              {t("allow")}
            </Button>
          </form>
        </SettingsCardBody>
      </SettingsCard>
    </SettingsGroup>
  );
};

/**
 * What the workspace decided about its direct messages, for a member who
 * connects channels: which channels' messages Peal reads, each switched
 * in person; and, for an owner, which applications may read them.
 */
export const MessageSettingsPanel = ({
  mayAllowApplications,
  workspaceId,
}: {
  readonly mayAllowApplications: boolean;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("InboxMessages.settings");
  const hydrated = useHydrated();
  const settings = useAtomValue(messageSettings(workspaceId));
  const channels = useAtomValue(channelsOf(workspaceId));
  const switchOne = useAtomSet(setChannelMessages, { mode: "promiseExit" });
  const allowOne = useAtomSet(setMessageApplication, { mode: "promiseExit" });
  const reconnect = useAtomSet(reconnectChannel, { mode: "promiseExit" });
  // The channels whose accounts must allow their messages first.
  const [ungranted, setUngranted] = useState<ReadonlySet<string>>(new Set());
  // The channels the server refused as reading none of their messages.
  const [unread, setUnread] = useState<ReadonlySet<string>>(new Set());
  const [pending, start] = useTransition();

  if (
    !hydrated ||
    !AsyncResult.isSuccess(settings) ||
    !AsyncResult.isSuccess(channels)
  ) {
    return null;
  }

  const reactivityKeys = messageSettingsChanged(workspaceId);

  const eligible = channels.value
    .filter(isSocialChannel)
    .filter(({ platform }) => messagePlatforms.has(platform));

  const on = new Set(settings.value.channels.map(({ channelId }) => channelId));

  const done = <A, E>(exit: Exit.Exit<A, E>) => {
    if (Exit.isFailure(exit)) {
      toast.error(t("failed"));
    }
  };

  const grant = (channel: SocialChannel) => {
    start(async () => {
      const exit = await reconnect({
        params: { channelId: channel.id, workspaceId },
        query: { messages: "true" },
      });

      if (Exit.isSuccess(exit)) {
        rememberConnection({ platform: channel.platform, workspaceId });
        globalThis.location.assign(exit.value.authorizationUrl);

        return;
      }

      toast.error(t("failed"));
    });
  };

  return (
    <>
      <SettingsGroup title={t("title")} description={t("description")}>
        <SettingsCard>
          {eligible.length === 0 ? (
            <SettingsRow>
              <SettingsRowDescription>{t("none")}</SettingsRowDescription>
            </SettingsRow>
          ) : (
            eligible.map((channel) => (
              <ChannelMessagesView
                key={channel.id}
                channel={channel}
                disabled={pending}
                on={on.has(channel.id)}
                unsupported={readsNoMessages(channel) || unread.has(channel.id)}
                {...(ungranted.has(channel.id)
                  ? {
                      onGrant: () => {
                        grant(channel);
                      },
                    }
                  : {})}
                onSwitch={(enabled) => {
                  start(async () => {
                    const exit = await switchOne({
                      params: { channelId: channel.id, workspaceId },
                      payload: { enabled },
                      reactivityKeys,
                    });

                    if (refusedAs(exit, "reconnect")) {
                      setUngranted((now) => new Set([...now, channel.id]));

                      return;
                    }

                    if (refusedAs(exit, "unsupported")) {
                      setUnread((now) => new Set([...now, channel.id]));

                      return;
                    }

                    done(exit);
                  });
                }}
              />
            ))
          )}
        </SettingsCard>
      </SettingsGroup>
      {mayAllowApplications ? (
        <Applications
          disabled={pending}
          settings={settings.value}
          onAllow={(clientId, allowed) => {
            start(async () => {
              done(
                await allowOne({
                  params: { workspaceId },
                  payload: { allowed, clientId },
                  reactivityKeys,
                })
              );
            });
          }}
        />
      ) : null}
    </>
  );
};
