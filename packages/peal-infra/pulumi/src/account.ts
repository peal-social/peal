import * as cloudflare from "@pulumi/cloudflare";
import * as pulumi from "@pulumi/pulumi";

import type { AccountSettings, UptimeSettings } from "./settings.ts";

/** Addresses on the domain, each forwarded to the owner's mailbox. */
const forwardedLocals = [
  "hello",
  "maxime",
  "notifications",
  "sandbox",
] as const;

/**
 * The uptime server's records, which Cloudflare does not proxy: the server
 * and its status page answer when Cloudflare does not, and Caddy's TLS-ALPN
 * challenge reaches it (the Ansible project's README, "The status page").
 * The status page's name is a CNAME to the server's, so a new address
 * changes the A and AAAA records alone. The addresses stay out of Git, a
 * secret setting of the stack, and secret in the state.
 */
const uptimeRecords = (
  uptime: UptimeSettings,
  domain: string,
  zoneId: string,
  options: pulumi.CustomResourceOptions
): cloudflare.DnsRecord[] => {
  const uptimeName = `${uptime.hostname}.${domain}`;

  const record = (
    resourceName: string,
    type: string,
    name: string,
    content: pulumi.Input<string>
  ) =>
    new cloudflare.DnsRecord(
      resourceName,
      { content, name, proxied: false, ttl: 1, type, zoneId },
      options
    );

  return [
    record("uptime-a", "A", uptimeName, pulumi.secret(uptime.ipv4)),
    ...(uptime.ipv6 === undefined
      ? []
      : [
          record("uptime-aaaa", "AAAA", uptimeName, pulumi.secret(uptime.ipv6)),
        ]),
    record(
      "status-cname",
      "CNAME",
      `${uptime.statusHostname}.${domain}`,
      uptimeName
    ),
  ];
};

/**
 * What the whole Cloudflare account shares, whatever the environment: the
 * Access policies the environments' applications use, the addresses
 * Email Routing forwards, and the uptime server's records, once it exists.
 * The owner's address is a secret of the stack.
 */
/**
 * How long Cloudflare's edge keeps a resized image of the blog: a day.
 * EmDash's "Replace original" overwrites a file under the same key, and in
 * 1.5.0 an image's URL carries no hash of its content, so a replaced image
 * shows for up to a day unless it is purged (packages/peal-blog's guide,
 * "Purging an image"). EmDash itself sends `max-age=0, must-revalidate`.
 */
const blogImageEdgeTtl = 86_400;

export class PealAccount extends pulumi.ComponentResource {
  readonly blogImageCache: cloudflare.Ruleset;
  readonly blogRecord: cloudflare.DnsRecord;
  readonly blogRedirect: cloudflare.Ruleset;
  readonly blueskyHandleRecord: cloudflare.DnsRecord | undefined;
  readonly forwardedAddresses: readonly pulumi.Output<string>[];
  readonly ownerPolicyId: pulumi.Output<string>;
  readonly publicCallbacksPolicyId: pulumi.Output<string>;
  readonly uptimeRecords: readonly cloudflare.DnsRecord[];

  constructor(
    name: string,
    settings: AccountSettings,
    ownerEmail: pulumi.Output<string>,
    options?: pulumi.ComponentResourceOptions
  ) {
    super("peal:cloudflare:Account", name, {}, options);
    const { accountId, domain, zoneId } = settings;

    // The resources were made at the stack's root before this component:
    // the alias keeps them, rather than making them again.
    const child = (protect: boolean): pulumi.CustomResourceOptions => ({
      aliases: [{ parent: pulumi.rootStackResource }],
      parent: this,
      protect,
    });

    const ownerPolicy = new cloudflare.ZeroTrustAccessPolicy(
      "owner-only",
      {
        accountId,
        decision: "allow",
        includes: [{ email: { email: ownerEmail } }],
        name: `${settings.ownerName} only`,
      },
      child(true)
    );

    // The paths that outside services call, open to everyone on an
    // environment otherwise behind Access (peal_access_bypass_paths).
    const publicCallbacksPolicy = new cloudflare.ZeroTrustAccessPolicy(
      "public-callbacks",
      {
        accountId,
        decision: "bypass",
        includes: [{ everyone: {} }],
        name: "Public callbacks",
      },
      child(true)
    );

    const forwards = forwardedLocals.map(
      (local) =>
        new cloudflare.EmailRoutingRule(
          `forward-${local}`,
          {
            actions: [{ type: "forward", values: [ownerEmail] }],
            enabled: true,
            matchers: [
              { field: "to", type: "literal", value: `${local}@${domain}` },
            ],
            name: local,
            zoneId,
          },
          child(false)
        )
    );

    // Records route traffic: protected, as the environments' are.
    this.uptimeRecords =
      settings.uptime === undefined
        ? []
        : uptimeRecords(settings.uptime, domain, zoneId, {
            parent: this,
            protect: true,
          });

    // The domain is the handle of Peal's Bluesky account: Bluesky reads the
    // account's DID from this record.
    this.blueskyHandleRecord =
      settings.blueskyDid === undefined
        ? undefined
        : new cloudflare.DnsRecord(
            "bluesky-handle",
            {
              content: `"did=${settings.blueskyDid}"`,
              name: `_atproto.${domain}`,
              proxied: false,
              ttl: 1,
              type: "TXT",
              zoneId,
            },
            { parent: this }
          );

    // blog.<domain> leads to the blog at <domain>/blog, which search
    // engines index there (packages/peal-blog). The name has no origin: a
    // proxied record to an address that answers nothing (100::, the
    // discard prefix) lets Cloudflare's edge take the request and apply the
    // redirect, which keeps the path and the query string. Production's
    // name alone, as the sandbox needs no second address. The zone's
    // dynamic redirects live here, as a zone has one ruleset per phase.
    this.blogRecord = new cloudflare.DnsRecord(
      "blog-redirect-host",
      {
        content: "100::",
        name: `blog.${domain}`,
        proxied: true,
        ttl: 1,
        type: "AAAA",
        zoneId,
      },
      { parent: this, protect: true }
    );

    this.blogRedirect = new cloudflare.Ruleset(
      "site-redirect",
      {
        description: "Other names of the site's pages",
        kind: "zone",
        name: "Site redirects",
        phase: "http_request_dynamic_redirect",
        rules: [
          {
            action: "redirect",
            actionParameters: {
              fromValue: {
                preserveQueryString: true,
                statusCode: 301,
                targetUrl: {
                  expression: `concat("https://${domain}/blog", http.request.uri.path)`,
                },
              },
            },
            description: "blog.<domain> to the blog at <domain>/blog",
            expression: `(http.host eq "blog.${domain}")`,
          },
        ],
        zoneId,
      },
      { parent: this, protect: true }
    );

    // The blog's resized images (packages/peal-blog), from the edge: the
    // whole query is the cache key, and the blog answers 404 to a request
    // Astro would not build (its src/image-request.ts), which is never
    // cached (a status TTL of -1 is no-store in the provider's terms), so
    // varying a parameter neither fills the cache nor resizes anything.
    // The rule names the one spelling the pages write: the blog refuses
    // /blog/_image/, with a trailing slash. Production's name alone: the
    // sandbox is behind Access, and its few readers need no cache. The
    // zone's cache rules live here, as a zone has one ruleset per phase.
    this.blogImageCache = new cloudflare.Ruleset(
      "site-cache",
      {
        description: "What the edge caches of the site's host name",
        kind: "zone",
        name: "Site cache rules",
        phase: "http_request_cache_settings",
        rules: [
          {
            action: "set_cache_settings",
            actionParameters: {
              // The default cache key holds the whole query string: a
              // custom key is not available on the zone's plan.
              cache: true,
              edgeTtl: {
                default: blogImageEdgeTtl,
                mode: "override_origin",
                statusCodeTtls: [
                  { statusCodeRange: { from: 300, to: 599 }, value: -1 },
                ],
              },
            },
            description: "The blog's resized images, by their whole query",
            expression: `(http.host eq "${domain}" and http.request.uri.path eq "/blog/_image")`,
          },
        ],
        zoneId,
      },
      { parent: this, protect: true }
    );

    this.forwardedAddresses = forwards.map((rule) =>
      rule.matchers.apply((matchers) => matchers[0]?.value ?? "")
    );
    this.ownerPolicyId = ownerPolicy.id;
    this.publicCallbacksPolicyId = publicCallbacksPolicy.id;
    this.registerOutputs({
      forwardedAddresses: this.forwardedAddresses,
      ownerPolicyId: this.ownerPolicyId,
      publicCallbacksPolicyId: this.publicCallbacksPolicyId,
    });
  }
}
