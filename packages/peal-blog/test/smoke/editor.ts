// A synthetic editor for the smoke test: it completes EmDash's setup with a
// software passkey (an ES256 key, attestation "none"), uploads an image as
// the admin does (a presigned PUT to the bucket), and publishes a post
// with it as its cover, so the test can fetch the image URL a real page
// writes. Every value is synthetic.
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";

import { Schema } from "effect";
import sharp from "sharp";

const OptionsSchema = Schema.Struct({
  data: Schema.Struct({
    options: Schema.Struct({ challenge: Schema.String }),
  }),
});

const UploadSchema = Schema.Struct({
  data: Schema.Struct({
    headers: Schema.Record(Schema.String, Schema.String),
    mediaId: Schema.String,
    method: Schema.String,
    uploadUrl: Schema.String,
  }),
});

const CreatedSchema = Schema.Struct({
  data: Schema.Struct({ item: Schema.Struct({ id: Schema.String }) }),
});

const AnswerSchema = Schema.Struct({ success: Schema.Literal(true) });

/** Throws the answer's error unless it succeeded. */
const ensureOk = async (response: Response): Promise<void> => {
  if (!response.ok) {
    throw new Error(
      `${response.url} answered ${response.status}: ${await response.text()}`
    );
  }
};

const ignoreExcess = { onExcessProperty: "ignore" } as const;

const succeeded = async (response: Response) => {
  await ensureOk(response);

  return Schema.decodeUnknownSync(AnswerSchema)(
    await response.json(),
    ignoreExcess
  );
};

const readOptions = async (response: Response) => {
  await ensureOk(response);

  return Schema.decodeUnknownSync(OptionsSchema)(
    await response.json(),
    ignoreExcess
  );
};

const readUpload = async (response: Response) => {
  await ensureOk(response);

  return Schema.decodeUnknownSync(UploadSchema)(
    await response.json(),
    ignoreExcess
  );
};

const readCreated = async (response: Response) => {
  await ensureOk(response);

  return Schema.decodeUnknownSync(CreatedSchema)(
    await response.json(),
    ignoreExcess
  );
};

// CBOR, as much as an attestation needs: maps, integers, bytes and text.
const head = (major: number, length: number): Buffer => {
  if (length < 24) {
    return Buffer.from([major * 32 + length]);
  }

  if (length < 256) {
    return Buffer.from([major * 32 + 24, length]);
  }

  const bytes = Buffer.alloc(3);
  bytes.writeUInt8(major * 32 + 25, 0);
  bytes.writeUInt16BE(length, 1);

  return bytes;
};

const cborInt = (value: number): Buffer =>
  value >= 0 ? head(0, value) : head(1, -1 - value);

const cborBytes = (value: Buffer): Buffer =>
  Buffer.concat([head(2, value.length), value]);

const cborText = (value: string): Buffer => {
  const text = Buffer.from(value);

  return Buffer.concat([head(3, text.length), text]);
};

/** A map of entries already encoded, key then value. */
const cborMap = (entries: readonly (readonly [Buffer, Buffer])[]): Buffer =>
  Buffer.concat([head(5, entries.length), ...entries.flat()]);

/** What the calls send. */
type Json =
  | string
  | number
  | boolean
  | readonly Json[]
  | { readonly [key: string]: Json };

/** Signs in as a new site's first admin, then publishes a post with an image. */
export const publishPostWithImage = async (origin: string): Promise<string> => {
  const cookies = new Map<string, string>();

  const call = async (path: string, payload: Json) => {
    const response = await fetch(`${origin}${path}`, {
      body: JSON.stringify(payload),
      headers: {
        "content-type": "application/json",
        cookie: [...cookies]
          .map(([name, value]) => `${name}=${value}`)
          .join("; "),
        origin,
        "x-emdash-request": "1",
      },
      method: "POST",
      redirect: "manual",
    });

    for (const line of response.headers.getSetCookie()) {
      const [pair = ""] = line.split(";");
      const [name = "", ...value] = pair.split("=");
      cookies.set(name.trim(), value.join("="));
    }

    return response;
  };

  await succeeded(
    await call("/_emdash/api/setup", { includeContent: false, title: "Smoke" })
  );

  const { data } = await readOptions(
    await call("/_emdash/api/setup/admin", {
      email: "smoke@synthetic.test",
      name: "Synthetic Editor",
    })
  );

  const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  const credentialId = randomBytes(16);
  const length = Buffer.alloc(2);
  length.writeUInt16BE(credentialId.length);

  const key = cborMap([
    [cborInt(1), cborInt(2)],
    [cborInt(3), cborInt(-7)],
    [cborInt(-1), cborInt(1)],
    [cborInt(-2), cborBytes(Buffer.from(jwk.x ?? "", "base64url"))],
    [cborInt(-3), cborBytes(Buffer.from(jwk.y ?? "", "base64url"))],
  ]);

  const rpIdHash = createHash("sha256")
    .update(new URL(origin).hostname)
    .digest();

  const authData = Buffer.concat([
    rpIdHash,
    Buffer.from([0x45]),
    Buffer.alloc(4),
    Buffer.alloc(16),
    length,
    credentialId,
    key,
  ]);

  const clientDataJSON = Buffer.from(
    JSON.stringify({
      challenge: data.options.challenge,
      crossOrigin: false,
      origin,
      type: "webauthn.create",
    })
  );

  const id = credentialId.toString("base64url");

  await succeeded(
    await call("/_emdash/api/setup/admin/verify", {
      credential: {
        id,
        rawId: id,
        response: {
          attestationObject: cborMap([
            [cborText("fmt"), cborText("none")],
            [cborText("attStmt"), cborMap([])],
            [cborText("authData"), cborBytes(authData)],
          ]).toString("base64url"),
          clientDataJSON: clientDataJSON.toString("base64url"),
        },
        type: "public-key",
      },
    })
  );

  const png = await sharp({
    create: { background: "#1e5ac8", channels: 3, height: 800, width: 1200 },
  })
    .png()
    .toBuffer();

  const upload = await readUpload(
    await call("/_emdash/api/media/upload-url", {
      contentType: "image/png",
      filename: "cover.png",
      size: png.length,
    })
  );

  const put = await fetch(upload.data.uploadUrl, {
    body: png,
    headers: upload.data.headers,
    method: upload.data.method,
  });

  if (!put.ok) {
    throw new Error(`The upload answered ${put.status}`);
  }

  await succeeded(
    await call(`/_emdash/api/media/${upload.data.mediaId}/confirm`, {
      height: 800,
      size: png.length,
      width: 1200,
    })
  );

  const slug = "smoke-synthetic-post";

  const created = await readCreated(
    await call("/_emdash/api/content/posts", {
      data: {
        cover: { alt: "Synthetic cover", id: upload.data.mediaId },
        title: "Synthetic post",
      },
      locale: "en",
      slug,
    })
  );

  await succeeded(
    await call(`/_emdash/api/content/posts/${created.data.item.id}/publish`, {})
  );

  return slug;
};
