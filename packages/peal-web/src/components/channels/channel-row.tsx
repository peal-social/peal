"use client";

import { useAtomSet } from "@effect/atom-react";
import { DateTime, Option } from "effect";
import { RefreshCwIcon, UnplugIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { isSocialChannel, forWorkspace } from "peal-contract";
import type { Channel, ChannelStatus } from "peal-contract";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "peal-ui/components/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "peal-ui/components/avatar";
import { Badge } from "peal-ui/components/badge";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import { useTransition } from "react";

import { useChannelErrorText } from "#channels/channel-error-text.ts";
import {
  channelInitial,
  channelName,
  channelTitle,
} from "#channels/channel-name.ts";
import {
  channelsChanged,
  disconnectChannel,
  failureOf,
  reconnectChannel,
} from "#channels/channels-api.ts";
import { rememberConnection } from "#channels/pending-connection.ts";
import { ChannelPower } from "#components/channels/channel-power.tsx";
import { ReconnectChat } from "#components/channels/connect-chat.tsx";
import { ReconnectWebsite } from "#components/channels/connect-website.tsx";
import { PlatformMark } from "#components/channels/platform-mark.tsx";
import { RenameChannel } from "#components/channels/rename-channel.tsx";

// A channel that posts says nothing of its state; one that does not says
// why beside its name.
const badgeVariant = {
  disabled: "secondary",
  refreshNeeded: "destructive",
} as const satisfies Record<Exclude<ChannelStatus["_tag"], "active">, string>;

// Connecting the channel's account again: a platform's sign-in, or a
// website's form for a new application password.
const ReconnectControl = ({
  channel,
  handle,
  needsReconnect,
  workspaceId,
}: {
  readonly channel: Channel;
  readonly handle: string;
  readonly needsReconnect: boolean;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("ChannelsPage");
  const errorText = useChannelErrorText();
  const reconnect = useAtomSet(reconnectChannel, { mode: "promiseExit" });
  const [isReconnecting, startReconnect] = useTransition();
  const params = { channelId: channel.id };
  const headers = forWorkspace(workspaceId);

  const handleReconnect = () => {
    startReconnect(async () => {
      const exit = await reconnect({ params, headers, query: {} });

      Option.match(failureOf(exit), {
        onNone: () => {
          if (exit._tag === "Success" && isSocialChannel(channel)) {
            rememberConnection({ platform: channel.platform, workspaceId });
            globalThis.location.assign(exit.value.authorizationUrl);
          }
        },
        onSome: (key) => {
          toast.error(errorText(key));
        },
      });
    });
  };

  // A chat has no sign-in: the same form takes a new secret.
  if (channel.platform === "discord" || channel.platform === "telegram") {
    return (
      <ReconnectChat
        handle={channel.handle}
        id={channel.id}
        needsReconnect={needsReconnect}
        platform={channel.platform}
        workspaceId={workspaceId}
      />
    );
  }

  if (!isSocialChannel(channel)) {
    return (
      <ReconnectWebsite
        handle={channel.handle}
        id={channel.id}
        needsReconnect={needsReconnect}
        platform={channel.platform}
        workspaceId={workspaceId}
      />
    );
  }

  return (
    <Button
      variant={needsReconnect ? "outline" : "ghost"}
      size="xs"
      disabled={isReconnecting}
      focusableWhenDisabled
      onClick={handleReconnect}
      aria-label={
        isReconnecting
          ? undefined
          : t("reconnectAccount", {
              handle,
              platform: t("platform", { platform: channel.platform }),
            })
      }
    >
      <RefreshCwIcon aria-hidden />
      {isReconnecting ? t("reconnecting") : t("reconnect")}
    </Button>
  );
};

interface ChannelRowProps {
  readonly canConnect: boolean;
  readonly canDisconnect: boolean;
  readonly channel: Channel;
  readonly workspaceId: string;
}

// One connected account: who it is, whether it posts, and what the member
// may do with it. The name the workspace gave it comes first; the platform's
// handle, and the name it shows there, stay beside it.
export const ChannelRow = ({
  canConnect,
  canDisconnect,
  channel,
  workspaceId,
}: ChannelRowProps) => {
  const t = useTranslations("ChannelsPage");
  const errorText = useChannelErrorText();
  const disconnect = useAtomSet(disconnectChannel, { mode: "promiseExit" });
  const [isDisconnecting, startDisconnect] = useTransition();
  const params = { channelId: channel.id };
  const headers = forWorkspace(workspaceId);
  const name = channelTitle(channel);
  const handle = channelName(channel);

  // Under a name of the workspace's, the platform's own name is still told.
  const account =
    channel.label === null || channel.displayName === null
      ? channel.handle
      : `${channel.displayName} · ${channel.handle}`;

  const needsReconnect = channel.status._tag === "refreshNeeded";

  // Instagram's way in tells which sign-in reconnecting opens.
  const platformName =
    channel.connection === null
      ? t("platform", { platform: channel.platform })
      : t("platformVia", {
          connection: channel.connection,
          platform: channel.platform,
        });

  const handleDisconnect = () => {
    startDisconnect(async () => {
      const exit = await disconnect({
        params,
        headers,
        reactivityKeys: channelsChanged(workspaceId),
      });

      Option.match(failureOf(exit), {
        onNone: () => {
          toast.success(t("disconnected", { handle }));
        },
        onSome: (key) => {
          toast.error(errorText(key));
        },
      });
    });
  };

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <span className="relative shrink-0">
        <Avatar>
          {channel.avatarUrl === null ? null : (
            <AvatarImage src={channel.avatarUrl} alt="" />
          )}
          <AvatarFallback>{channelInitial(channel)}</AvatarFallback>
        </Avatar>
        <span className="absolute -end-1 -bottom-1">
          <PlatformMark platform={channel.platform} size="badge" />
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          {channel.status._tag === "active" ? null : (
            <Badge variant={badgeVariant[channel.status._tag]}>
              {t(`status.${channel.status._tag}`)}
            </Badge>
          )}
        </div>
        <span className="text-muted-foreground truncate text-xs">
          {platformName} · {account}
        </span>
        {channel.status._tag === "disabled" ? (
          <span className="text-muted-foreground text-xs">
            {t("offHint", {
              reconnect: channel.status.refreshNeeded ? "yes" : "no",
              who: canConnect ? "you" : "other",
            })}
          </span>
        ) : null}
        {channel.tokenExpiresAt === null ? null : (
          <span className="text-muted-foreground text-xs">
            {t("expires", {
              date: DateTime.toDateUtc(channel.tokenExpiresAt),
            })}
          </span>
        )}
      </div>
      {/* On a phone, a line of their own under the text, aligned with it. */}
      <div className="flex w-full flex-wrap gap-1 ps-11 sm:w-auto sm:ps-0">
        {canConnect ? (
          <RenameChannel channel={channel} workspaceId={workspaceId} />
        ) : null}
        {canConnect ? (
          <ChannelPower channel={channel} workspaceId={workspaceId} />
        ) : null}
        {canConnect ? (
          <ReconnectControl
            channel={channel}
            handle={handle}
            needsReconnect={needsReconnect}
            workspaceId={workspaceId}
          />
        ) : null}
        {canDisconnect ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={isDisconnecting}
                  focusableWhenDisabled
                  aria-label={
                    isDisconnecting
                      ? undefined
                      : t("disconnectAccount", { handle })
                  }
                />
              }
            >
              <UnplugIcon aria-hidden />
              {isDisconnecting ? t("disconnecting") : t("disconnect")}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("disconnectTitle", { handle })}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("disconnectDescription", { platform: channel.platform })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleDisconnect}
                >
                  {t("disconnect")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </li>
  );
};
