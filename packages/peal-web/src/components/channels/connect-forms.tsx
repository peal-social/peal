"use client";

import { useTranslations } from "next-intl";
import type {
  ChannelPlatform,
  ChatPlatform,
  InstagramConnection,
  LinkedInConnection,
  Platform,
  SitePlatform,
} from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "peal-ui/components/card";
import { Input } from "peal-ui/components/input";
import { Label } from "peal-ui/components/label";
import { useState } from "react";
import type { ChangeEvent, SubmitEvent } from "react";

import { useChannelErrorText } from "#channels/channel-error-text.ts";
import type { ChannelErrorKey } from "#channels/channels-api.ts";
import { useConnect } from "#channels/use-connect.ts";
import { ConnectChat } from "#components/channels/connect-chat.tsx";
import { ConnectInstagram } from "#components/channels/connect-instagram.tsx";
import { ConnectLinkedIn } from "#components/channels/connect-linkedin.tsx";
import { ConnectMeta } from "#components/channels/connect-meta.tsx";
import type { MetaPlatform } from "#components/channels/connect-meta.tsx";
import {
  ConnectKeySite,
  ConnectWebsite,
  ConnectWordPressCom,
} from "#components/channels/connect-website.tsx";

const ErrorMessage = ({
  error,
}: {
  readonly error: ChannelErrorKey | null;
}) => {
  const errorText = useChannelErrorText();

  return error === null ? null : (
    <Alert variant="destructive">
      <AlertDescription>{errorText(error)}</AlertDescription>
    </Alert>
  );
};

interface FieldProps {
  readonly hint: string;
  readonly id: string;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly required: boolean;
  readonly value: string;
}

const Field = ({ hint, id, label, onChange, required, value }: FieldProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={value}
        onChange={handleChange}
        aria-describedby={`${id}-hint`}
        required={required}
      />
      <p id={`${id}-hint`} className="text-muted-foreground text-xs">
        {hint}
      </p>
    </div>
  );
};

const ConnectMastodon = ({ workspaceId }: { readonly workspaceId: string }) => {
  const t = useTranslations("ChannelsPage");
  const [instance, setInstance] = useState("");
  const { error, isPending, start } = useConnect(workspaceId, "mastodon");

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    start({ instance });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{t("mastodonTitle")}</h3>
        </CardTitle>
        <CardDescription>{t("mastodonDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ErrorMessage error={error} />
          <Field
            id="mastodon-instance"
            label={t("instance")}
            hint={t("instanceHint")}
            value={instance}
            onChange={setInstance}
            required
          />
          <Button type="submit" disabled={isPending} focusableWhenDisabled>
            {isPending ? t("connecting") : t("connectMastodon")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

const ConnectBluesky = ({ workspaceId }: { readonly workspaceId: string }) => {
  const t = useTranslations("ChannelsPage");
  const [handle, setHandle] = useState("");
  const { error, isPending, start } = useConnect(workspaceId, "bluesky");

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    start(handle.trim() === "" ? {} : { handle });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{t("blueskyTitle")}</h3>
        </CardTitle>
        <CardDescription>{t("blueskyDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ErrorMessage error={error} />
          <Field
            id="bluesky-handle"
            label={t("handle")}
            hint={t("handleHint")}
            value={handle}
            onChange={setHandle}
            required={false}
          />
          <Button type="submit" disabled={isPending} focusableWhenDisabled>
            {isPending ? t("connecting") : t("connectBluesky")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

// The platforms whose sign-in needs nothing typed first: a button.
type ButtonPlatform =
  | "googleBusiness"
  | "linkedin"
  | "pinterest"
  | "slack"
  | "snapchat"
  | "tiktok"
  | "x"
  | "youtube";

const buttonPlatforms: readonly ButtonPlatform[] = [
  "linkedin",
  "x",
  "tiktok",
  "youtube",
  "pinterest",
  "googleBusiness",
  "slack",
  "snapchat",
];

const ConnectWithButton = ({
  platform,
  workspaceId,
}: {
  readonly platform: ButtonPlatform;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("PlatformConnect");
  const { error, isPending, start } = useConnect(workspaceId, platform);

  const handleClick = () => {
    start({});
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>{t(`${platform}.title`)}</h3>
        </CardTitle>
        <CardDescription>{t(`${platform}.description`)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <ErrorMessage error={error} />
          <Button
            type="button"
            onClick={handleClick}
            disabled={isPending}
            focusableWhenDisabled
          >
            {isPending ? t("connecting") : t(`${platform}.connect`)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const ConnectWithMeta = ({
  platform,
  workspaceId,
}: {
  readonly platform: MetaPlatform;
  readonly workspaceId: string;
}) => {
  const { error, isPending, start } = useConnect(workspaceId, platform);

  const handleConnect = () => {
    start({});
  };

  return (
    <ConnectMeta
      platform={platform}
      error={error}
      isPending={isPending}
      onConnect={handleConnect}
    />
  );
};

const ConnectWithLinkedIn = ({
  connections,
  workspaceId,
}: {
  readonly connections: readonly LinkedInConnection[];
  readonly workspaceId: string;
}) => {
  const { error, isPending, start } = useConnect(workspaceId, "linkedin");

  const handleConnect = (connection: LinkedInConnection) => {
    start({ connection });
  };

  return (
    <ConnectLinkedIn
      connections={connections}
      error={error}
      isPending={isPending}
      onConnect={handleConnect}
    />
  );
};

const ConnectWithInstagram = ({
  connections,
  workspaceId,
}: {
  readonly connections: readonly InstagramConnection[];
  readonly workspaceId: string;
}) => {
  const { error, isPending, start } = useConnect(workspaceId, "instagram");

  const handleConnect = (connection: InstagramConnection) => {
    start({ connection });
  };

  return (
    <ConnectInstagram
      connections={connections}
      error={error}
      isPending={isPending}
      onConnect={handleConnect}
    />
  );
};

// A server that names no website sign-in: those by address and key alone.
const noSites: readonly SitePlatform[] = [];

// A server that names no chat.
const noChats: readonly ChatPlatform[] = [];

/** What this server connects, as `GET …/channels/platforms` answers it. */
export interface Connectable {
  /** The chats the server connects, each with a secret. */
  readonly chats?: readonly ChatPlatform[] | undefined;
  readonly instagramConnections: readonly InstagramConnection[];
  /** What the server connects on LinkedIn: profiles, pages, or both. */
  readonly linkedinConnections: readonly LinkedInConnection[];
  readonly platforms: readonly Platform[];
  /** The websites the server connects, WordPress.com when it has its app. */
  readonly sites?: readonly SitePlatform[] | undefined;
}

// The order the platforms are offered in.
const offerOrder: readonly ChannelPlatform[] = [
  "mastodon",
  "bluesky",
  "linkedin",
  "x",
  "tiktok",
  "youtube",
  "pinterest",
  "snapchat",
  "googleBusiness",
  "slack",
  "instagram",
  "facebook",
  "threads",
  "wordpress",
  "wordpressCom",
  "devto",
  "hashnode",
  "discord",
  "telegram",
];

/**
 * The platforms a member may start connecting on this server, each once,
 * in the order they are offered: those the server has settings for
 * (Instagram only with a way in), a WordPress site of one's own, DEV and
 * Hashnode, which every server connects, WordPress.com on a server with
 * its app, and the chats the server names.
 */
export const connectablesOf = ({
  chats = noChats,
  instagramConnections,
  platforms,
  sites = noSites,
}: Connectable): readonly ChannelPlatform[] => {
  const offered = new Set<ChannelPlatform>([
    ...platforms.filter(
      (platform) => platform !== "instagram" || instagramConnections.length > 0
    ),
    "wordpress",
    "devto",
    "hashnode",
    ...sites.filter((site) => site === "wordpressCom"),
  ]);

  // A chat is offered where the server names it, not by its settings.
  const named = new Set<ChannelPlatform>(chats);

  return offerOrder.filter((platform) =>
    platform === "discord" || platform === "telegram"
      ? named.has(platform)
      : offered.has(platform)
  );
};

const isButtonPlatform = (
  platform: ChannelPlatform
): platform is ButtonPlatform =>
  buttonPlatforms.some((each) => each === platform);

/**
 * Where a member starts connecting an account of one platform: a form for
 * Mastodon and Bluesky, which ask for a server or a handle; a button for
 * X, TikTok, YouTube, Pinterest, Snapchat, Google Business Profile and
 * Slack; one
 * for each of Instagram's ways in the server has; one for a LinkedIn
 * profile, and one for company pages on a server that connects pages;
 * Meta's sign-in for Threads and Facebook Pages; a WordPress site by its
 * address and an application password, DEV and Hashnode by a key, a site
 * on WordPress.com by signing in there; and a chat with the secret its
 * member pastes, linking the docs where the operator publishes them.
 */
export const ConnectForm = ({
  connectable,
  docsUrl = null,
  platform,
  workspaceId,
}: {
  readonly connectable: Connectable;
  /** Where the operator publishes the docs; none when it does not. */
  readonly docsUrl?: string | null;
  readonly platform: ChannelPlatform;
  readonly workspaceId: string;
}) => {
  // A server with the app for pages offers the choice; one without keeps
  // LinkedIn's single button, for a profile.
  if (
    platform === "linkedin" &&
    connectable.linkedinConnections.includes("linkedinPage")
  ) {
    return (
      <ConnectWithLinkedIn
        connections={connectable.linkedinConnections}
        workspaceId={workspaceId}
      />
    );
  }

  if (isButtonPlatform(platform)) {
    return <ConnectWithButton platform={platform} workspaceId={workspaceId} />;
  }

  switch (platform) {
    case "mastodon": {
      return <ConnectMastodon workspaceId={workspaceId} />;
    }

    case "bluesky": {
      return <ConnectBluesky workspaceId={workspaceId} />;
    }

    case "instagram": {
      return (
        <ConnectWithInstagram
          connections={connectable.instagramConnections}
          workspaceId={workspaceId}
        />
      );
    }

    case "facebook":
    case "threads": {
      return <ConnectWithMeta platform={platform} workspaceId={workspaceId} />;
    }

    case "wordpress": {
      return <ConnectWebsite workspaceId={workspaceId} />;
    }

    case "wordpressCom": {
      return <ConnectWordPressCom workspaceId={workspaceId} />;
    }

    case "devto":
    case "hashnode": {
      return <ConnectKeySite platform={platform} workspaceId={workspaceId} />;
    }

    case "discord":
    case "telegram": {
      return (
        <ConnectChat
          docsUrl={docsUrl}
          platform={platform}
          workspaceId={workspaceId}
        />
      );
    }

    default: {
      return null;
    }
  }
};

/** Every platform's form this server offers, in a grid. */
export const ConnectForms = ({
  docsUrl = null,
  workspaceId,
  ...connectable
}: Connectable & {
  /** Where the operator publishes the docs; none when it does not. */
  readonly docsUrl?: string | null;
  readonly workspaceId: string;
}) => (
  <div className="grid gap-4 sm:grid-cols-2">
    {connectablesOf(connectable).map((platform) => (
      <ConnectForm
        key={platform}
        connectable={connectable}
        docsUrl={docsUrl}
        platform={platform}
        workspaceId={workspaceId}
      />
    ))}
  </div>
);
