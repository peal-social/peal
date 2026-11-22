import * as pulumi from "@pulumi/pulumi";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { PealAccount } from "../src/account.ts";
import { input, recordResources, valueOf } from "./support.ts";

const made = await recordResources();

const result = new PealAccount(
  "account",
  {
    accountId: "account-synthetic",
    domain: "example.test",
    linkDomain: "short.test",
    ownerName: "Owner",
    zoneId: "zone-synthetic",
  },
  pulumi.secret("owner@example.test")
);

describe("what the account shares", () => {
  it("lets the owner in, and opens the callbacks to everyone", async () => {
    await valueOf(result.ownerPolicyId);

    const policies = made.filter(
      (resource) =>
        resource.type ===
        "cloudflare:index/zeroTrustAccessPolicy:ZeroTrustAccessPolicy"
    );

    // The owner's policy waits for its secret: it is recorded last.
    expect(
      policies
        .map((policy) => [
          input(policy, "name", Schema.String),
          input(policy, "decision", Schema.String),
        ])
        .toSorted(([left = ""], [right = ""]) => left.localeCompare(right))
    ).toStrictEqual([
      ["Owner only", "allow"],
      ["Public callbacks", "bypass"],
    ]);
  });

  it("forwards hello@, maxime@, notifications@, sandbox@ and security@ to the owner", async () => {
    const addresses = await Promise.all(result.forwardedAddresses.map(valueOf));
    expect(addresses).toStrictEqual([
      "hello@example.test",
      "maxime@example.test",
      "notifications@example.test",
      "sandbox@example.test",
      "security@example.test",
    ]);
  });

  it("makes no record of the uptime server without its setting", async () => {
    await valueOf(result.ownerPolicyId);

    expect(result.uptimeRecords).toStrictEqual([]);
    expect(
      made
        .filter(
          (resource) => resource.type === "cloudflare:index/dnsRecord:DnsRecord"
        )
        .map((resource) => resource.name)
    ).toStrictEqual(["blog-redirect-host"]);
  });

  it("caches the blog's resized images at the edge, by their whole query", async () => {
    await valueOf(result.blogImageCache.id);

    const ruleset = made.find((resource) => resource.name === "site-cache");

    expect(input(ruleset, "phase", Schema.String)).toBe(
      "http_request_cache_settings"
    );
    expect(input(ruleset, "zoneId", Schema.String)).toBe("zone-synthetic");
    expect(input(ruleset, "rules", Schema.Unknown)).toStrictEqual([
      {
        action: "set_cache_settings",
        actionParameters: {
          cache: true,
          edgeTtl: {
            default: 86_400,
            mode: "override_origin",
            // Never a refusal or an error: -1 is no-store.
            statusCodeTtls: [
              { statusCodeRange: { from: 300, to: 599 }, value: -1 },
            ],
          },
        },
        description: "The blog's resized images, by their whole query",
        expression:
          '(http.host eq "example.test" and http.request.uri.path eq "/blog/_image")',
      },
    ]);
  });

  it("sends blog.<domain> to the blog, keeping the path and the query", async () => {
    await valueOf(pulumi.all([result.blogRecord.id, result.blogRedirect.id]));

    const record = made.find(
      (resource) => resource.name === "blog-redirect-host"
    );

    expect(record?.inputs).toStrictEqual({
      content: "100::",
      name: "blog.example.test",
      proxied: true,
      ttl: 1,
      type: "AAAA",
      zoneId: "zone-synthetic",
    });

    const ruleset = made.find((resource) => resource.name === "site-redirect");

    expect(input(ruleset, "phase", Schema.String)).toBe(
      "http_request_dynamic_redirect"
    );
    expect(input(ruleset, "zoneId", Schema.String)).toBe("zone-synthetic");
    expect(input(ruleset, "rules", Schema.Unknown)).toStrictEqual([
      {
        action: "redirect",
        actionParameters: {
          fromValue: {
            preserveQueryString: true,
            statusCode: 301,
            targetUrl: {
              expression:
                'concat("https://example.test/blog", http.request.uri.path)',
            },
          },
        },
        description: "blog.<domain> to the blog at <domain>/blog",
        expression: '(http.host eq "blog.example.test")',
      },
    ]);
  });

  it("answers the domain over HTTPS alone, from TLS 1.2, with HSTS as the app sends it", async () => {
    await valueOf(result.ownerPolicyId);

    const settings = made
      .filter(
        (resource) =>
          resource.type === "cloudflare:index/zoneSetting:ZoneSetting"
      )
      .map((setting) => [
        input(setting, "zoneId", Schema.String),
        input(setting, "settingId", Schema.String),
        input(setting, "value", Schema.Unknown),
      ]);

    expect(
      settings.toSorted(([, left = ""], [, right = ""]) =>
        String(left).localeCompare(String(right))
      )
    ).toStrictEqual([
      ["zone-synthetic", "always_use_https", "on"],
      ["zone-synthetic", "min_tls_version", "1.2"],
      [
        "zone-synthetic",
        "security_header",
        {
          // packages/peal-web/next.config.ts: two years, the subdomains
          // too, never preloaded.
          strict_transport_security: {
            enabled: true,
            include_subdomains: true,
            max_age: 63_072_000,
            nosniff: true,
            preload: false,
          },
        },
      ],
    ]);
  });

  it("keeps Cloudflare's normalisation of incoming URLs on the domain", async () => {
    await valueOf(result.ownerPolicyId);

    expect(
      made.find((resource) => resource.name === "site-url-normalization")
        ?.inputs
    ).toStrictEqual({
      scope: "incoming",
      type: "cloudflare",
      zoneId: "zone-synthetic",
    });
  });
});
