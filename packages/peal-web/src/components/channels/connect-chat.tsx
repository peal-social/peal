"use client";

import { useAtomSet } from "@effect/atom-react";
import { Option } from "effect";
import { RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { forWorkspace } from "peal-contract";
import type { ChatPlatform } from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "peal-ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "peal-ui/components/dialog";
import { Input } from "peal-ui/components/input";
import { Label } from "peal-ui/components/label";
import { toast } from "peal-ui/components/toast";
import { useId, useState, useTransition } from "react";
import type { ChangeEvent, SubmitEvent } from "react";

import { useChannelErrorText } from "#channels/channel-error-text.ts";
import {
  channelsChanged,
  connectChat,
  failureOf,
} from "#channels/channels-api.ts";
import type { ChannelErrorKey } from "#channels/channels-api.ts";

interface ChatFieldsProps {
  /** The channel to reconnect: the secret must reach its chat again. */
  readonly channelId?: string;
  readonly onConnected?: () => void;
  readonly platform: ChatPlatform;
  readonly workspaceId: string;
}

interface SecretFieldProps {
  readonly hint: string;
  readonly id: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly secret: boolean;
  readonly value: string;
}

const SecretField = ({
  hint,
  id,
  label,
  onChange,
  secret,
  value,
}: SecretFieldProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={secret ? "password" : "text"}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={value}
        onChange={handleChange}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-muted-foreground text-xs">
        {hint}
      </p>
    </div>
  );
};

/**
 * The form that connects a chat with the secret its member pastes: a
 * Discord channel's webhook address, or a Telegram bot's token and the
 * chat it posts in. The secret is typed unseen, goes to the server once,
 * and is never shown again; a refusal says how to put it right.
 */
export const ChatFields = ({
  channelId,
  onConnected,
  platform,
  workspaceId,
}: ChatFieldsProps) => {
  const t = useTranslations("ChannelsPage.chat");
  const pending = useTranslations("ChannelsPage");
  const errorText = useChannelErrorText();
  const connect = useAtomSet(connectChat, { mode: "promiseExit" });
  const [secret, setSecret] = useState("");
  const [chat, setChat] = useState("");
  const [error, setError] = useState<ChannelErrorKey | null>(null);
  const [isPending, startTransition] = useTransition();
  const id = useId();

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const reconnecting = channelId === undefined ? {} : { channelId };

    startTransition(async () => {
      const exit = await connect({
        headers: forWorkspace(workspaceId),
        payload:
          platform === "discord"
            ? { ...reconnecting, platform, webhookUrl: secret.trim() }
            : {
                ...reconnecting,
                botToken: secret.trim(),
                chat: chat.trim(),
                platform,
              },
        reactivityKeys: channelsChanged(workspaceId),
      });

      Option.match(failureOf(exit), {
        onNone: () => {
          if (exit._tag === "Success") {
            setSecret("");
            toast.success(
              t("connected", {
                chat: exit.value.displayName ?? exit.value.handle,
              })
            );
            onConnected?.();
          }
        },
        onSome: setError,
      });
    });
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {error === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{errorText(error)}</AlertDescription>
        </Alert>
      )}
      <SecretField
        id={`${id}-secret`}
        label={t(`${platform}.secret`)}
        hint={t(`${platform}.secretHint`)}
        value={secret}
        onChange={setSecret}
        secret
      />
      {platform === "telegram" ? (
        <SecretField
          id={`${id}-chat`}
          label={t("telegram.chat")}
          hint={t("telegram.chatHint")}
          value={chat}
          onChange={setChat}
          secret={false}
        />
      ) : null}
      <Button type="submit" disabled={isPending} focusableWhenDisabled>
        {isPending ? pending("connecting") : t(`${platform}.connect`)}
      </Button>
    </form>
  );
};

/**
 * Where a member connects a Discord channel or a Telegram chat, among the
 * platforms: one line on where the secret comes from, and the docs page
 * that says it step by step, where the operator publishes the docs.
 */
export const ConnectChat = ({
  docsUrl,
  platform,
  workspaceId,
}: {
  readonly docsUrl: string | null;
  readonly platform: ChatPlatform;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("ChannelsPage.chat");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{t(`${platform}.title`)}</h3>
        </CardTitle>
        <CardDescription>
          {t(`${platform}.description`)}
          {docsUrl === null ? null : (
            <>
              {" "}
              <a
                className="underline underline-offset-4"
                href={`${docsUrl.replace(/\/+$/u, "")}/platforms/${platform}`}
                rel="noreferrer"
                target="_blank"
              >
                {t("howTo")}
              </a>
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChatFields platform={platform} workspaceId={workspaceId} />
      </CardContent>
    </Card>
  );
};

/**
 * Reconnects a chat's channel with a new secret, in the same form: a
 * webhook of the same Discord channel, or the same Telegram chat's bot.
 */
export const ReconnectChat = ({
  handle,
  id: channelId,
  needsReconnect,
  platform,
  workspaceId,
}: {
  readonly handle: string;
  readonly id: string;
  readonly needsReconnect: boolean;
  readonly platform: ChatPlatform;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("ChannelsPage");
  const [open, setOpen] = useState(false);

  const close = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={needsReconnect ? "outline" : "ghost"}
            size="xs"
            aria-label={t("reconnectAccount", {
              handle,
              platform: t("platform", { platform }),
            })}
          />
        }
      >
        <RefreshCwIcon aria-hidden />
        {t("reconnect")}
      </DialogTrigger>
      <DialogContent closeLabel={t("cancel")}>
        <DialogHeader>
          <DialogTitle>{t("chat.reconnect", { handle })}</DialogTitle>
          <DialogDescription>
            {t(`chat.${platform}.description`)}
          </DialogDescription>
        </DialogHeader>
        <ChatFields
          channelId={channelId}
          onConnected={close}
          platform={platform}
          workspaceId={workspaceId}
        />
      </DialogContent>
    </Dialog>
  );
};
