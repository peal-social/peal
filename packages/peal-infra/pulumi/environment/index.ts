// The environment project: one stack per environment (README.md).
import * as pulumi from "@pulumi/pulumi";

import { PealEnvironment } from "../src/environment.ts";
import { importExisting } from "../src/imports.ts";
import { EnvironmentSettingsSchema, readSettings } from "../src/settings.ts";

importExisting();

// `backupCopy` is optional: unset, no backup copy is made (README.md, "The
// backup copy").
const settings = readSettings(
  EnvironmentSettingsSchema,
  [
    "accountId",
    "accountStack",
    "domain",
    "environment",
    "hostnames",
    "shortLinkHost",
    "zoneId",
  ],
  ["backupCopy"]
);

const shared = new pulumi.StackReference(settings.accountStack);

const made = new PealEnvironment(
  "environment",
  settings,
  {
    owner: shared.requireOutput("ownerPolicyId").apply(String),
    publicCallbacks: shared
      .requireOutput("publicCallbacksPolicyId")
      .apply(String),
  },
  shared.requireOutput("linkZoneId").apply(String)
);

export const { accessAud, r2Endpoint, tunnelToken } = made;
export const tunnelId = made.tunnel.id;
export const mediaBucket = made.buckets.media.name;
export const backupBucket = made.buckets.backups.name;
export const blogBucket = made.buckets.blog.name;

// The buckets' keys, secret: scripts/cloudflare_from_pulumi.py in the
// Ansible project writes them into the environment's vault.
export const mediaKey = made.keys.media;
export const backupKey = made.keys.backups;
export const blogKey = made.keys.blog;

// The backup copy's locked bucket and its key, with peal:backupCopy alone:
// scripts/cloudflare_from_pulumi.py writes them where the others go.
export const backupCopyBucket = made.backupCopy?.bucket.name;
export const backupCopyKey = made.backupCopy?.key;

// The sandbox's alone: the service token the uptime server's checks carry,
// secret, which scripts/cloudflare_from_pulumi.py in the Ansible project
// writes into the uptime server's vault; and when it ends, in clear.
export const uptimeAccessToken =
  made.uptimeAccessToken === undefined
    ? undefined
    : {
        clientId: made.uptimeAccessToken.clientId,
        clientSecret: made.uptimeAccessToken.clientSecret,
      };

export const uptimeAccessTokenExpiresAt = made.uptimeAccessToken?.expiresAt;
