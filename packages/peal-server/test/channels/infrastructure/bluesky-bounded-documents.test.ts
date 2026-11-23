// What the AT Protocol's libraries are handed: answers no larger than a
// real document, whose arrays and nesting stay within bounds. A hostile
// one is refused before the library's validators walk it entry by entry.
import { describe, expect, it } from "@effect/vitest";
import type { Schema } from "effect";
import { Option } from "effect";

import {
  boundedDocuments,
  maxArrayEntries,
  maxDocumentBytes,
  maxNestingDepth,
  refusalOf,
} from "#channels/infrastructure/platforms/bluesky/bounded-documents.ts";
import type { PublicFetch } from "#shared/infrastructure/platforms/public-http.ts";

const encoder = new TextEncoder();

// An answer as a server writes it.
type Document = typeof Schema.Json.Type;

const bytesOf = (document: Document) =>
  encoder.encode(JSON.stringify(document));

const didDocument = {
  "@context": ["https://www.w3.org/ns/did/v1"],
  alsoKnownAs: ["at://bob.test"],
  id: "did:web:pds.example",
  service: [
    {
      id: "#atproto_pds",
      serviceEndpoint: "https://pds.example",
      type: "AtprotoPersonalDataServer",
    },
  ],
  verificationMethod: [
    {
      controller: "did:web:pds.example",
      id: "did:web:pds.example#atproto",
      publicKeyMultibase: "zQ3shsyntheticsyntheticsyntheticsynthetic",
      type: "Multikey",
    },
  ],
};

const metadata = {
  authorization_endpoint: "https://pds.example/oauth/authorize",
  code_challenge_methods_supported: ["S256"],
  dpop_signing_alg_values_supported: ["ES256", "ES256K", "RS256", "PS256"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  issuer: "https://pds.example",
  scopes_supported: ["atproto", "transition:generic", "transition:chat.bsky"],
  token_endpoint: "https://pds.example/oauth/token",
};

const tokens = {
  access_token: "synthetic-access",
  expires_in: 3600,
  refresh_token: "synthetic-refresh",
  scope: "atproto",
  sub: "did:web:pds.example",
  token_type: "DPoP",
};

const nested = (depth: number): Document =>
  depth === 0 ? {} : { inner: nested(depth - 1) };

describe(refusalOf, () => {
  it("passes a real DID document, metadata and token answer", () => {
    for (const document of [didDocument, metadata, tokens]) {
      expect(refusalOf(bytesOf(document))).toStrictEqual(Option.none());
    }
  });

  it("refuses an answer past its size, whatever it holds", () => {
    expect(
      refusalOf(new Uint8Array(maxDocumentBytes + 1).fill(0x20))
    ).toStrictEqual(Option.some("large"));
  });

  it("refuses arrays of more entries than a document holds, in total", () => {
    expect(
      refusalOf(
        bytesOf({
          authentication: Array.from({ length: maxArrayEntries + 1 }, () => 0),
        })
      )
    ).toStrictEqual(Option.some("entries"));
    // Spread over several arrays, they count together.
    expect(
      refusalOf(
        bytesOf({
          authentication: Array.from({ length: maxArrayEntries / 2 }, () => 0),
          service: Array.from({ length: maxArrayEntries / 2 + 1 }, () => ({})),
        })
      )
    ).toStrictEqual(Option.some("entries"));
  });

  it("refuses nesting deeper than a document goes", () => {
    expect(refusalOf(bytesOf(nested(maxNestingDepth + 1)))).toStrictEqual(
      Option.some("deep")
    );
    expect(refusalOf(bytesOf(nested(maxNestingDepth - 2)))).toStrictEqual(
      Option.none()
    );
  });
});

// A fetch that answers this body, as a server would.
const answering = (body: Uint8Array | string): PublicFetch =>
  Object.assign(
    async () =>
      await Promise.resolve(
        new Response(body, {
          headers: { "content-type": "application/json" },
          status: 200,
        })
      ),
    { preconnect: () => {} }
  );

describe(boundedDocuments, () => {
  it("hands a real document over as it was sent", async () => {
    const sent = JSON.stringify(didDocument);

    const response = await boundedDocuments(answering(sent))(
      "https://pds.example/.well-known/did.json"
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe(sent);
  });

  it("fails the fetch on a hostile answer, reading no more than its limit", async () => {
    const hostile = `{"authentication":[${"0,".repeat(500_000)}0]}`;

    const failure = boundedDocuments(answering(hostile))(
      "https://pds.example/.well-known/did.json"
    );

    await expect(failure).rejects.toBeInstanceOf(TypeError);
    await expect(failure).rejects.toHaveProperty("cause.why", "large");
  });
});
