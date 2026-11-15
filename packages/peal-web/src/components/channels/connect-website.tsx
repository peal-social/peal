"use client";

import { useAtomSet } from "@effect/atom-react";
import { Option } from "effect";
import { useTranslations } from "next-intl";
import type { ChannelPlatform, KeySitePlatform } from "peal-contract";
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
import { useId, useState, useTransition } from "react";
import type { ChangeEvent, SubmitEvent } from "react";
import { toast } from "sonner";

import { useChannelErrorText } from "#channels/channel-error-text.ts";
import {
  channelsChanged,
  connectSite,
  connectSiteWithKey,
  failureOf,
  startSiteSignIn,
} from "#channels/channels-api.ts";
import type { ChannelErrorKey } from "#channels/channels-api.ts";
import { rememberConnection } from "#channels/pending-connection.ts";
import { publicationAddressOf } from "#channels/site-handles.ts";

interface WebsiteFieldsProps {
  /** The address to start from: the site's, to reconnect it. */
  readonly address?: string;
  readonly onConnected?: () => void;
  readonly workspaceId: string;
}

/**
 * The form that connects a WordPress site: its address, the user Peal
 * publishes as, and an application password made for Peal. The password
 * goes to the server once, and is never shown again.
 */
export const WebsiteFields = ({
  address: startAddress = "",
  onConnected,
  workspaceId,
}: WebsiteFieldsProps) => {
  const t = useTranslations("ChannelsPage");
  const errorText = useChannelErrorText();
  const connect = useAtomSet(connectSite, { mode: "promiseExit" });
  const [address, setAddress] = useState(startAddress);
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ChannelErrorKey | null>(null);
  const [isPending, startTransition] = useTransition();
  const id = useId();

  const onAddress = (event: ChangeEvent<HTMLInputElement>) => {
    setAddress(event.target.value);
  };

  const onUser = (event: ChangeEvent<HTMLInputElement>) => {
    setUserName(event.target.value);
  };

  const onPassword = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const exit = await connect({
        params: { workspaceId },
        payload: {
          address,
          applicationPassword: password,
          platform: "wordpress",
          userName,
        },
        reactivityKeys: channelsChanged(workspaceId),
      });

      Option.match(failureOf(exit), {
        onNone: () => {
          if (exit._tag === "Success") {
            setPassword("");
            toast.success(
              t("websiteConnected", {
                site: exit.value.displayName ?? exit.value.handle,
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
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-address`}>{t("websiteAddress")}</Label>
        <Input
          id={`${id}-address`}
          type="url"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={address}
          onChange={onAddress}
          aria-describedby={`${id}-address-hint`}
        />
        <p id={`${id}-address-hint`} className="text-muted-foreground text-xs">
          {t("websiteAddressHint")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-user`}>{t("websiteUser")}</Label>
        <Input
          id={`${id}-user`}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={userName}
          onChange={onUser}
          aria-describedby={`${id}-user-hint`}
        />
        <p id={`${id}-user-hint`} className="text-muted-foreground text-xs">
          {t("websiteUserHint")}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-password`}>{t("websitePassword")}</Label>
        <Input
          id={`${id}-password`}
          type="password"
          autoComplete="off"
          required
          value={password}
          onChange={onPassword}
          aria-describedby={`${id}-password-hint`}
        />
        <p id={`${id}-password-hint`} className="text-muted-foreground text-xs">
          {t("websitePasswordHint")}
        </p>
      </div>
      <Button type="submit" disabled={isPending} focusableWhenDisabled>
        {isPending ? t("connecting") : t("connectWebsite")}
      </Button>
    </form>
  );
};

/** Where a member connects a WordPress site, among the platforms. */
export const ConnectWebsite = ({
  workspaceId,
}: {
  readonly workspaceId: string;
}) => {
  const t = useTranslations("ChannelsPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{t("websiteTitle")}</h3>
        </CardTitle>
        <CardDescription>{t("websiteDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <WebsiteFields workspaceId={workspaceId} />
      </CardContent>
    </Card>
  );
};

interface KeySiteFieldsProps {
  readonly onConnected?: () => void;
  readonly platform: KeySitePlatform;
  /** The publication to start from: the channel's, to reconnect it. */
  readonly publication?: string;
  readonly workspaceId: string;
}

/**
 * The form that connects an account on a publishing platform with a key
 * made there for Peal: on DEV an API key, on Hashnode a personal access
 * token and the publication to publish to. The key goes to the server
 * once, and is never shown again.
 */
export const KeySiteFields = ({
  onConnected,
  platform,
  publication: startPublication = "",
  workspaceId,
}: KeySiteFieldsProps) => {
  const t = useTranslations("ChannelsPage");
  const errorText = useChannelErrorText();
  const connect = useAtomSet(connectSiteWithKey, { mode: "promiseExit" });
  const [key, setKey] = useState("");
  const [publication, setPublication] = useState(startPublication);
  const [error, setError] = useState<ChannelErrorKey | null>(null);
  const [isPending, startTransition] = useTransition();
  const id = useId();

  const onKey = (event: ChangeEvent<HTMLInputElement>) => {
    setKey(event.target.value);
  };

  const onPublication = (event: ChangeEvent<HTMLInputElement>) => {
    setPublication(event.target.value);
  };

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const named = publication.trim();

    startTransition(async () => {
      const exit = await connect({
        params: { workspaceId },
        payload:
          platform === "hashnode" && named !== ""
            ? { apiKey: key, platform, publication: named }
            : { apiKey: key, platform },
        reactivityKeys: channelsChanged(workspaceId),
      });

      Option.match(failureOf(exit), {
        onNone: () => {
          if (exit._tag === "Success") {
            setKey("");
            toast.success(
              t("websiteConnected", {
                site: exit.value.displayName ?? exit.value.handle,
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
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-key`}>{t(`keySite.${platform}.key`)}</Label>
        <Input
          id={`${id}-key`}
          type="password"
          autoComplete="off"
          required
          value={key}
          onChange={onKey}
          aria-describedby={`${id}-key-hint`}
        />
        <p id={`${id}-key-hint`} className="text-muted-foreground text-xs">
          {t(`keySite.${platform}.keyHint`)}
        </p>
      </div>
      {platform === "hashnode" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-publication`}>
            {t("keySite.hashnode.publication")}
          </Label>
          <Input
            id={`${id}-publication`}
            autoCapitalize="none"
            spellCheck={false}
            value={publication}
            onChange={onPublication}
            aria-describedby={`${id}-publication-hint`}
          />
          <p
            id={`${id}-publication-hint`}
            className="text-muted-foreground text-xs"
          >
            {t("keySite.hashnode.publicationHint")}
          </p>
        </div>
      ) : null}
      <Button type="submit" disabled={isPending} focusableWhenDisabled>
        {isPending ? t("connecting") : t(`keySite.${platform}.connect`)}
      </Button>
    </form>
  );
};

/** Where a member connects an account on DEV or Hashnode. */
export const ConnectKeySite = ({
  platform,
  workspaceId,
}: {
  readonly platform: KeySitePlatform;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("ChannelsPage");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{t(`keySite.${platform}.title`)}</h3>
        </CardTitle>
        <CardDescription>
          {t(`keySite.${platform}.description`)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <KeySiteFields platform={platform} workspaceId={workspaceId} />
      </CardContent>
    </Card>
  );
};

/**
 * Sends the member to sign in on WordPress.com, for a new site or to
 * reconnect `channelId`'s; the callback page completes it.
 */
const useWordPressComSignIn = (workspaceId: string) => {
  const errorText = useChannelErrorText();
  const start = useAtomSet(startSiteSignIn, { mode: "promiseExit" });
  const [isPending, startTransition] = useTransition();

  const signIn = (channelId?: string) => {
    startTransition(async () => {
      const exit = await start({
        params: { platform: "wordpressCom", workspaceId },
        payload: channelId === undefined ? {} : { channelId },
      });

      Option.match(failureOf(exit), {
        onNone: () => {
          if (exit._tag === "Success") {
            rememberConnection({ platform: "wordpressCom", workspaceId });
            globalThis.location.assign(exit.value.authorizationUrl);
          }
        },
        onSome: (key) => {
          toast.error(errorText(key));
        },
      });
    });
  };

  return { isPending, signIn };
};

/** Where a member connects a site on WordPress.com, by signing in there. */
export const ConnectWordPressCom = ({
  workspaceId,
}: {
  readonly workspaceId: string;
}) => {
  const t = useTranslations("ChannelsPage");
  const platforms = useTranslations("PlatformConnect");
  const { isPending, signIn } = useWordPressComSignIn(workspaceId);

  const onClick = () => {
    signIn();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{t("wordpressCom.title")}</h3>
        </CardTitle>
        <CardDescription>{t("wordpressCom.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button disabled={isPending} focusableWhenDisabled onClick={onClick}>
          {isPending ? platforms("connecting") : t("wordpressCom.connect")}
        </Button>
      </CardContent>
    </Card>
  );
};

/**
 * Reconnects a website's channel: a WordPress site of its own with the
 * same form on its address, for a new application password; an account on
 * DEV or Hashnode with a new key; a site on WordPress.com by signing in
 * there again.
 */
export const ReconnectWebsite = ({
  handle,
  id: channelId,
  needsReconnect,
  platform,
  workspaceId,
}: {
  /** The site's home page without its scheme, as the channel keeps it. */
  readonly handle: string;
  readonly id: string;
  readonly needsReconnect: boolean;
  readonly platform: ChannelPlatform;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("ChannelsPage");
  const [open, setOpen] = useState(false);
  const { isPending, signIn } = useWordPressComSignIn(workspaceId);

  const close = () => {
    setOpen(false);
  };

  if (platform === "wordpressCom") {
    const onClick = () => {
      signIn(channelId);
    };

    return (
      <Button
        variant={needsReconnect ? "default" : "outline"}
        size="sm"
        disabled={isPending}
        focusableWhenDisabled
        aria-label={t("reconnectAccount", { handle })}
        onClick={onClick}
      >
        {t("reconnect")}
      </Button>
    );
  }

  const keyed = platform === "devto" || platform === "hashnode";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={needsReconnect ? "default" : "outline"}
            size="sm"
            aria-label={t("reconnectAccount", { handle })}
          />
        }
      >
        {t("reconnect")}
      </DialogTrigger>
      <DialogContent closeLabel={t("cancel")}>
        <DialogHeader>
          <DialogTitle>
            {keyed
              ? t("reconnectKeySite", { handle })
              : t("reconnectWebsite", { handle })}
          </DialogTitle>
          <DialogDescription>
            {keyed
              ? t(`keySite.${platform}.description`)
              : t("websiteDescription")}
          </DialogDescription>
        </DialogHeader>
        {keyed ? (
          <KeySiteFields
            onConnected={close}
            platform={platform}
            publication={
              platform === "hashnode" ? publicationAddressOf(handle) : ""
            }
            workspaceId={workspaceId}
          />
        ) : (
          <WebsiteFields
            address={`https://${handle}`}
            onConnected={close}
            workspaceId={workspaceId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
