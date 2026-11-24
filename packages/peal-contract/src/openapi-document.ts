import { HttpApi, OpenApi } from "effect/http-api";

import { PublicApi } from "./api.ts";
import { WebhookPayloadSchema } from "./webhook-events.ts";
import type { WebhookEventType } from "./webhook-events.ts";

// The API's OpenAPI document, with the events Peal sends to webhook
// endpoints in its `webhooks` section (OpenAPI 3.1): one entry per event
// type, whose request body is that type's payload, a component like any
// other. The contract's script writes it for the docs, and the server
// serves the same at /api/openapi.json.

/** What each event tells, as the docs' table of events says it. */
const summaries = {
  "boost.budget_reached": "A boost spent its whole total budget",
  "boost.ended": "A boost's end date passed",
  "boost.failed": "A boost could not be made, and nothing ran",
  "boost.paused": "A member paused a boost",
  "boost.resumed": "A member ran a paused boost again",
  "boost.started": "A boost was made and turned on",
  "boost.stopped": "A member stopped a boost for good",
  "boost.unconfirmed": "Peal cannot tell whether a boost runs",
  "channel.connected":
    "An account was connected, or a channel authorized again",
  "channel.disabled": "A member turned a channel off",
  "channel.disconnected": "A channel was disconnected",
  "channel.enabled": "A member turned a channel back on",
  "channel.expiring":
    "A channel's authorization ends soon, and cannot be renewed",
  "channel.reconnect_needed": "A channel's authorization stopped working",
  "comment.received": "Someone commented under a post that went live",
  "comment.replied": "A reply to a comment went out from Peal",
  "review.received": "Someone reviewed a location a channel posts as",
  "review.replied": "A reply to a review went out from Peal",
  "message.received": "Someone sent a direct message to a channel's account",
  "message.sent": "A direct message went out from Peal",
  "media.failed": "A file was refused, or could not be read",
  "article.failed": "An article did not go to its website",
  "article.published": "An article went to its website",
  "media.ready": "A file was read, and can go in posts",
  "post.approval_requested": "A post waits for an approval",
  "post.approved": "A post that waited was approved",
  "post.cancelled": "A post was cancelled",
  "post.changes_requested": "Changes were asked for on a post that waited",
  "post.edit_failed":
    "Peal could not edit a post's text on a channel's platform",
  "post.edited": "A post's text was edited on a channel's platform",
  "post.failed": "A post did not go out on a channel",
  "post.finished": "Every channel of a post has its result",
  "post.published": "A post went live on a channel",
  "post.scheduled": "A post was scheduled, or moved to another time",
  "post.unconfirmed": "Peal cannot tell whether a post went live on a channel",
  "post.unpublish_failed":
    "Peal could not delete a post from a channel's platform",
  "post.unpublished": "A post was deleted from a channel's platform",
  "post.unscheduled":
    "A scheduled post, or one that waited, was taken back to draft",
  "webhook.test": "Someone asked for a test event",
} satisfies { readonly [Type in WebhookEventType]: string };

// `post.finished` as `PostFinished`.
const pascalCase = (type: string): string =>
  type
    .split(/[._]/u)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join("");

/** The component that names an event type's payload. */
export const webhookPayloadComponent = (type: WebhookEventType): string =>
  `Webhook${pascalCase(type)}Payload`;

/** The operation that names an event type's request, as generators need one. */
export const webhookOperationId = (type: WebhookEventType): string =>
  `on${pascalCase(type)}`;

const payloads = WebhookPayloadSchema.members.map((member) => {
  const type = member.fields.type.literal;

  return {
    schema: member.annotate({
      description: `The body of a \`${type}\` webhook request.`,
      identifier: webhookPayloadComponent(type),
    }),
    type,
  };
});

// The Standard Webhooks headers every request carries.
const parameters = [
  {
    description:
      "The event's id: the same on every delivery of the event, so a receiver deduplicates on it.",
    in: "header",
    name: "webhook-id",
    required: true,
    schema: { type: "string" },
  },
  {
    description:
      "When the attempt was made, in seconds since the Unix epoch: refuse one too far from now.",
    in: "header",
    name: "webhook-timestamp",
    required: true,
    schema: { type: "string" },
  },
  {
    description:
      "One `v1,<base64 HMAC-SHA256>` per signing secret, separated by spaces, over `<webhook-id>.<webhook-timestamp>.<body>`.",
    in: "header",
    name: "webhook-signature",
    required: true,
    schema: { type: "string" },
  },
] as const;

/** One webhook's request, as the OpenAPI document describes it. */
export interface WebhookOperation {
  readonly description: string;
  readonly operationId: string;
  readonly parameters: typeof parameters;
  readonly requestBody: {
    readonly content: {
      readonly "application/json": {
        readonly schema: { readonly $ref: string };
      };
    };
    readonly required: true;
  };
  readonly responses: {
    readonly "2XX": { readonly description: string };
  };
  readonly summary: string;
}

/** The API's document, with the events Peal sends. */
export type PealOpenApiDocument = OpenApi.OpenAPISpec & {
  // By event type.
  readonly webhooks: Readonly<
    Record<string, { readonly post: WebhookOperation }>
  >;
};

/** The webhooks section: one entry per event type, `webhook.test` included. */
const webhooks = (): PealOpenApiDocument["webhooks"] => {
  const entries = payloads.map(({ type }) => {
    const post: WebhookOperation = {
      description: `Peal sends this to the endpoints that subscribe to \`${type}\`, signed as the Standard Webhooks specification says. Answer any 2xx once it is taken; any other answer, or none within 15 seconds, is tried again.`,
      operationId: webhookOperationId(type),
      parameters,
      requestBody: {
        content: {
          "application/json": {
            schema: {
              $ref: `#/components/schemas/${webhookPayloadComponent(type)}`,
            },
          },
        },
        required: true,
      },
      responses: {
        "2XX": { description: "The receiver took the event." },
      },
      summary: summaries[type],
    };

    return [type, { post }] as const;
  });

  return Object.fromEntries(entries);
};

/** How the reference shows a top-level namespace. */
interface NamespaceTag {
  readonly description: string;
  readonly name: string;
}

/**
 * How the reference shows each top-level namespace: its name and what it
 * holds. A group's identifier is its namespace (`inbox.messages`), and its
 * operations are filed under the first segment (`inbox`).
 */
export const namespaceTags = new Map<string, NamespaceTag>([
  [
    "ads",
    {
      description: "Connect ad accounts, read how ads did, and boost posts.",
      name: "Ads",
    },
  ],
  [
    "analytics",
    {
      description: "How posts and channels did.",
      name: "Analytics",
    },
  ],
  [
    "approvals",
    {
      description:
        "Posts that wait for an approval: comments, approvals, requested changes and review links.",
      name: "Approvals",
    },
  ],
  [
    "articles",
    {
      description: "Articles published to the websites connected as channels.",
      name: "Articles",
    },
  ],
  [
    "assistant",
    {
      description:
        "Suggestions for a post's text, and the AI providers and models a workspace uses.",
      name: "Assistant",
    },
  ],
  [
    "automations",
    {
      description:
        "Queues, recycling, follow-ups, comment rules and feeds, which post or answer on their own.",
      name: "Automations",
    },
  ],
  [
    "billingAccountsDesk",
    {
      description: "Billing accounts, for Peal's staff.",
      name: "Billing accounts desk",
    },
  ],
  [
    "captcha",
    {
      description: "The challenge a browser solves before signing up.",
      name: "Captcha",
    },
  ],
  [
    "channelOAuth",
    {
      description: "What platforms read to let a channel sign in.",
      name: "Channel sign-in",
    },
  ],
  [
    "channels",
    {
      description:
        "The accounts and websites a workspace posts to, what each takes, and their default options.",
      name: "Channels",
    },
  ],
  [
    "clientErrors",
    {
      description: "Errors the web app reports.",
      name: "Client errors",
    },
  ],
  [
    "contractRequests",
    {
      description: "Requests to end or change a contract.",
      name: "Contract requests",
    },
  ],
  [
    "contractRequestsDesk",
    {
      description: "Contract requests, for Peal's staff.",
      name: "Contract requests desk",
    },
  ],
  [
    "credential",
    {
      description: "What the credential of a request is, and what it may do.",
      name: "Credential",
    },
  ],
  [
    "dataDeletion",
    {
      description: "Platforms' requests to delete a person's data.",
      name: "Data deletion",
    },
  ],
  [
    "hostedConnect",
    {
      description: "The page a connect link opens.",
      name: "Hosted connect",
    },
  ],
  [
    "inbox",
    {
      description:
        "Comments, direct messages and reviews, and the answers to them.",
      name: "Inbox",
    },
  ],
  [
    "legal",
    {
      description: "Requests from authorities, for Peal's staff.",
      name: "Legal",
    },
  ],
  [
    "links",
    {
      description: "The short links in posts, and how often they were opened.",
      name: "Links",
    },
  ],
  [
    "me",
    {
      description:
        "The person signed in: their notices, notification preferences and account.",
      name: "Me",
    },
  ],
  [
    "media",
    {
      description:
        "The media library: uploads, and images, voice-overs, transcripts, videos and slideshows made for it.",
      name: "Media",
    },
  ],
  [
    "partner",
    {
      description:
        "A partner's customer workspaces, its usage, and the partner account itself.",
      name: "Partner",
    },
  ],
  [
    "posts",
    {
      description:
        "Posts, from draft to published, with their tags and signatures.",
      name: "Posts",
    },
  ],
  [
    "reviewLink",
    {
      description: "The page a review link opens.",
      name: "Review link",
    },
  ],
  [
    "staff",
    {
      description: "The staff console.",
      name: "Staff",
    },
  ],
  [
    "system",
    {
      description: "Health checks and the API's changelog.",
      name: "System",
    },
  ],
  [
    "webhooks",
    {
      description: "The endpoints a workspace's events are sent to.",
      name: "Webhook endpoints",
    },
  ],
  [
    "workspace",
    {
      description:
        "The workspace itself: members, invitations, API keys, activity, billing and usage.",
      name: "Workspace",
    },
  ],
]);

const methodNames: readonly OpenApi.OpenAPISpecMethodName[] = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
];

// The operation's top-level namespace, or its group's tag for an operation
// whose id holds none (the health checks).
const tagOf = (operation: OpenApi.OpenAPISpecOperation): string => {
  const dot = operation.operationId.indexOf(".");

  return dot === -1 ? operation.tags[0] : operation.operationId.slice(0, dot);
};

/**
 * The document with each operation filed under its top-level namespace,
 * and those tags listed once each, in the order they first come, with the
 * name and description `namespaceTags` gives them.
 */
const byNamespace = (document: OpenApi.OpenAPISpec): OpenApi.OpenAPISpec => {
  const seen: string[] = [];

  const filed = (
    item: OpenApi.OpenAPISpecPathItem
  ): OpenApi.OpenAPISpecPathItem => {
    const copy = { ...item };

    for (const method of methodNames) {
      const operation = item[method];

      if (operation !== undefined) {
        const tag = tagOf(operation);

        if (!seen.includes(tag)) {
          seen.push(tag);
        }

        copy[method] = { ...operation, tags: [tag] };
      }
    }

    return copy;
  };

  const paths = Object.fromEntries(
    Object.entries(document.paths).map(([path, item]) => [path, filed(item)])
  );

  return {
    ...document,
    paths,
    tags: seen.map((name) => {
      const shown = namespaceTags.get(name);

      return shown === undefined
        ? { name }
        : { description: shown.description, name, "x-displayName": shown.name };
    }),
  };
};

/**
 * The OpenAPI 3.1 document of the public API (`PublicApi`) and of the
 * events it sends: what the contract writes to `openapi.json` and the
 * server serves. Peal's own clients' groups and the staff console's
 * (`appGroups`, `staffGroups`) are not in it.
 */
export const openApiDocument = (): PealOpenApiDocument => ({
  ...byNamespace(
    OpenApi.fromApi(
      PublicApi.annotate(
        HttpApi.AdditionalSchemas,
        payloads.map(({ schema }) => schema)
      )
    )
  ),
  webhooks: webhooks(),
});
