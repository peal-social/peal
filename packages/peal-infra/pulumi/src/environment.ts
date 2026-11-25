import { createHash } from "node:crypto";

import * as cloudflare from "@pulumi/cloudflare";
import * as pulumi from "@pulumi/pulumi";

import type { EnvironmentSettings } from "./settings.ts";

/**
 * The paths that outside services call on an environment behind Access
 * throughout, which a Bypass policy opens: Bluesky reads the OAuth client
 * metadata, Stripe posts its events and its meter error events, Meta its
 * data deletion requests and its events about accounts' messages (each
 * checked by the server: the events' handshake by the verify token, each
 * event by its signature). The
 * Ansible project's peal_access_bypass_paths routes the same paths.
 */
const publicCallbackPaths = [
  "api/channels/oauth",
  "api/auth/stripe/webhook",
  "api/stripe/meter-errors",
  "api/data-deletion",
  "api/platform-events",
] as const;

/**
 * The paths of the app's host name that Access guards on an environment
 * otherwise public (production): Better Auth's admin endpoints, the staff
 * console's API, and its pages, under /en and /fr too. The Ansible
 * project's peal_access_paths routes the same paths, and cloudflared checks
 * this application's token on them: a path added there is added here, and
 * a locale added to the web app (src/i18n/routing.ts) adds its /<locale>/admin
 * to both. The Ansible project's tests/test_cloudflared.py reads this list
 * and fails when the three disagree.
 */
const adminPaths = [
  "api/auth/admin",
  "api/admin",
  "admin",
  "en/admin",
  "fr/admin",
] as const;

/**
 * The intake of the web app's error reports (packages/peal-web,
 * src/errors/browser.ts), which browsers call without cookies, so without
 * Access's on an environment behind it throughout: a Bypass policy opens
 * it, in an application of its own, as it is no outside service's. The
 * server takes no credential there and counts each address (peal-server,
 * src/app/client-errors/intake.ts), as in production. The Ansible
 * project's peal_access_bypass_paths routes the same path.
 */
const clientErrorsPath = "api/client-errors";

/**
 * How long the uptime server's service token is valid: a year, in hours.
 * Renewed before it ends with the dashboard's Refresh, which keeps its id
 * and secret (README.md, "The uptime server").
 */
const uptimeTokenDuration = "8760h";

/** Cloudflare's permission group "Workers R2 Storage Bucket Item Write". */
const bucketItemWrite = "2efd5506f9c8494dacb1fa10a3e7d5b6";

/**
 * The blog's admin (packages/peal-blog), at the site's /_emdash, which
 * Access guards in production, and its media files under it, which its
 * public pages show and a Bypass policy opens (the Ansible project's
 * cloudflared role routes the same paths).
 */
const blogAdminPath = "_emdash";
const blogMediaPath = "_emdash/api/media/file";

/** The blog's admin uploads with a presigned PUT, signed with the type. */
const blogUploadRule = (origin: string) => ({
  allowed: { headers: ["content-type"], methods: ["PUT"], origins: [origin] },
  maxAgeSeconds: 3600,
});

/**
 * Browsers upload media straight to the bucket, and the editor's preview
 * reads it there: the rule peal-server:media-cors writes (`uploadRule` in
 * its bucket-cors.ts). Change both together.
 */
const uploadRule = (origin: string) => ({
  allowed: {
    headers: ["content-type", "if-none-match", "range"],
    methods: ["GET", "PUT"],
    origins: [origin],
  },
  exposeHeaders: ["accept-ranges", "content-length", "content-range"],
  maxAgeSeconds: 3600,
});

const abortIncompleteUploads = (days: number) => ({
  abortMultipartUploadsTransition: {
    condition: { maxAge: days * 86_400, type: "Age" },
  },
  conditions: { prefix: "" },
  enabled: true,
});

/**
 * The Access service token the uptime server's checks of an environment
 * behind Access carry (CF-Access-Client-Id and CF-Access-Client-Secret).
 */
export interface ServiceToken {
  readonly clientId: pulumi.Output<string>;
  readonly clientSecret: pulumi.Output<string>;
  readonly expiresAt: pulumi.Output<string>;
}

/** A bucket's S3 key: an account token limited to reading and writing it. */
export interface BucketKey {
  readonly accessKeyId: pulumi.Output<string>;
  readonly secretAccessKey: pulumi.Output<string>;
}

/**
 * The account stack's Access policies: the owner's, and the Bypass policy
 * an environment behind Access throughout puts on its callbacks.
 */
export interface AccessPolicies {
  readonly owner: pulumi.Input<string>;
  readonly publicCallbacks: pulumi.Input<string>;
}

type Kind = "media" | "backups" | "blog";

/**
 * The backup copy (README.md, "The backup copy"): how long the bucket lock
 * keeps every object from an overwrite or a deletion, whoever holds a key,
 * the server's included; and when its lifecycle rule deletes an object,
 * longer than the lock (which takes precedence anyway). The Ansible
 * project's peal_backup role copies a file again once its copy is 21 days
 * old (peal_backup_copy_refresh_days), and writes a new index at least as
 * often: every file the newest index names has a copy the store wrote
 * less than 21 days before it, which a 35-day lock keeps 14 days more at
 * least. The lifecycle (7 weeks) lets a file's copy outlive the refresh
 * that replaces it; each file is held in two or three copies at most.
 */
export const backupCopyLockDays = 35;
export const backupCopyRetentionDays = 49;

/** The backup copy's bucket, its lock and lifecycle rules, and its key. */
export interface BackupCopy {
  readonly bucket: cloudflare.R2Bucket;
  readonly key: BucketKey;
  readonly lifecycle: cloudflare.R2BucketLifecycle;
  readonly lock: cloudflare.R2BucketLock;
}

type Audiences = Readonly<Record<"grafana" | "ssh", pulumi.Output<string>>>;

/**
 * The audience tags of an environment's Access applications: `app` on an
 * environment behind Access throughout (the sandbox), `admin` and `blog`
 * (the blog's admin) on one that is public but for them (production). The Ansible project's
 * scripts/cloudflare_from_pulumi.py reads them by these names, and maps
 * them onto the inventory's (cloudflare_access_aud).
 */
export type AccessAud =
  | (Audiences & { readonly app: pulumi.Output<string> })
  | (Audiences & {
      readonly admin: pulumi.Output<string>;
      readonly blog: pulumi.Output<string>;
    });

/**
 * One environment of Peal at Cloudflare: its tunnel and the host names that
 * point to it, its Access applications, and its buckets in R2's EU
 * jurisdiction, each with a key of its own. The tunnel's token and the
 * keys are the stack's secret outputs, which the Ansible project's
 * scripts/cloudflare_from_pulumi.py writes into the environment's vault.
 */
export class PealEnvironment extends pulumi.ComponentResource {
  readonly accessAud: AccessAud;
  readonly applications: readonly cloudflare.ZeroTrustAccessApplication[];
  // With the backupCopy setting alone (a paid resource).
  readonly backupCopy: BackupCopy | undefined;
  readonly buckets: Readonly<Record<Kind, cloudflare.R2Bucket>>;
  readonly blogCors: cloudflare.R2BucketCors;
  readonly blogLifecycle: cloudflare.R2BucketLifecycle;
  readonly cors: cloudflare.R2BucketCors;
  readonly keys: Readonly<Record<Kind, BucketKey>>;
  readonly r2Endpoint: string;
  readonly records: readonly cloudflare.DnsRecord[];
  readonly tunnel: cloudflare.ZeroTrustTunnelCloudflared;
  readonly tunnelToken: pulumi.Output<string>;
  // The sandbox's alone: production's checks are public.
  readonly uptimeAccessToken: ServiceToken | undefined;

  constructor(
    name: string,
    settings: EnvironmentSettings,
    policies: AccessPolicies,
    linkZoneId: pulumi.Input<string>,
    options?: pulumi.ComponentResourceOptions
  ) {
    super("peal:cloudflare:Environment", name, {}, options);

    const {
      accountId,
      domain,
      environment: env,
      hostnames,
      shortLinkHost,
      zoneId,
    } = settings;

    // The sandbox is behind Access throughout, but for what outside
    // services call; production is public, with Access on its admin alone
    // (the Ansible project's peal_access_everything).
    const behindAccess = env === "sandbox";

    // `@` is the bare domain, which Cloudflare flattens as a proxied CNAME.
    const host = (label: string) =>
      label === "@" ? domain : `${label}.${domain}`;

    const title = `Peal ${env}`;

    // The resources were made at the stack's root before this component:
    // the alias keeps them, rather than making them again. What holds data
    // or routes traffic is protected from deletion.
    const child = (protect: boolean): pulumi.CustomResourceOptions => ({
      aliases: [{ parent: pulumi.rootStackResource }],
      parent: this,
      protect,
    });

    // Locally managed: cloudflared reads its routes from config.yml, which
    // the Ansible project writes, not from Cloudflare.
    this.tunnel = new cloudflare.ZeroTrustTunnelCloudflared(
      "tunnel",
      { accountId, configSrc: "local", name: `peal-${env}` },
      child(true)
    );
    this.tunnelToken = pulumi.secret(
      cloudflare
        .getZeroTrustTunnelCloudflaredTokenOutput(
          { accountId, tunnelId: this.tunnel.id },
          { parent: this }
        )
        .apply((result) => result.token)
    );

    const toTunnel = (
      key: string,
      hostname: string,
      zone: pulumi.Input<string>
    ) =>
      new cloudflare.DnsRecord(
        `hostname-${key}`,
        {
          content: pulumi.interpolate`${this.tunnel.id}.cfargotunnel.com`,
          name: hostname,
          proxied: true,
          ttl: 1,
          type: "CNAME",
          zoneId: zone,
        },
        child(true)
      );

    // Short links are on a zone of their own, whose rules (src/link-domain.ts)
    // rewrite /<code> to the server's /api/l/<code> on the way.
    this.records = [
      ...Object.entries(hostnames).map(([key, label]) =>
        toTunnel(key, host(label), zoneId)
      ),
      toTunnel("short-links", shortLinkHost, linkZoneId),
    ];

    // The policies apply in their order: the owner's first.
    const application = (
      resourceName: string,
      applicationName: string,
      uris: readonly string[],
      ...policyIds: readonly [pulumi.Input<string>, ...pulumi.Input<string>[]]
    ) =>
      new cloudflare.ZeroTrustAccessApplication(
        resourceName,
        {
          accountId,
          destinations: uris.map((uri) => ({ type: "public", uri })),
          domain: uris[0] ?? "",
          name: applicationName,
          policies: policyIds.map((id, index) => ({
            id,
            precedence: index + 1,
          })),
          sessionDuration: "24h",
          type: "self_hosted",
        },
        child(false)
      );

    const grafana = () =>
      application(
        "access-grafana",
        `${title} Grafana`,
        [host(hostnames.grafana)],
        policies.owner
      );

    const ssh = () =>
      application(
        "access-ssh",
        `${title} SSH`,
        [host(hostnames.ssh)],
        policies.owner
      );

    if (behindAccess) {
      // The uptime server's checks of the app, the site, the docs and the
      // short links (the Ansible project's README, "Uptime"): a token of
      // their own, and a Service Auth policy that lets it in alone, on
      // this application and no other.
      const uptimeToken = new cloudflare.ZeroTrustAccessServiceToken(
        "uptime-token",
        {
          accountId,
          duration: uptimeTokenDuration,
          name: `${title} uptime checks`,
        },
        { parent: this }
      );

      const uptimePolicy = new cloudflare.ZeroTrustAccessPolicy(
        "uptime-service-auth",
        {
          accountId,
          decision: "non_identity",
          includes: [{ serviceToken: { tokenId: uptimeToken.id } }],
          name: `${title} uptime checks`,
        },
        { parent: this }
      );

      this.uptimeAccessToken = {
        clientId: pulumi.secret(uptimeToken.clientId),
        clientSecret: pulumi.secret(uptimeToken.clientSecret),
        expiresAt: uptimeToken.expiresAt,
      };

      const app = application(
        "access-app",
        title,
        [
          host(hostnames.app),
          host(hostnames.site),
          host(hostnames.docs),
          // The sandbox's short links stay behind Access with the rest of
          // it: a tester signed in follows them.
          shortLinkHost,
        ],
        policies.owner,
        uptimePolicy.id
      );

      const callbacks = application(
        "access-callbacks",
        `${title} callbacks`,
        publicCallbackPaths.map((path) => `${host(hostnames.app)}/${path}`),
        policies.publicCallbacks
      );

      // Newer than the component, so with no alias to keep. Access applies
      // the application with the longer path, this one over access-app.
      const clientErrors = new cloudflare.ZeroTrustAccessApplication(
        "access-client-errors",
        {
          accountId,
          destinations: [
            {
              type: "public",
              uri: `${host(hostnames.app)}/${clientErrorsPath}`,
            },
          ],
          domain: `${host(hostnames.app)}/${clientErrorsPath}`,
          name: `${title} client errors`,
          policies: [{ id: policies.publicCallbacks, precedence: 1 }],
          sessionDuration: "24h",
          type: "self_hosted",
        },
        { parent: this }
      );

      const [grafanaApp, sshApp] = [grafana(), ssh()];
      this.applications = [app, callbacks, clientErrors, grafanaApp, sshApp];
      this.accessAud = {
        app: app.aud,
        grafana: grafanaApp.aud,
        ssh: sshApp.aud,
      };
    } else {
      // The app, the site, the docs and the short links are public: no
      // application covers them.
      const admin = application(
        "access-admin",
        `${title} admin`,
        adminPaths.map((path) => `${host(hostnames.app)}/${path}`),
        policies.owner
      );

      // The blog's admin, whose setup is first come, first served, for
      // the team only; its media files, which its pages show, for anyone.
      // Access applies the application with the longer path.
      const blog = new cloudflare.ZeroTrustAccessApplication(
        "access-blog",
        {
          accountId,
          destinations: [
            { type: "public", uri: `${host(hostnames.site)}/${blogAdminPath}` },
          ],
          domain: `${host(hostnames.site)}/${blogAdminPath}`,
          name: `${title} blog admin`,
          policies: [{ id: policies.owner, precedence: 1 }],
          sessionDuration: "24h",
          type: "self_hosted",
        },
        { parent: this }
      );

      const blogMedia = new cloudflare.ZeroTrustAccessApplication(
        "access-blog-media",
        {
          accountId,
          destinations: [
            { type: "public", uri: `${host(hostnames.site)}/${blogMediaPath}` },
          ],
          domain: `${host(hostnames.site)}/${blogMediaPath}`,
          name: `${title} blog media`,
          policies: [{ id: policies.publicCallbacks, precedence: 1 }],
          sessionDuration: "24h",
          type: "self_hosted",
        },
        { parent: this }
      );

      const [grafanaApp, sshApp] = [grafana(), ssh()];
      this.applications = [admin, blog, blogMedia, grafanaApp, sshApp];
      this.uptimeAccessToken = undefined;
      this.accessAud = {
        admin: admin.aud,
        blog: blog.aud,
        grafana: grafanaApp.aud,
        ssh: sshApp.aud,
      };
    }

    // A bucket outlives its resource: removing it from here leaves it, and
    // its data, at Cloudflare. The blog's is newer than the component, so
    // it has no alias to keep.
    const bucket = (
      kind: Kind,
      resourceOptions: pulumi.CustomResourceOptions
    ) =>
      new cloudflare.R2Bucket(
        `bucket-${kind}`,
        { accountId, jurisdiction: "eu", name: `peal-${env}-${kind}` },
        { ...resourceOptions, retainOnDelete: true }
      );

    this.buckets = {
      backups: bucket("backups", child(true)),
      // The blog's media (packages/peal-blog): a bucket of its own, as
      // EmDash has no key prefix and the server's sweeps own the media
      // bucket. Private: the blog reads its files back itself.
      blog: bucket("blog", { parent: this, protect: true }),
      media: bucket("media", child(true)),
    };

    // An R2 key is an account token: its id is the access key id, the
    // SHA-256 of its value the secret access key. It reads, writes and
    // deletes objects of its bucket alone, and cannot change the bucket's
    // settings, its lock and lifecycle rules included.
    const keyOf = (
      kind: Kind | "backup-copy",
      target: cloudflare.R2Bucket
    ): BucketKey => {
      const token = new cloudflare.AccountToken(
        `key-${kind}`,
        {
          accountId,
          name: `peal-${env}-${kind}-key`,
          policies: [
            {
              effect: "allow",
              permissionGroups: [{ id: bucketItemWrite }],
              resources: JSON.stringify({
                [`com.cloudflare.edge.r2.bucket.${accountId}_eu_peal-${env}-${kind}`]:
                  "*",
              }),
            },
          ],
        },
        { dependsOn: [target], parent: this }
      );

      return {
        accessKeyId: token.id,
        secretAccessKey: pulumi.secret(
          token.value.apply((value) =>
            createHash("sha256").update(value).digest("hex")
          )
        ),
      };
    };

    this.keys = {
      backups: keyOf("backups", this.buckets.backups),
      blog: keyOf("blog", this.buckets.blog),
      media: keyOf("media", this.buckets.media),
    };

    const lifecycle = (
      kind: Kind,
      rules: cloudflare.R2BucketLifecycleArgs["rules"]
    ) =>
      new cloudflare.R2BucketLifecycle(
        `lifecycle-${kind}`,
        {
          accountId,
          bucketName: this.buckets[kind].name,
          jurisdiction: "eu",
          rules,
        },
        child(false)
      );

    lifecycle("media", [
      { ...abortIncompleteUploads(1), id: "abort-incomplete-uploads" },
      {
        // The erasure ledger, which the server prunes itself: a second
        // guard. Its prefix must stay exactly erasures/.
        conditions: { prefix: "erasures/" },
        deleteObjectsTransition: {
          condition: { maxAge: 42 * 86_400, type: "Age" },
        },
        enabled: true,
        id: "expire-erasures",
      },
    ]);
    // Never an expiry on the backups: pgBackRest keeps its own retention.
    lifecycle("backups", [
      { ...abortIncompleteUploads(7), id: "Default Multipart Abort Rule" },
    ]);
    this.blogLifecycle = new cloudflare.R2BucketLifecycle(
      "lifecycle-blog",
      {
        accountId,
        bucketName: this.buckets.blog.name,
        jurisdiction: "eu",
        rules: [
          { ...abortIncompleteUploads(1), id: "abort-incomplete-uploads" },
        ],
      },
      { parent: this }
    );
    this.cors = new cloudflare.R2BucketCors(
      "cors-media",
      {
        accountId,
        bucketName: this.buckets.media.name,
        jurisdiction: "eu",
        rules: [uploadRule(`https://${host(hostnames.app)}`)],
      },
      child(false)
    );

    // The blog's admin runs on the site's host name, at /_emdash.
    this.blogCors = new cloudflare.R2BucketCors(
      "cors-blog",
      {
        accountId,
        bucketName: this.buckets.blog.name,
        jurisdiction: "eu",
        rules: [blogUploadRule(`https://${host(hostnames.site)}`)],
      },
      { parent: this }
    );

    // The backup copy: a private bucket of its own in the same
    // jurisdiction, where the server copies the backups, each run under a
    // prefix of its own so no key is written twice. The lock keeps every
    // object for backupCopyLockDays, whoever holds a key: the server's
    // copy key reads and writes the bucket, and cannot delete what is
    // locked, nor change the lock. The lifecycle rule then deletes what is
    // older than backupCopyRetentionDays, and the parts of an upload left
    // unfinished.
    if (settings.backupCopy === "on") {
      const copyBucket = new cloudflare.R2Bucket(
        "bucket-backup-copy",
        { accountId, jurisdiction: "eu", name: `peal-${env}-backup-copy` },
        { parent: this, protect: true, retainOnDelete: true }
      );

      this.backupCopy = {
        bucket: copyBucket,
        key: keyOf("backup-copy", copyBucket),
        lifecycle: new cloudflare.R2BucketLifecycle(
          "lifecycle-backup-copy",
          {
            accountId,
            bucketName: copyBucket.name,
            jurisdiction: "eu",
            rules: [
              { ...abortIncompleteUploads(1), id: "abort-incomplete-uploads" },
              {
                conditions: { prefix: "" },
                deleteObjectsTransition: {
                  condition: {
                    maxAge: backupCopyRetentionDays * 86_400,
                    type: "Age",
                  },
                },
                enabled: true,
                id: "expire-copies",
              },
            ],
          },
          { parent: this }
        ),
        lock: new cloudflare.R2BucketLock(
          "lock-backup-copy",
          {
            accountId,
            bucketName: copyBucket.name,
            jurisdiction: "eu",
            rules: [
              {
                condition: {
                  maxAgeSeconds: backupCopyLockDays * 86_400,
                  type: "Age",
                },
                enabled: true,
                id: "lock-every-copy",
                prefix: "",
              },
            ],
          },
          { parent: this, protect: true }
        ),
      };
    } else {
      this.backupCopy = undefined;
    }

    this.r2Endpoint = `https://${accountId}.eu.r2.cloudflarestorage.com`;
    this.registerOutputs({
      accessAud: this.accessAud,
      r2Endpoint: this.r2Endpoint,
      tunnelId: this.tunnel.id,
    });
  }
}
