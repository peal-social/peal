import { HttpApi } from "effect/http-api";
import { Api, publicGroups } from "peal-contract";

/** One endpoint of the contract, as `group.endpoint` names it. */
export interface ContractEndpoint {
  readonly group: string;
  /** `group.endpoint`, the SDKs' method: `posts.schedule`. */
  readonly id: string;
  readonly method: string;
  /** The path, with each parameter as `{}`. */
  readonly path: string;
}

/** A path with its parameters' names left out: `:id` and `{id}` alike. */
export const pathPattern = (path: string): string =>
  path.replaceAll(/:[A-Za-z]+|\{[A-Za-z]+\}|<[a-z-]+>|\$[A-Z_]+/gu, "{}");

const reflected = (): readonly ContractEndpoint[] => {
  const endpoints: ContractEndpoint[] = [];

  HttpApi.reflect(Api, {
    onEndpoint: ({ endpoint, group }) => {
      const name = Object.entries(group.endpoints).find(
        ([, declared]) => declared === endpoint
      )?.[0];

      endpoints.push({
        group: group.identifier,
        id: `${group.identifier}.${name ?? ""}`,
        method: endpoint.method,
        path: pathPattern(endpoint.path),
      });
    },
    onGroup: () => {
      // Endpoints carry what this reads.
    },
  });

  return endpoints;
};

/** Every endpoint of the contract. */
export const contractEndpoints = reflected();

// The public API's groups, which the SDKs and the reference hold.
const publicGroupIds = new Set<string>(
  publicGroups.map(({ identifier }) => identifier)
);

/**
 * The public API's endpoints, which a bearer token can call (the health
 * checks need none): those of the contract's `publicGroups`.
 */
export const tokenEndpoints = contractEndpoints.filter(({ group }) =>
  publicGroupIds.has(group)
);
