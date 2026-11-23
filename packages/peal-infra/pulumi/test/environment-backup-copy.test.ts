import * as pulumi from "@pulumi/pulumi";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  backupCopyLockDays,
  backupCopyRetentionDays,
  PealEnvironment,
} from "../src/environment.ts";
import type { EnvironmentSettings } from "../src/settings.ts";
import { input, recordResources, valueOf } from "./support.ts";

const made = await recordResources();

const production: EnvironmentSettings = {
  accountId: "account-synthetic",
  accountStack: "organization/peal-account/peal",
  backupCopy: "on",
  domain: "example.test",
  environment: "production",
  hostnames: {
    app: "app",
    docs: "docs",
    grafana: "grafana",
    site: "@",
    ssh: "ssh",
  },
  shortLinkHost: "short.test",
  zoneId: "zone-synthetic",
};

const result = new PealEnvironment(
  "environment",
  production,
  { owner: "owner-policy", publicCallbacks: "callbacks-policy" },
  "link-zone-synthetic"
);

const copy = result.backupCopy;

const settled = valueOf(
  pulumi.all([
    copy?.bucket.id,
    copy?.key.accessKeyId,
    copy?.lifecycle.id,
    copy?.lock.id,
  ])
);

const named = (name: string) => made.find((resource) => resource.name === name);

const day = 86_400;

describe("the backup copy, with its setting on", () => {
  it("is a private bucket of its own, in the EU, kept when its resource goes", async () => {
    await settled;

    expect(named("bucket-backup-copy")?.inputs).toStrictEqual({
      accountId: "account-synthetic",
      jurisdiction: "eu",
      name: "peal-production-backup-copy",
    });
  });

  it("locks every object for 14 days, longer than a week of backups", async () => {
    await settled;

    expect(backupCopyLockDays * day).toBeGreaterThan(7 * day);
    expect(named("lock-backup-copy")?.inputs).toStrictEqual({
      accountId: "account-synthetic",
      bucketName: "peal-production-backup-copy",
      jurisdiction: "eu",
      rules: [
        {
          condition: { maxAgeSeconds: 14 * day, type: "Age" },
          enabled: true,
          id: "lock-every-copy",
          prefix: "",
        },
      ],
    });
  });

  it("deletes copies after 35 days, once the lock has long ended", async () => {
    await settled;

    expect(backupCopyRetentionDays).toBeGreaterThan(backupCopyLockDays);
    expect(
      input(named("lifecycle-backup-copy"), "rules", Schema.Unknown)
    ).toStrictEqual([
      {
        abortMultipartUploadsTransition: {
          condition: { maxAge: day, type: "Age" },
        },
        conditions: { prefix: "" },
        enabled: true,
        id: "abort-incomplete-uploads",
      },
      {
        conditions: { prefix: "" },
        deleteObjectsTransition: {
          condition: { maxAge: 35 * day, type: "Age" },
        },
        enabled: true,
        id: "expire-copies",
      },
    ]);
  });

  it("has a key of its own, for its bucket alone", async () => {
    await settled;

    const key = named("key-backup-copy");

    expect(input(key, "name", Schema.String)).toBe(
      "peal-production-backup-copy-key"
    );
    expect(
      input(
        key,
        "policies",
        Schema.Array(Schema.Struct({ resources: Schema.String }))
      ).map((policy) => policy.resources)
    ).toStrictEqual([
      '{"com.cloudflare.edge.r2.bucket.account-synthetic_eu_peal-production-backup-copy":"*"}',
    ]);
  });

  it("leaves the backups' own bucket and key as they were", async () => {
    await settled;

    expect(input(named("key-backups"), "name", Schema.String)).toBe(
      "peal-production-backups-key"
    );
    expect(named("lock-backups")).toBeUndefined();
  });
});
