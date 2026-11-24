import * as pulumi from "@pulumi/pulumi";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { PealAccount } from "../src/account.ts";
import { AccountSettingsSchema } from "../src/settings.ts";
import { input, recordResources, valueOf } from "./support.ts";

const made = await recordResources();

const settings = {
  accountId: "account-synthetic",
  domain: "example.test",
  domainVerifications: {
    "video-platform": "video-site-verification=synthetic-text",
  },
  linkDomain: "short.test",
  ownerName: "Owner",
  zoneId: "zone-synthetic",
};

const result = new PealAccount(
  "account",
  settings,
  pulumi.secret("owner@example.test")
);

describe("the texts that prove the domain is Peal's", () => {
  it("puts each one in a TXT record of the bare domain, named after who asked", async () => {
    await valueOf(result.ownerPolicyId);

    const records = made.filter(
      (resource) =>
        resource.type === "cloudflare:index/dnsRecord:DnsRecord" &&
        resource.name.startsWith("domain-verification-")
    );

    expect(
      records.map((record) => [
        record.name,
        input(record, "type", Schema.String),
        input(record, "name", Schema.String),
        input(record, "content", Schema.String),
        input(record, "proxied", Schema.Boolean),
      ])
    ).toStrictEqual([
      [
        "domain-verification-video-platform",
        "TXT",
        "example.test",
        '"video-site-verification=synthetic-text"',
        false,
      ],
    ]);
    expect(result.domainVerificationRecords).toHaveLength(1);
  });

  it("refuses a text that could break out of the record's quotes", () => {
    const decode = Schema.decodeUnknownSync(AccountSettingsSchema);

    expect(() =>
      decode({ ...settings, domainVerifications: { service: 'a=b" "c' } })
    ).toThrow(/domainVerifications/u);
    expect(decode(settings).domainVerifications).toStrictEqual(
      settings.domainVerifications
    );
  });
});
