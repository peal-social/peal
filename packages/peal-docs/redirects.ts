// The addresses that moved, old then new, in both languages; the browser
// keeps the #anchor. Every one is an exact redirect: Blume writes a page for
// each, which the static docs image (nginx) serves as it is, where a pattern
// would need a host that reads _redirects. scripts/redirects.test.ts checks
// that no source is a live page and that every target is one.

// The pages' addresses before the tabs (old, new), so links already out
// there still land, in both languages; the browser keeps the #anchor.
export const movedPages: [string, string][] = [
  ["/channels", "/guides/channels"],
  ["/scheduling", "/guides/posts"],
  ["/organise", "/guides/posts/organise"],
  ["/review", "/guides/posts/review"],
  ["/media", "/guides/media"],
  ["/notifications", "/guides/workspace/notifications"],
  ["/inbox", "/guides/engage/inbox"],
  ["/analytics", "/guides/engage/analytics"],
  ["/ads", "/guides/engage/ads"],
  ["/settings", "/guides/workspace"],
  ["/billing", "/guides/workspace/billing"],
  ["/api-overview", "/developers"],
  ["/api-conventions", "/developers/conventions"],
  ["/posting-api", "/developers/posting"],
  ["/sdks", "/developers/sdks"],
  ["/webhooks", "/developers/webhooks"],
  ["/cli", "/developers/cli"],
  ["/mcp", "/developers/mcp"],
  ["/agents", "/developers/agents"],
  ["/embedding", "/developers/embedding"],
  ["/environment-variables", "/self-hosting/environment-variables"],
  ["/staff", "/self-hosting/staff"],
  [
    "/deployment",
    "https://github.com/peal-social/peal/blob/main/packages/peal-infra/DEPLOYMENT.md",
  ],
];

/**
 * The API reference's pages before the API named each group by its
 * namespace (2026-11-24), as `<tag>/<operation>` under /reference. Written
 * from the documents before and after, by Blume's rules for a tag's and an
 * operation id's slug: every operation whose page moved. Two old pages are
 * left out, as another operation's page now lives there:
 * posts/posts-list (the paged list, which was posts.search) and
 * posts/posts-create (create and send, which was posts.send).
 */
export const movedReferencePages: [string, string][] = [
  ["activity/activity-list", "workspace/workspace-activity-list"],
  ["api-keys/api-keys-create", "workspace/workspace-api-keys-create"],
  ["api-keys/api-keys-list", "workspace/workspace-api-keys-list"],
  ["api-keys/api-keys-revoke", "workspace/workspace-api-keys-revoke"],
  ["assistant/assistant-generate-image", "media/media-images-create"],
  ["billing/billing-get", "workspace/workspace-billing-get"],
  ["billing/billing-standing", "workspace/workspace-billing-standing"],
  ["capabilities/capabilities-channel", "channels/channels-capabilities-get"],
  [
    "capabilities/capabilities-platforms",
    "channels/channels-capabilities-platforms",
  ],
  [
    "channel-defaults/channel-defaults-clear",
    "channels/channels-default-options-clear",
  ],
  [
    "channel-defaults/channel-defaults-get",
    "channels/channels-default-options-get",
  ],
  [
    "channel-defaults/channel-defaults-set",
    "channels/channels-default-options-set",
  ],
  ["channel-sets/channel-sets-create", "channels/channels-sets-create"],
  ["channel-sets/channel-sets-delete", "channels/channels-sets-delete"],
  ["channel-sets/channel-sets-list", "channels/channels-sets-list"],
  ["channel-sets/channel-sets-update", "channels/channels-sets-update"],
  [
    "connect-links/connect-links-create",
    "channels/channels-connect-links-create",
  ],
  ["connect-links/connect-links-get", "channels/channels-connect-links-get"],
  ["connect-links/connect-links-list", "channels/channels-connect-links-list"],
  [
    "connect-links/connect-links-revoke",
    "channels/channels-connect-links-revoke",
  ],
  ["feeds/feeds-create", "automations/automations-feeds-create"],
  ["feeds/feeds-delete", "automations/automations-feeds-delete"],
  ["feeds/feeds-get", "automations/automations-feeds-get"],
  ["feeds/feeds-items", "automations/automations-feeds-items"],
  ["feeds/feeds-list", "automations/automations-feeds-list"],
  ["feeds/feeds-preview", "automations/automations-feeds-preview"],
  ["feeds/feeds-update", "automations/automations-feeds-update"],
  [
    "follow-ups/follow-ups-approve",
    "automations/automations-follow-ups-approve",
  ],
  ["follow-ups/follow-ups-create", "automations/automations-follow-ups-create"],
  ["follow-ups/follow-ups-delete", "automations/automations-follow-ups-delete"],
  ["follow-ups/follow-ups-get", "automations/automations-follow-ups-get"],
  ["follow-ups/follow-ups-list", "automations/automations-follow-ups-list"],
  ["follow-ups/follow-ups-update", "automations/automations-follow-ups-update"],
  [
    "inbox-messages/inbox-messages-confirm-message",
    "inbox/inbox-messages-confirm",
  ],
  [
    "inbox-messages/inbox-messages-confirm-private-reply",
    "inbox/inbox-messages-confirm-private-reply",
  ],
  [
    "inbox-messages/inbox-messages-get-conversation",
    "inbox/inbox-messages-get-conversation",
  ],
  [
    "inbox-messages/inbox-messages-get-message-settings",
    "inbox/inbox-messages-get-settings",
  ],
  [
    "inbox-messages/inbox-messages-get-private-reply",
    "inbox/inbox-messages-get-private-reply",
  ],
  [
    "inbox-messages/inbox-messages-list-conversations",
    "inbox/inbox-messages-list-conversations",
  ],
  ["inbox-messages/inbox-messages-send-message", "inbox/inbox-messages-send"],
  [
    "inbox-messages/inbox-messages-send-private-reply",
    "inbox/inbox-messages-send-private-reply",
  ],
  [
    "inbox-messages/inbox-messages-set-channel-messages",
    "inbox/inbox-messages-set-channel",
  ],
  [
    "inbox-messages/inbox-messages-set-conversation-read",
    "inbox/inbox-messages-set-conversation-read",
  ],
  [
    "inbox-messages/inbox-messages-set-message-application",
    "inbox/inbox-messages-set-application",
  ],
  [
    "inbox-reviews/inbox-reviews-get-review-thread",
    "inbox/inbox-reviews-get-thread",
  ],
  [
    "inbox-reviews/inbox-reviews-list-review-threads",
    "inbox/inbox-reviews-list-threads",
  ],
  ["inbox-reviews/inbox-reviews-reply-to-review", "inbox/inbox-reviews-reply"],
  [
    "inbox-reviews/inbox-reviews-set-review-answered",
    "inbox/inbox-reviews-set-answered",
  ],
  [
    "inbox-reviews/inbox-reviews-withdraw-review-reply",
    "inbox/inbox-reviews-withdraw-reply",
  ],
  [
    "inbox-rules/inbox-rules-create-comment-rule",
    "automations/automations-comment-rules-create",
  ],
  [
    "inbox-rules/inbox-rules-delete-comment-rule",
    "automations/automations-comment-rules-delete",
  ],
  [
    "inbox-rules/inbox-rules-get-comment-rule",
    "automations/automations-comment-rules-get",
  ],
  [
    "inbox-rules/inbox-rules-list-comment-rules",
    "automations/automations-comment-rules-list",
  ],
  [
    "inbox-rules/inbox-rules-update-comment-rule",
    "automations/automations-comment-rules-update",
  ],
  ["inbox/inbox-confirm-reply", "inbox/inbox-comments-confirm-reply"],
  ["inbox/inbox-get-abilities", "inbox/inbox-comments-get-abilities"],
  ["inbox/inbox-get-thread", "inbox/inbox-comments-get-thread"],
  ["inbox/inbox-list-threads", "inbox/inbox-comments-list-threads"],
  ["inbox/inbox-moderate", "inbox/inbox-comments-moderate"],
  ["inbox/inbox-reply", "inbox/inbox-comments-reply"],
  ["inbox/inbox-set-answered", "inbox/inbox-comments-set-answered"],
  ["inbox/inbox-withdraw-reply", "inbox/inbox-comments-withdraw-reply"],
  ["invitations/invitations-create", "workspace/workspace-invitations-create"],
  ["invitations/invitations-list", "workspace/workspace-invitations-list"],
  ["invitations/invitations-revoke", "workspace/workspace-invitations-revoke"],
  ["lookups/lookups-list", "channels/channels-lookups-list"],
  ["lookups/lookups-run", "channels/channels-lookups-run"],
  ["media-audio/media-audio-create-voiceover", "media/media-voiceovers-create"],
  ["media-audio/media-audio-transcribe", "media/media-transcriptions-create"],
  ["members/members-list", "workspace/workspace-members-list"],
  ["partner-account/partner-account-close", "partner/partner-account-close"],
  [
    "partner-account/partner-account-create-key",
    "partner/partner-account-create-key",
  ],
  ["partner-account/partner-account-get", "partner/partner-account-get"],
  [
    "partner-account/partner-account-list-keys",
    "partner/partner-account-list-keys",
  ],
  [
    "partner-account/partner-account-list-workspaces",
    "partner/partner-account-list-workspaces",
  ],
  ["partner-account/partner-account-open", "partner/partner-account-open"],
  [
    "partner-account/partner-account-overview",
    "partner/partner-account-overview",
  ],
  [
    "partner-account/partner-account-revoke-key",
    "partner/partner-account-revoke-key",
  ],
  ["partner-account/partner-account-update", "partner/partner-account-update"],
  ["partner-usage/partner-usage-get", "partner/partner-customer-usage-get"],
  ["partner/partner-account", "partner/partner-get"],
  ["posts/posts-discard", "posts/posts-drafts-delete"],
  ["posts/posts-drafts", "posts/posts-drafts-list"],
  ["posts/posts-search", "posts/posts-list"],
  ["posts/posts-send", "posts/posts-create"],
  ["posts/posts-tag", "posts/posts-set-tags"],
  ["queues/queues-create", "automations/automations-queues-create"],
  ["queues/queues-delete", "automations/automations-queues-delete"],
  ["queues/queues-get", "automations/automations-queues-get"],
  ["queues/queues-list", "automations/automations-queues-list"],
  ["queues/queues-reshuffle", "automations/automations-queues-reshuffle"],
  ["queues/queues-slots", "automations/automations-queues-slots"],
  ["queues/queues-update", "automations/automations-queues-update"],
  ["recycling/recycling-create", "automations/automations-recycling-create"],
  ["recycling/recycling-delete", "automations/automations-recycling-delete"],
  ["recycling/recycling-get", "automations/automations-recycling-get"],
  ["recycling/recycling-list", "automations/automations-recycling-list"],
  ["recycling/recycling-resume", "automations/automations-recycling-resume"],
  ["recycling/recycling-update", "automations/automations-recycling-update"],
  ["review/review-approve", "approvals/approvals-approve"],
  ["review/review-comment", "approvals/approvals-comment"],
  ["review/review-create-link", "approvals/approvals-create-link"],
  ["review/review-links", "approvals/approvals-list-links"],
  ["review/review-pending", "approvals/approvals-list"],
  ["review/review-request-changes", "approvals/approvals-request-changes"],
  ["review/review-resolve", "approvals/approvals-resolve"],
  ["review/review-revoke-link", "approvals/approvals-revoke-link"],
  ["review/review-settings", "approvals/approvals-settings"],
  ["review/review-thread", "approvals/approvals-get"],
  ["review/review-update-settings", "approvals/approvals-update-settings"],
  ["short-links/short-links-get", "links/links-get"],
  ["short-links/short-links-list", "links/links-list"],
  ["short-links/short-links-set-default", "links/links-set-default"],
  ["short-links/short-links-status", "links/links-status"],
  ["signatures/signatures-create", "posts/posts-signatures-create"],
  ["signatures/signatures-delete", "posts/posts-signatures-delete"],
  ["signatures/signatures-list", "posts/posts-signatures-list"],
  ["signatures/signatures-update", "posts/posts-signatures-update"],
  ["slideshows/slideshows-create", "media/media-slideshows-create"],
  [
    "slideshows/slideshows-create-from-edit",
    "media/media-slideshows-create-from-edit",
  ],
  ["slideshows/slideshows-get", "media/media-slideshows-get"],
  ["slideshows/slideshows-list", "media/media-slideshows-list"],
  ["tags/tags-create", "posts/posts-tags-create"],
  ["tags/tags-delete", "posts/posts-tags-delete"],
  ["tags/tags-list", "posts/posts-tags-list"],
  ["tags/tags-update", "posts/posts-tags-update"],
  ["tiktok/tiktok-creator", "channels/channels-tiktok-creator-get"],
  ["usage/usage-get", "workspace/workspace-usage-get"],
  ["usage/usage-partner", "workspace/workspace-usage-partner"],
  ["video-generations/video-generations-create", "media/media-videos-create"],
  ["video-generations/video-generations-get", "media/media-videos-get"],
  ["video-generations/video-generations-list", "media/media-videos-list"],
];

/**
 * The reference's pages of groups that are not part of the public API (the
 * contract's `appGroups`), which the reference no longer shows: each leads
 * to the guide that describes its endpoint, at its section.
 */
export const leftReferencePages: [string, string][] = [
  ["/reference/account/account-closure", "/developers#me"],
  ["/reference/account/account-delete", "/guides/workspace#api"],
  ["/reference/account/account-export", "/guides/workspace#api"],
  ["/reference/account/account-two-step", "/developers#me"],
  [
    "/reference/billing-actions/billing-actions-accept-transfer",
    "/guides/workspace/billing#ordering",
  ],
  [
    "/reference/billing-actions/billing-actions-cancel",
    "/guides/workspace/billing#ordering",
  ],
  [
    "/reference/billing-actions/billing-actions-offer-transfer",
    "/guides/workspace/billing#ordering",
  ],
  [
    "/reference/billing-actions/billing-actions-order",
    "/guides/workspace/billing#ordering",
  ],
  [
    "/reference/billing-actions/billing-actions-reduce",
    "/guides/workspace/billing#ordering",
  ],
  [
    "/reference/billing-actions/billing-actions-set-ceiling",
    "/guides/workspace/billing#ordering",
  ],
  [
    "/reference/billing-actions/billing-actions-set-x-reads",
    "/guides/workspace/billing#ordering",
  ],
  [
    "/reference/billing-actions/billing-actions-withdraw",
    "/guides/workspace/billing#ordering",
  ],
  [
    "/reference/billing-actions/billing-actions-withdraw-transfer",
    "/guides/workspace/billing#ordering",
  ],
  [
    "/reference/billing-actions/billing-actions-withdrawal",
    "/guides/workspace/billing#ordering",
  ],
  [
    "/reference/browser-analytics/browser-analytics-set-consent",
    "/developers#me",
  ],
  ["/reference/connected-apps/connected-apps-list", "/guides/workspace#api"],
  ["/reference/connected-apps/connected-apps-revoke", "/guides/workspace#api"],
  ["/reference/notices/notices-list", "/guides/workspace/notifications#api"],
  [
    "/reference/notices/notices-mark-all-read",
    "/guides/workspace/notifications#api",
  ],
  [
    "/reference/notices/notices-mark-read",
    "/guides/workspace/notifications#api",
  ],
  ["/reference/notices/notices-unread", "/guides/workspace/notifications#api"],
  [
    "/reference/notification-preferences/notification-preferences-get",
    "/guides/workspace/notifications#api",
  ],
  [
    "/reference/notification-preferences/notification-preferences-update",
    "/guides/workspace/notifications#api",
  ],
  ["/reference/session/session-me", "/developers#me"],
  ["/reference/workspaces/workspaces-delete", "/guides/workspace#api"],
  ["/reference/workspaces/workspaces-secure", "/guides/workspace#api"],
  ["/reference/workspaces/workspaces-security", "/guides/workspace#api"],
];

/** Every redirect the docs serve. */
export const redirects = [
  ...movedPages,
  ...movedReferencePages.map(([from, to]): [string, string] => [
    `/reference/${from}`,
    `/reference/${to}`,
  ]),
  ...leftReferencePages,
].flatMap(([from, to]) => [
  { from, to },
  { from: `/fr${from}`, to: to.startsWith("/") ? `/fr${to}` : to },
]);
