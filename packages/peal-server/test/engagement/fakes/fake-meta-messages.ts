import { createHmac } from "node:crypto";

import { Effect, Schema } from "effect";

import {
  facebookPageId,
  graphAppSecret,
  instagramUserId,
} from "#test/publishing/fakes/fake-meta-graph.ts";
import {
  dropped,
  json,
  platformServer,
  scripted,
  textOf,
} from "#test/publishing/fakes/platform-server.ts";
import type {
  JsonValue,
  PlatformAnswer,
  PlatformRequest,
} from "#test/publishing/fakes/platform-server.ts";

// Meta's Conversations API and Send API on one loopback server, for the
// three ways in: a Page (`platform=messenger`), an Instagram account
// through its Page (`platform=instagram`, on graph.facebook.com with the
// Page's token and its proof) and an Instagram account through Instagram
// Login (graph.instagram.com, its own token, no proof). It answers only
// its own routes, as Meta's pages describe them (read 2026-11-16): a
// conversation's messages come with their details for the 20 latest only.

/** A message the fake keeps, the latest last. */
export interface FakeDirect {
  readonly id: string;
  /** Who sent it; none where Meta would not say. */
  readonly from?: { readonly id: string; readonly name: string };
  readonly text: string;
  readonly createdTime: string;
  /** Files attached, by id; their addresses are made up from the id. */
  readonly attachments?: readonly string[];
  /** A story it mentions the account in, by id. */
  readonly story?: string;
}

/** A conversation the fake keeps. */
export interface FakeConversation {
  readonly id: string;
  /** `messenger` for a Page's, `instagram` otherwise. */
  readonly platform: "instagram" | "messenger";
  readonly participants: readonly {
    readonly id: string;
    readonly name?: string;
    readonly username?: string;
  }[];
  updatedTime: string;
  readonly messages: FakeDirect[];
}

export interface FakeMetaMessagesOptions {
  /** Plays graph.instagram.com: tokens carry no proof. */
  readonly instagramLogin?: boolean;
  /** When the messages the fake sends were written. */
  readonly now?: string;
  /** The account the token speaks for: the Page, or the Instagram account. */
  readonly me?: string;
  /** The Instagram account linked to the Page, on graph.facebook.com. */
  readonly linkedInstagram?: string;
}

type Params = Readonly<Record<string, string>>;

const asJson = Schema.decodeUnknownSync(Schema.Json);

const proofOf = (token: string) =>
  createHmac("sha256", graphAppSecret).update(token).digest("hex");

// An error, a message and a node as Meta writes them.
interface GraphErrorJson {
  code: number;
  error_subcode?: number;
  is_transient?: boolean;
  fbtrace_id: string;
  message: string;
}

interface MessageJson {
  attachments?: {
    data: { id: string; image_data: { url: string } }[];
  };
  created_time: string;
  from?: { id: string; name?: string; username?: string };
  id: string;
  message: string;
  story?: { mention: { id: string; link: string } };
}

interface NodeJson {
  id: string;
  instagram_business_account?: { id: string };
}

/** An error as Meta's Graph writes one, with its subcode. */
export const graphError = (
  code: number,
  subcode?: number,
  status = 400,
  transient?: boolean
): PlatformAnswer => {
  const error: GraphErrorJson = {
    code,
    fbtrace_id: "synthetic",
    message: "synthetic",
  };

  if (subcode !== undefined) {
    error.error_subcode = subcode;
  }

  if (transient !== undefined) {
    error.is_transient = transient;
  }

  return json(asJson({ error }), status);
};

const paramsOf = (request: PlatformRequest): Record<string, string> => {
  const query = Object.fromEntries(request.query);

  return request.method === "POST"
    ? { ...query, ...Object.fromEntries(new URLSearchParams(textOf(request))) }
    : query;
};

// How many of a conversation's latest messages come with their details.
const detailed = 20;

const conversationPattern = /^\/v27\.0\/(?<id>c[\w-]+)$/u;

/**
 * The fake's Graph, for tokens in `tokens`. Queued `script` answers come
 * first; `loseAnswer` carries a call out and drops its answer,
 * `dropBefore` drops it without carrying it out.
 */
export const fakeMetaMessages = Effect.fnUntraced(function* fakeMetaMessages(
  tokens: readonly string[],
  options: FakeMetaMessagesOptions = {}
) {
  const conversations: FakeConversation[] = [];
  const subscriptions = new Map<string, string>();
  const script = scripted<PlatformAnswer>();
  const lost = scripted<"after" | "before">();
  let issued = 0;

  const me =
    options.me ??
    (options.instagramLogin === true ? instagramUserId : facebookPageId);

  const messageJson = (message: FakeDirect): JsonValue => {
    const attachments = message.attachments ?? [];

    const shown: MessageJson = {
      created_time: message.createdTime,
      id: message.id,
      message: message.text,
    };

    if (message.from !== undefined) {
      shown.from =
        message.from.id.startsWith("ig") || options.instagramLogin === true
          ? { id: message.from.id, username: message.from.name }
          : { id: message.from.id, name: message.from.name };
    }

    if (attachments.length > 0) {
      shown.attachments = {
        data: attachments.map((id) => ({
          id,
          image_data: { url: `https://cdn.example/synthetic/${id}.jpg` },
        })),
      };
    }

    if (message.story !== undefined) {
      shown.story = {
        mention: {
          id: message.story,
          link: `https://cdn.example/synthetic/story-${message.story}.jpg`,
        },
      };
    }

    return asJson(shown);
  };

  // A conversation's messages, the latest first: every id, and the
  // details of the 20 latest only, as Meta gives them.
  const messagesOf = (conversation: FakeConversation, params: Params) => {
    const latestFirst = conversation.messages.toReversed();

    const limit = Number(
      /limit\((?<n>\d+)\)/u.exec(params["fields"] ?? "")?.groups?.["n"] ?? "25"
    );

    const data = latestFirst
      .slice(0, limit)
      .map((message, index) =>
        index < detailed
          ? messageJson(message)
          : asJson({ created_time: message.createdTime, id: message.id })
      );

    return limit < latestFirst.length
      ? {
          data,
          paging: {
            cursors: { after: String(limit) },
            next: `https://graph.example/${conversation.id}/messages?after=${String(limit)}`,
          },
        }
      : { data, paging: { cursors: { after: String(limit) } } };
  };

  const listing = (params: Params, origin: string): PlatformAnswer => {
    const wanted =
      options.instagramLogin === true ? "instagram" : params["platform"];

    const start = Number(params["after"] ?? "0");
    const limit = Number(params["limit"] ?? "25");
    const shown = conversations.filter(({ platform }) => platform === wanted);

    const page = shown.slice(start, start + limit).map((conversation) =>
      asJson({
        id: conversation.id,
        participants: {
          data: conversation.participants.map((participant) => ({
            ...participant,
          })),
        },
        updated_time: conversation.updatedTime,
      })
    );

    const end = start + limit;

    return json(
      end < shown.length
        ? {
            data: page,
            paging: {
              cursors: { after: String(end) },
              next: `${origin}/v27.0/me/conversations?after=${String(end)}`,
            },
          }
        : { data: page, paging: { cursors: { after: String(end) } } }
    );
  };

  const recipientOf = Schema.decodeUnknownSync(
    Schema.fromJsonString(Schema.Struct({ id: Schema.String }))
  );

  const textOfMessage = Schema.decodeUnknownSync(
    Schema.fromJsonString(Schema.Struct({ text: Schema.String }))
  );

  const sending = (params: Params): PlatformAnswer => {
    if (params["messaging_type"] !== "RESPONSE") {
      return graphError(100);
    }

    const recipient = recipientOf(params["recipient"] ?? "");
    const { text } = textOfMessage(params["message"] ?? "");

    const conversation = conversations.find(({ participants }) =>
      participants.some(({ id }) => id === recipient.id)
    );

    if (conversation === undefined) {
      return graphError(100, 2_534_014);
    }

    issued += 1;

    const id = `m_sent_${String(issued)}`;

    conversation.messages.push({
      createdTime: options.now ?? "2026-11-16T10:00:05+0000",
      from: { id: me, name: "Synthetic Studio" },
      id,
      text,
    });
    conversation.updatedTime = options.now ?? "2026-11-16T10:00:05+0000";

    return json({ message_id: id, recipient_id: recipient.id });
  };

  // The account's own node, with the Instagram account linked to the
  // Page when asked for it.
  const node = (params: Params): PlatformAnswer => {
    const shown: NodeJson = { id: me };

    if (
      options.linkedInstagram !== undefined &&
      (params["fields"] ?? "").includes("instagram_business_account")
    ) {
      shown.instagram_business_account = { id: options.linkedInstagram };
    }

    return json(asJson(shown));
  };

  // The account's own node, its subscription, its conversations and its
  // sends: nothing else is answered.
  const routes = {
    "DELETE /v27.0/me/subscribed_apps": () => {
      subscriptions.delete(me);

      return json({ messaging_success: true, success: true });
    },
    "GET /v27.0/me": node,
    "GET /v27.0/me/conversations": listing,
    "POST /v27.0/me/messages": sending,
    "POST /v27.0/me/subscribed_apps": (params: Params) => {
      subscriptions.set(me, params["subscribed_fields"] ?? "");

      return json({ success: true });
    },
  } satisfies Readonly<
    Record<string, (params: Params, origin: string) => PlatformAnswer>
  >;

  const isRoute = (route: string): route is keyof typeof routes =>
    Object.hasOwn(routes, route);

  const routed = (
    request: PlatformRequest,
    params: Params,
    origin: string
  ): PlatformAnswer => {
    const route = `${request.method} ${request.path}`;

    if (isRoute(route)) {
      return routes[route](params, origin);
    }

    const id = conversationPattern.exec(request.path)?.groups?.["id"];
    const conversation = conversations.find((kept) => kept.id === id);

    if (request.method !== "GET" || conversation === undefined) {
      return graphError(100, 33);
    }

    return json({
      id: conversation.id,
      messages: messagesOf(conversation, params),
    });
  };

  const handle = (request: PlatformRequest, origin: string): PlatformAnswer => {
    const name = `${request.method} ${request.path}`;
    const scriptedAnswer = script.next(name);

    if (scriptedAnswer !== undefined) {
      return scriptedAnswer;
    }

    const {
      access_token: token = "",
      appsecret_proof: proof,
      ...params
    } = paramsOf(request);

    if (!tokens.includes(token)) {
      return graphError(190);
    }

    const expected =
      options.instagramLogin === true ? undefined : proofOf(token);

    if (proof !== expected) {
      return graphError(100);
    }

    const when = lost.next(name);

    if (when === "before") {
      return dropped;
    }

    const answer = routed(request, params, origin);

    return when === "after" ? dropped : answer;
  };

  const server = yield* platformServer(handle);

  return {
    ...server,
    /** Someone writes in a conversation, which the fake starts if new. */
    add: (
      conversation: Omit<FakeConversation, "messages"> & {
        readonly messages?: readonly FakeDirect[];
      }
    ) => {
      conversations.push({
        ...conversation,
        messages: [...(conversation.messages ?? [])],
      });
    },
    conversations: () => conversations,
    /** The next call of `route` reaches nothing: its answer is lost first. */
    dropBefore: (route: string) => {
      lost.push(route, ["before"]);
    },
    /** The next call of `route` is carried out, and its answer lost. */
    loseAnswer: (route: string) => {
      lost.push(route, ["after"]);
    },
    script,
    /** The fields the account is subscribed to, if it is. */
    subscription: () => subscriptions.get(me),
  };
});
