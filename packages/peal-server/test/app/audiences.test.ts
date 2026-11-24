// The contract sorts its groups by who may call them (`publicGroups`,
// `appGroups`, `staffGroups`), and the public list alone makes the OpenAPI
// document, the docs' reference and the SDKs. These checks hold the lists
// to what each group's middlewares say, so a group in the wrong list fails
// here before it is published, or before a method users call goes.
import { HttpApi, HttpApiGroup, HttpApiMiddleware } from "effect/http-api";
import * as contract from "peal-contract";
import {
  Api,
  appGroups,
  PublicApi,
  publicGroups,
  StaffAccess,
  staffGroups,
} from "peal-contract";
import { openApiDocument } from "peal-contract/openapi-document";
import { describe, expect, it } from "vitest";

interface Operation {
  readonly bearer: boolean;
  readonly group: string;
  readonly id: string;
  readonly path: string;
  readonly staff: boolean;
}

const operationsOf = <
  Id extends string,
  Groups extends HttpApiGroup.Constraint,
>(
  api: HttpApi.HttpApi<Id, Groups>
): readonly Operation[] => {
  const operations: Operation[] = [];

  HttpApi.reflect(api, {
    onEndpoint: ({ endpoint, group, middleware }) => {
      const services = [...middleware];

      operations.push({
        bearer: services.some(
          (service) =>
            HttpApiMiddleware.isSecurity(service) &&
            "bearer" in service.security
        ),
        group: group.identifier,
        id: `${group.identifier}.${endpoint.identifier}`,
        path: endpoint.path,
        staff: services.some((service) => service.key === StaffAccess.key),
      });
    },
    onGroup: () => {
      // Endpoints carry what this reads.
    },
  });

  return operations;
};

const identifiers = (
  groups: readonly { readonly identifier: string }[]
): string[] => groups.map(({ identifier }) => identifier);

const lists = { app: appGroups, public: publicGroups, staff: staffGroups };

// Each list's groups, compared by identity: two groups may not share an
// identifier, which the next case checks too.
const members = Object.entries(lists).map(
  ([name, list]) => [name, new Set<unknown>(list)] as const
);

/** The path is `prefix` or under it, segment by segment. */
const isUnder = (path: string, prefix: string): boolean =>
  path === prefix || path.startsWith(`${prefix}/`);

describe("the API's audiences", () => {
  it("lists every group of the contract in exactly one of the three lists", () => {
    const exported = Object.values(contract).filter((value) =>
      HttpApiGroup.isHttpApiGroup(value)
    );

    expect(exported.length).toBeGreaterThan(50);

    const unlisted = exported.flatMap((group) => {
      const where = members.flatMap(([name, list]) =>
        list.has(group) ? [name] : []
      );

      return where.length === 1
        ? []
        : [`${group.identifier}: ${where.join(", ") || "none"}`];
    });

    expect(unlisted).toStrictEqual([]);

    // No identifier twice, which `.add` would keep once, silently, and the
    // whole API is the three lists, the public one the public API.
    const listed = Object.values(lists).flatMap((list) => identifiers(list));

    expect(listed.filter((id, at) => listed.indexOf(id) !== at)).toStrictEqual(
      []
    );
    expect(Object.keys(Api.groups).toSorted()).toStrictEqual(listed.toSorted());
    expect(Object.keys(PublicApi.groups)).toStrictEqual(
      identifiers(publicGroups)
    );
  });

  it("takes a bearer credential on every public operation but the health checks", () => {
    const operations = operationsOf(PublicApi);

    expect(operations.length).toBeGreaterThan(200);
    expect(
      operations.flatMap(({ bearer, group, id }) =>
        bearer || group === "system" ? [] : [id]
      )
    ).toStrictEqual([]);
  });

  it("publishes nothing under /api/admin or /api/me", () => {
    expect(
      operationsOf(PublicApi).flatMap(({ id, path }) =>
        isUnder(path, "/api/admin") || isUnder(path, "/api/me") ? [id] : []
      )
    ).toStrictEqual([]);
  });

  it("keeps every staff operation behind StaffAccess, and no other", () => {
    const staff = new Set(identifiers(staffGroups));
    const operations = operationsOf(Api);

    expect(
      operations.flatMap(({ group, id, staff: behind }) =>
        behind === staff.has(group) ? [] : [id]
      )
    ).toStrictEqual([]);
    expect(operations.filter(({ staff: behind }) => behind)).toHaveLength(
      operationsOf(HttpApi.make("staff").add(...staffGroups)).length
    );
  });

  it("serves a document of the public operations alone", () => {
    const document = openApiDocument();
    const paths = Object.keys(document.paths);

    expect(paths.filter((path) => isUnder(path, "/api/admin"))).toStrictEqual(
      []
    );
    expect(paths.filter((path) => isUnder(path, "/api/me"))).toStrictEqual([]);

    const documented = Object.values(document.paths)
      .flatMap((item) => [
        item.get,
        item.put,
        item.post,
        item.delete,
        item.patch,
      ])
      .flatMap((operation) =>
        operation === undefined ? [] : [operation.operationId]
      );

    // A top-level group's operation id is the endpoint's name alone.
    const topLevel = new Set<string>(
      publicGroups.flatMap((group) =>
        group.topLevel ? [group.identifier] : []
      )
    );

    expect(documented.toSorted()).toStrictEqual(
      operationsOf(PublicApi)
        .map(({ group, id }) =>
          topLevel.has(group) ? id.slice(group.length + 1) : id
        )
        .toSorted()
    );
  });
});
