// Better Auth checks a workspace's slug, then writes it: the database's
// refusal of a slug another write took in between answers as the check
// does (400 ORGANIZATION_SLUG_ALREADY_TAKEN), whichever write it refused,
// inside a transaction or not. Every other failure goes through as it was.
import type { DBAdapter } from "@better-auth/core/db/adapter";
import { describe, expect, it } from "@effect/vitest";

import { refuseTakenSlugs } from "#workspace/infrastructure/auth/workspace-slugs.ts";

// node-postgres's error for a unique violation.
const constraintError = (constraint: string): Error =>
  Object.assign(
    new Error(`duplicate key value violates unique constraint "${constraint}"`),
    { code: "23505", constraint }
  );

// The same, as Drizzle wraps it.
const queryError = (cause: Error): Error =>
  new Error("Failed query: insert into auth.organization", { cause });

const slugConstraint = constraintError("organization_slug_key");

const slugViolation = queryError(slugConstraint);

// An adapter whose every write fails with `failure`, and whose transaction
// hands its work the same adapter, as a transaction's would be.
const failingAdapter = (failure: Error): DBAdapter => {
  const fail = async (): Promise<never> => {
    await Promise.resolve();

    throw failure;
  };

  const adapter: DBAdapter = {
    consumeOne: fail,
    count: fail,
    create: fail,
    delete: fail,
    deleteMany: fail,
    findMany: fail,
    findOne: fail,
    id: "failing",
    incrementOne: fail,
    transaction: async (run) => await run(adapter),
    update: fail,
    updateMany: fail,
  };

  return adapter;
};

const taken = {
  body: { code: "ORGANIZATION_SLUG_ALREADY_TAKEN" },
  statusCode: 400,
};

const organization = {
  data: { name: "Kim's workspace" },
  model: "organization",
};

const bySlug = {
  model: "organization",
  update: { slug: "kims-workspace" },
  where: [{ field: "id", value: "synthetic" }],
};

describe("a slug another workspace took under Better Auth's check", () => {
  it("is refused as taken when a workspace is made with it", async () => {
    const adapter = refuseTakenSlugs(failingAdapter(slugViolation));

    await expect(adapter.create(organization)).rejects.toMatchObject(taken);
  });

  it("is refused as taken when a workspace moves to it", async () => {
    const adapter = refuseTakenSlugs(failingAdapter(slugViolation));

    await expect(adapter.update(bySlug)).rejects.toMatchObject(taken);
    await expect(adapter.updateMany(bySlug)).rejects.toMatchObject(taken);
  });

  it("is refused as taken inside a transaction", async () => {
    const adapter = refuseTakenSlugs(failingAdapter(slugViolation));

    await expect(
      adapter.transaction(async (trx) => await trx.create(organization))
    ).rejects.toMatchObject(taken);
  });

  it("is refused as taken when node-postgres's error comes alone", async () => {
    const adapter = refuseTakenSlugs(failingAdapter(slugConstraint));

    await expect(adapter.create(organization)).rejects.toMatchObject(taken);
  });

  it("leaves every other failure as it was", async () => {
    const other = queryError(constraintError("member_pkey"));

    await expect(
      refuseTakenSlugs(failingAdapter(other)).create(organization)
    ).rejects.toBe(other);

    await expect(
      refuseTakenSlugs(failingAdapter(slugViolation)).create({
        data: {},
        model: "member",
      })
    ).rejects.toBe(slugViolation);
  });
});
