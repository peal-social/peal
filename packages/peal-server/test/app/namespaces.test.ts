// The API's one vocabulary: a group's identifier is a namespace
// (`inbox.messages`), the prefix of each operation's id, the family of its
// paths under /api/v1, and, by its first segment, its tag in the document.
import { describe, expect, it } from "@effect/vitest";
import { HttpApi } from "effect/http-api";
import { Api } from "peal-contract";
import { openApiDocument } from "peal-contract/openapi-document";

interface Operation {
  readonly endpoint: string;
  readonly group: string;
  readonly method: string;
  readonly path: string;
}

const operations: Operation[] = [];
const groups = new Set<string>();

HttpApi.reflect(Api, {
  onEndpoint: ({ endpoint, group }) => {
    operations.push({
      endpoint: endpoint.identifier,
      group: group.identifier,
      method: endpoint.method,
      path: endpoint.path,
    });
  },
  onGroup: ({ group }) => {
    groups.add(group.identifier);
  },
});

const idOf = ({ endpoint, group }: Operation) => `${group}.${endpoint}`;

// Every namespace a group's identifier names: `inbox` and `inbox.messages`.
const namespaces = new Set(
  [...groups].flatMap((group) =>
    group.split(".").map((_, at, parts) => parts.slice(0, at + 1).join("."))
  )
);

const kebabCase = (segment: string) =>
  segment.replaceAll(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);

// The session's own billing actions share the billing reads' paths.
const pathExempt = new Set(["workspace.billingActions"]);

describe("the API's namespaces", () => {
  it("names each group with camelCase segments, and each endpoint with one", () => {
    expect(
      [...groups].filter(
        (group) => !/^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)*$/u.test(group)
      )
    ).toStrictEqual([]);
    expect(
      operations.filter(
        ({ endpoint }) => !/^[a-z][A-Za-z0-9]*$/u.test(endpoint)
      )
    ).toStrictEqual([]);
  });

  it("puts a namespace's paths under /api/v1, its segments in order", () => {
    // Whether the path's static segments spell the group's namespace.
    const spells = ({ group, path }: Operation) => {
      const statics = path
        .slice("/api/v1/".length)
        .split("/")
        .filter((segment) => !segment.startsWith(":"));

      const [first, ...rest] = group.split(".").map(kebabCase);

      if (statics[0] !== first) {
        return false;
      }

      let at = 1;

      for (const segment of rest) {
        const found = statics.indexOf(segment, at);

        if (found === -1) {
          return false;
        }

        at = found + 1;
      }

      return true;
    };

    const strays = operations.flatMap((operation) =>
      operation.path.startsWith("/api/v1/") &&
      !pathExempt.has(operation.group) &&
      !spells(operation)
        ? [`${idOf(operation)} ${operation.path}`]
        : []
    );

    expect(strays).toStrictEqual([]);
  });

  it("gives no method the name of a namespace", () => {
    expect(
      operations.flatMap((operation) =>
        namespaces.has(idOf(operation)) ? [idOf(operation)] : []
      )
    ).toStrictEqual([]);
  });

  it("calls no namespace peal, which a generated Ruby client cannot load", () => {
    expect([...namespaces].filter((name) => name === "peal")).toStrictEqual([]);
  });

  it("gives each operation its own id and its own route", () => {
    const ids = operations.map(idOf);

    const routes = operations.map(
      ({ method, path }) => `${method} ${path.replaceAll(/:\w+/gu, ":")}`
    );

    expect(ids.filter((id, at) => ids.indexOf(id) !== at)).toStrictEqual([]);
    expect(
      routes.filter((route, at) => routes.indexOf(route) !== at)
    ).toStrictEqual([]);
  });

  it("files each operation of the document under its first segment, with a name", () => {
    const document = openApiDocument();
    const misfiled: string[] = [];

    for (const item of Object.values(document.paths)) {
      for (const operation of [
        item.get,
        item.put,
        item.post,
        item.delete,
        item.patch,
      ]) {
        if (operation === undefined) {
          continue;
        }

        const dot = operation.operationId.indexOf(".");

        if (
          dot !== -1 &&
          operation.tags.join(",") !== operation.operationId.slice(0, dot)
        ) {
          misfiled.push(operation.operationId);
        }
      }
    }

    expect(misfiled).toStrictEqual([]);
    expect(document.tags.slice(0, 2).map(({ name }) => name)).toStrictEqual([
      "posts",
      "approvals",
    ]);
    expect(
      document.tags
        .filter(
          (tag) => !("x-displayName" in tag) || tag.description === undefined
        )
        .map(({ name }) => name)
    ).toStrictEqual([]);
  });
});
