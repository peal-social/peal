// The setup script prepares the development stack only, and its upload rule
// keeps the bucket's other rules and changes nothing a second time.
import { describe, expect, it } from "vitest";

import { uploadRule, withUploadRule } from "../scripts/cors.ts";
import { developmentStack, localOnly } from "../scripts/stack.ts";

describe("the stack the scripts prepare", () => {
  it("is the development stack by default", () => {
    const stack = developmentStack({});

    expect(stack.pg).toMatchObject({
      database: "peal_blog",
      host: "127.0.0.1",
      port: 15_432,
    });
    expect(stack.s3.bucket).toBe("peal-blog");
    expect(stack.origin).toBe("http://localhost:4324");
    expect(() => {
      localOnly(stack);
    }).not.toThrow();
  });

  it.each([
    { PGHOST: "db.synthetic.test" },
    { S3_ENDPOINT: "https://s3.synthetic.test" },
  ])("refuses a host elsewhere: %j", (env) => {
    expect(() => {
      localOnly(developmentStack(env));
    }).toThrow(/Refusing/u);
  });
});

describe("the upload rule", () => {
  const rule = uploadRule(["http://localhost:4324"]);

  it("lets the admin PUT a file with its type", () => {
    expect(rule).toMatchObject({
      AllowedHeaders: ["content-type"],
      AllowedMethods: ["PUT"],
      AllowedOrigins: ["http://localhost:4324"],
    });
  });

  it("keeps other rules and changes nothing a second time", () => {
    const other = { AllowedMethods: ["GET"], AllowedOrigins: ["*"], ID: "x" };
    const first = withUploadRule([other], rule);

    expect(first.changed).toBe(true);
    expect(first.rules).toStrictEqual([other, rule]);
    expect(withUploadRule(first.rules, rule).changed).toBe(false);
  });
});
