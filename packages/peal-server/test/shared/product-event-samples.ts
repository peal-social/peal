import {
  ChannelIdSchema,
  PostIdSchema,
  UserIdSchema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";
import type {
  GroupPropertiesInput,
  PersonPropertiesInput,
  ProductEvent,
  ProductEventName,
} from "#shared/domain/product-event.ts";

export const sampleUserId = UserIdSchema.make(
  "6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f"
);

export const sampleWorkspaceId = WorkspaceIdSchema.make(
  "0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e"
);

const channelId = ChannelIdSchema.make("00000000-0000-7000-8000-000000000001");

const postId = PostIdSchema.make("00000000-0000-7000-8000-000000000002");

/** A sample of each event, with the keys the catalogue sends it with. */
export type ProductEventSamples = {
  readonly [Name in ProductEventName]: {
    readonly keys: readonly string[];
    readonly sample: Extract<ProductEvent, { readonly name: Name }>;
  };
};

/**
 * One sample of each event of the catalogue, every optional property set,
 * with the keys the catalogue says it is sent with. Typed so a new event
 * does not compile until it has its sample.
 */
export const productEventSamples: ProductEventSamples = {
  api_operation: {
    keys: ["error_code", "operation", "status", "succeeded", "via"],
    sample: {
      name: "api_operation",
      properties: {
        errorCode: "plan_limit_reached",
        operation: "posts.create",
        status: 403,
        succeeded: false,
        via: "apiKey",
      },
    },
  },
  channel_connected: {
    keys: ["channel_id", "platform", "reconnected"],
    sample: {
      name: "channel_connected",
      properties: { channelId, platform: "bluesky", reconnected: false },
    },
  },
  channel_disconnected: {
    keys: ["channel_id", "platform"],
    sample: {
      name: "channel_disconnected",
      properties: { channelId, platform: "wordpress" },
    },
  },
  mcp_tool_called: {
    keys: ["changes", "duration_ms", "error_type", "is_error", "tool"],
    sample: {
      name: "mcp_tool_called",
      properties: {
        changes: true,
        durationMs: 12,
        errorType: "tool_refused",
        isError: true,
        tool: "schedule_post",
      },
    },
  },
  post_failed: {
    keys: ["channel_id", "platform", "post_id", "reason", "round"],
    sample: {
      name: "post_failed",
      properties: {
        channelId,
        platform: "x",
        postId,
        reason: "tokenExpired",
        round: 1,
      },
    },
  },
  post_published: {
    keys: ["channel_id", "platform", "post_id", "round"],
    sample: {
      name: "post_published",
      properties: { channelId, platform: "linkedin", postId, round: 2 },
    },
  },
  post_scheduled: {
    keys: ["post_id", "target_count"],
    sample: {
      name: "post_scheduled",
      properties: { postId, targetCount: 3 },
    },
  },
  subscription_changed: {
    keys: [
      "cancel_at_period_end",
      "free_tier",
      "interval",
      "kind",
      "plan",
      "standalone",
      "status",
      "subscription_status",
      "workspace_plan",
    ],
    sample: {
      name: "subscription_changed",
      properties: {
        cancelAtPeriodEnd: false,
        freeTier: true,
        interval: "month",
        kind: "person",
        plan: "payAsYouGo",
        standalone: false,
        status: "active",
        subscriptionStatus: "active",
        workspacePlan: "payAsYouGo",
      },
    },
  },
  user_signed_up: {
    keys: ["locale", "method"],
    sample: {
      name: "user_signed_up",
      properties: { locale: "fr", method: "password" },
    },
  },
  workspace_created: {
    keys: ["free_tier", "kind", "standalone"],
    sample: {
      name: "workspace_created",
      properties: { freeTier: true, kind: "partner", standalone: false },
    },
  },
  workspace_snapshot: {
    keys: [
      "assistant_requests",
      "channels",
      "day",
      "media_storage_bytes",
      "members",
    ],
    sample: {
      name: "workspace_snapshot",
      properties: {
        assistantRequests: 4,
        channels: 3,
        day: "2026-11-18",
        mediaStorageBytes: 9_000_000_000,
        members: 2,
      },
    },
  },
};

// Objects built elsewhere, as a bug could, with a key the catalogue does
// not declare beside one it does: the types take them, the guard does not.
const withEmail = { email: "someone@example.com", freeTier: true };

const withName = { kind: "user" as const, name: "Ana" };

const withTitle = { created_at: "2026-11-18T10:00:00.000Z", title: "Shop" };

/** An event with a key its schema does not declare. */
export const undeclaredEvent: ProductEvent = {
  name: "workspace_created",
  properties: withEmail,
};

/** Person properties with a key Peal never sets. */
export const undeclaredPerson: PersonPropertiesInput = withName;

/** Group properties with a key Peal never sets. */
export const undeclaredGroup: GroupPropertiesInput = withTitle;
