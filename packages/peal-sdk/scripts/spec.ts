// Writes openapi.json, the document every SDK is generated from: the
// contract's, which holds the public API alone (`publicGroups`), with only
// the schemas its operations reference. Which groups are public is the
// contract's to say: an operation here that a bearer token (a workspace API
// key, a partner key or an OAuth access token) cannot call, and that is not
// a health check, stops the script.
import path from "node:path";

import { Option, Schema } from "effect";

import { contactEmail, homepage } from "./languages.ts";
import { namespaceProblems } from "./sdk-names.ts";

const contractDocument = path.join(
  import.meta.dirname,
  "..",
  "..",
  "peal-contract",
  "openapi.json"
);

const sdkDocument = path.join(import.meta.dirname, "..", "openapi.json");

/** The web app's origin, which forwards /api to the server. */
const defaultServer = "https://app.peal.social";

/** Operations under this tag need no token and stay in every SDK. */
const publicTag = "system";

const decodeId = Schema.decodeUnknownOption(Schema.String);

const schemaPrefix = "#/components/schemas/";

/**
 * Effect encodes a number that JSON cannot hold as one of these strings, next
 * to the number itself. Left inline, some generators reference a type they
 * never write, so the SDKs get it as a named schema.
 */
const nonFinite: readonly string[] = ["Infinity", "-Infinity", "NaN"];
const nonFiniteName = "NonFiniteNumber";

const methods = new Set([
  "get",
  "put",
  "post",
  "delete",
  "patch",
  "head",
  "options",
]);

type Json = Schema.Json;

type JsonObject = Schema.JsonObject;

const isJsonObject = Schema.is(Schema.JsonObject);
const isJsonArray = Schema.is(Schema.Array(Schema.Json));
const isString = Schema.is(Schema.String);
const isStringArray = Schema.is(Schema.Array(Schema.String));
const isReference = Schema.is(Schema.Struct({ $ref: Schema.String }));

const SecurityRequirementsSchema = Schema.Array(
  Schema.Record(Schema.String, Schema.Array(Schema.String))
);

type SecurityRequirements = typeof SecurityRequirementsSchema.Type;

const OperationSchema = Schema.Struct({
  security: Schema.optional(SecurityRequirementsSchema),
  tags: Schema.optional(Schema.Array(Schema.String)),
});

const decodeDocument = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.JsonObject)
);

const decodeObject = Schema.decodeUnknownSync(Schema.JsonObject);
const decodeOperation = Schema.decodeUnknownSync(OperationSchema);
const decodeSecurity = Schema.decodeUnknownSync(SecurityRequirementsSchema);

const objectAt = (parent: JsonObject, key: string): JsonObject =>
  decodeObject(parent[key] ?? {});

/** A copy of the object with these keys set, each in its place if it had one. */
const withEntries = (
  object: JsonObject,
  entries: readonly (readonly [string, Json])[]
): JsonObject => Object.fromEntries([...Object.entries(object), ...entries]);

const document = decodeDocument(await Bun.file(contractDocument).text());
const globalSecurity = decodeSecurity(document["security"] ?? []);

const allowsBearer = (security: SecurityRequirements): boolean =>
  security.some((requirement) => "bearer" in requirement);

/**
 * The operation with its SDK group and method: the contract's operationId
 * is `<namespace>.<method>`, its namespace one segment or several
 * (`posts.schedule`, `inbox.messages.send`), or the method alone for the
 * health checks, whose group is their tag. A namespace of several segments
 * is a list, which the generators nest (`client.inbox.messages.send`).
 */
const withSdkName = (
  operation: JsonObject,
  tags: readonly string[]
): JsonObject => {
  const id = Option.getOrUndefined(decodeId(operation["operationId"]));

  if (id === undefined) {
    throw new Error(
      `An operation has no operationId: ${JSON.stringify(operation)}`
    );
  }

  const dot = id.lastIndexOf(".");
  const group = dot === -1 ? tags[0] : id.slice(0, dot);

  if (group === undefined) {
    throw new Error(`The operation ${id} has neither a group nor a tag`);
  }

  const segments = group.split(".");

  return withEntries(operation, [
    ["x-fern-sdk-group-name", segments.length === 1 ? group : segments],
    ["x-fern-sdk-method-name", id.slice(dot + 1)],
  ]);
};

/**
 * The header a request names its workspace in (the contract's
 * `workspaceHeader`). Every workspace endpoint takes it, optional: the SDKs
 * set it once, on the client (`workspace`, a global header), rather than as
 * an argument of every method.
 */
const workspaceHeader = "peal-workspace";

const isWorkspaceHeader = (parameter: Json): boolean =>
  isJsonObject(parameter) &&
  parameter["in"] === "header" &&
  isString(parameter["name"]) &&
  parameter["name"].toLowerCase() === workspaceHeader;

/** The operation without the workspace header, which the client sends. */
const withoutWorkspaceHeader = (operation: JsonObject): JsonObject => {
  const { parameters } = operation;

  if (!isJsonArray(parameters) || !parameters.some(isWorkspaceHeader)) {
    return operation;
  }

  // The client sends it only when given a workspace: an operation that
  // could not answer without one would fail every client made with a key.
  if (
    parameters.some(
      (parameter) =>
        isWorkspaceHeader(parameter) &&
        isJsonObject(parameter) &&
        parameter["required"] === true
    )
  ) {
    throw new Error(
      `${JSON.stringify(operation["operationId"])} requires the Peal-Workspace header, which the SDKs send only as an optional client option: keep it optional in the contract (workspaceHeaders).`
    );
  }

  const kept = parameters.filter((parameter) => !isWorkspaceHeader(parameter));

  return kept.length === 0
    ? Object.fromEntries(
        Object.entries(operation).filter(([key]) => key !== "parameters")
      )
    : withEntries(operation, [["parameters", kept]]);
};

/**
 * The operation as the SDKs see it: with its bearer credential alone, as a
 * session cannot reach the SDKs. The contract's document holds the public
 * API alone, so an operation no token can call is a group in the wrong list.
 */
const sdkOperation = (operation: JsonObject): JsonObject => {
  const { security = globalSecurity, tags = [] } = decodeOperation(operation);

  if (tags.includes(publicTag)) {
    return withSdkName(operation, tags);
  }

  if (!allowsBearer(security)) {
    throw new Error(
      `${JSON.stringify(operation["operationId"])} takes no bearer token, so no SDK user could call it: its group belongs in the contract's appGroups or staffGroups, not publicGroups.`
    );
  }

  return withSdkName(
    withEntries(withoutWorkspaceHeader(operation), [
      ["security", security.filter((requirement) => "bearer" in requirement)],
    ]),
    tags
  );
};

/**
 * The methods HTTP calls idempotent, which the SDKs retry when the API is
 * briefly unavailable. A POST or a PATCH is never sent twice: the first may
 * have created the post or the key before its answer was lost.
 */
const repeatable = new Set(["get", "head", "options", "put", "delete"]);

/** The path with each of its operations as the SDKs see it. */
const sdkPath = (item: JsonObject): JsonObject =>
  Object.fromEntries(
    Object.entries(item).map(([key, value]): [string, Json] => {
      if (!methods.has(key)) {
        return [key, value];
      }

      const operation = sdkOperation(decodeObject(value));

      return [
        key,
        repeatable.has(key)
          ? operation
          : withEntries(operation, [["x-fern-retries", { disabled: true }]]),
      ];
    })
  );

const paths: JsonObject = Object.fromEntries(
  Object.entries(objectAt(document, "paths")).map(
    ([route, item]): [string, Json] => [route, sdkPath(decodeObject(item))]
  )
);

const SdkNamesSchema = Schema.Struct({
  "x-fern-sdk-group-name": Schema.Union([
    Schema.String,
    Schema.Array(Schema.String),
  ]),
  "x-fern-sdk-method-name": Schema.String,
});

const decodeSdkNames = Schema.decodeUnknownSync(SdkNamesSchema);

// Each kept operation's namespace (its segments joined) and method.
const sdkNames = Object.values(paths)
  .filter(isJsonObject)
  .flatMap((item) =>
    Object.entries(item).flatMap(([key, operation]) => {
      if (!methods.has(key)) {
        return [];
      }

      const names = decodeSdkNames(operation);
      const group = names["x-fern-sdk-group-name"];

      return [
        {
          method: names["x-fern-sdk-method-name"],
          namespace: isString(group) ? group : group.join("."),
        },
      ];
    })
  );

const [problem] = namespaceProblems(sdkNames);

if (problem !== undefined) {
  throw new Error(problem);
}

const isNonFinite = (value: Json): boolean => {
  if (!isJsonObject(value)) {
    return false;
  }

  const names = value["enum"];

  return (
    isStringArray(names) &&
    names.length === nonFinite.length &&
    nonFinite.every((name) => names.includes(name))
  );
};

/**
 * Copies a node, naming the non-finite numbers. Any other enum inline in an
 * anyOf or oneOf stops the script: give it a schema of its own in the
 * contract, or a name here.
 */
const nameInlineEnums = (node: Json): Json => {
  if (isJsonArray(node)) {
    return node.map(nameInlineEnums);
  }

  if (!isJsonObject(node)) {
    return node;
  }

  const nameMember = (member: Json, key: string): Json => {
    if (isNonFinite(member)) {
      return { $ref: `${schemaPrefix}${nonFiniteName}` };
    }

    if (isJsonObject(member) && "enum" in member) {
      throw new Error(
        `An enum inline in ${key} needs a name: ${JSON.stringify(member)}`
      );
    }

    return nameInlineEnums(member);
  };

  return Object.fromEntries(
    Object.entries(node).map(([key, value]): [string, Json] => [
      key,
      (key === "anyOf" || key === "oneOf") && isJsonArray(value)
        ? value.map((member) => nameMember(member, key))
        : nameInlineEnums(value),
    ])
  );
};

const components = objectAt(document, "components");
const contractSchemas = objectAt(components, "schemas");

/** Adds the names of the schemas a node references, followed through each schema. */
const collectReferences = (node: Json, found: Set<string>): void => {
  if (isJsonArray(node)) {
    for (const child of node) {
      collectReferences(child, found);
    }

    return;
  }

  if (!isJsonObject(node)) {
    return;
  }

  if (isReference(node) && node.$ref.startsWith(schemaPrefix)) {
    const name = node.$ref.slice(schemaPrefix.length);
    const schema = contractSchemas[name];

    if (!found.has(name)) {
      found.add(name);

      if (schema !== undefined) {
        collectReferences(schema, found);
      }
    }
  }

  for (const child of Object.values(node)) {
    collectReferences(child, found);
  }
};

const referencedSchemas = (root: Json): Set<string> => {
  const found = new Set<string>();

  collectReferences(root, found);

  return found;
};

/** The property Effect writes on each member of a tagged union. */
const tagProperty = "_tag";

/** What the SDKs call it: Fern refuses a name that starts with an underscore. */
const tagName = "type";

const isOneValueEnum = Schema.is(
  Schema.Struct({ enum: Schema.Tuple([Schema.String]) })
);

const pascalCase = (text: string): string =>
  text
    .split(/[^A-Za-z0-9]+/u)
    .filter((word) => word !== "")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join("");

/** The member's tag, when it is an object whose `_tag` holds one value. */
const tagOf = (member: Json): string | undefined => {
  const schema =
    isReference(member) && member.$ref.startsWith(schemaPrefix)
      ? contractSchemas[member.$ref.slice(schemaPrefix.length)]
      : member;

  if (!isJsonObject(schema) || schema["type"] !== "object") {
    return undefined;
  }

  const { properties } = schema;
  const tag = isJsonObject(properties) ? properties[tagProperty] : undefined;

  return isOneValueEnum(tag) ? tag.enum[0] : undefined;
};

/** The members of a union whose every member is tagged, or undefined. */
const taggedMembers = (node: JsonObject): readonly Json[] | undefined => {
  const members = node["anyOf"] ?? node["oneOf"];

  return isJsonArray(members) &&
    members.length > 0 &&
    members.every((member) => tagOf(member) !== undefined)
    ? members
    : undefined;
};

/**
 * Copies a node, writing each tagged union as Fern reads one: Effect gives an
 * anyOf of objects, each with a one-value `_tag`, and Fern needs a oneOf with
 * an OpenAPI discriminator, whose mapping names one schema per tag. A member
 * written inline becomes the schema `<name><Tag>` (`ChannelStatusDisabled`),
 * added to `variants`; `name` is the schema holding the node, followed by
 * the properties down to it.
 */
const tagUnions = (
  node: Json,
  name: string | undefined,
  variants: Map<string, Json>
): Json => {
  if (isJsonArray(node)) {
    return node.map((child) => tagUnions(child, name, variants));
  }

  if (!isJsonObject(node)) {
    return node;
  }

  const copy = Object.fromEntries(
    Object.entries(node).map(([key, value]): [string, Json] => [
      key,
      key === "properties" && isJsonObject(value)
        ? Object.fromEntries(
            Object.entries(value).map(([property, schema]): [string, Json] => [
              property,
              tagUnions(
                schema,
                name === undefined
                  ? undefined
                  : `${name}${pascalCase(property)}`,
                variants
              ),
            ])
          )
        : tagUnions(value, name, variants),
    ])
  );

  const members = taggedMembers(copy);

  if (members === undefined) {
    return copy;
  }

  const mapping = members.map((member): [string, string] => {
    const tag = tagOf(member) ?? "";

    if (isReference(member)) {
      return [tag, member.$ref];
    }

    if (name === undefined) {
      throw new Error(
        `A tagged union outside the schemas writes a member inline; name it in the contract: ${JSON.stringify(member)}`
      );
    }

    const variant = `${name}${pascalCase(tag)}`;

    if (variant in contractSchemas || variants.has(variant)) {
      throw new Error(`Two schemas would be named ${variant}`);
    }

    variants.set(variant, member);

    return [tag, `${schemaPrefix}${variant}`];
  });

  return withEntries(
    Object.fromEntries(Object.entries(copy).filter(([key]) => key !== "anyOf")),
    [
      ["oneOf", mapping.map(([, reference]) => ({ $ref: reference }))],
      [
        "discriminator",
        {
          mapping: Object.fromEntries(mapping),
          propertyName: tagProperty,
          "x-fern-property-name": tagName,
        },
      ],
    ]
  );
};

const variants = new Map<string, Json>();

const sdkPaths = tagUnions(nameInlineEnums(paths), undefined, variants);

const schemaEntries = [...referencedSchemas(sdkPaths)]
  .toSorted()
  .flatMap((name): [string, Json][] => {
    const schema = contractSchemas[name];

    if (schema === undefined) {
      throw new Error(
        `The contract references a schema it does not define: ${name}`
      );
    }

    return [[name, tagUnions(nameInlineEnums(schema), name, variants)]];
  });

const namedSchemas: JsonObject = Object.fromEntries(
  // By code unit, the same on every machine.
  [...schemaEntries, ...variants.entries()].toSorted(([left], [right]) =>
    left < right ? -1 : 1
  )
);

// Naming the inline enums can only add references to this one schema.
const schemas: JsonObject = referencedSchemas({
  paths: sdkPaths,
  schemas: namedSchemas,
}).has(nonFiniteName)
  ? withEntries(namedSchemas, [
      [
        nonFiniteName,
        {
          description:
            "A number JSON cannot hold: infinity, negative infinity or not a number.",
          enum: nonFinite,
          type: "string",
        },
      ],
    ])
  : namedSchemas;

const usedTags = new Set(
  Object.values(paths)
    .filter(isJsonObject)
    .flatMap((item) =>
      Object.entries(item)
        .filter(([key]) => methods.has(key))
        .flatMap(([, operation]) => decodeOperation(operation).tags ?? [])
    )
);

const documentTags = document["tags"];

const info = withEntries(objectAt(document, "info"), [
  ["contact", { email: contactEmail, name: "Peal", url: homepage }],
  [
    "description",
    "Schedule posts across social platforms, follow how they did, and manage a Peal workspace's channels, media and members.",
  ],
  ["license", { identifier: "Apache-2.0", name: "Apache-2.0" }],
]);

// The events Peal sends to webhook endpoints stay out: the open-source
// generators make no typed events of an OpenAPI `webhooks` section, and the
// SDKs are clients of the API, not receivers (see AGENTS.md).
const leftOut = new Set(["webhooks"]);

const kept: JsonObject = Object.fromEntries(
  Object.entries(document).filter(([key]) => !leftOut.has(key))
);

const apiVersion = objectAt(document, "info")["version"];

if (!isString(apiVersion) || !/^\d{4}-\d{2}-\d{2}$/u.test(apiVersion)) {
  throw new Error(
    `The contract's document names no version of the API (info.version, a release's day): ${JSON.stringify(apiVersion)}`
  );
}

// Each SDK sends the version of the API it was generated against on every
// request (`Peal-Version`), a literal its users never have to set; and the
// workspace its client acts in (`Peal-Workspace`), when its user gives one:
// an API key and a bound token act in their own without it.
const globalHeaders: Json = [
  {
    header: "Peal-Version",
    name: "pealVersion",
    type: `literal<"${apiVersion}">`,
  },
  {
    header: "Peal-Workspace",
    name: "workspace",
    // No `type`: the generators read one as the header's whole type, and
    // the header would no longer be optional.
    optional: true,
  },
];

const sdkDocumentContent = withEntries(kept, [
  ["x-fern-global-headers", globalHeaders],
  [
    "components",
    {
      schemas,
      securitySchemes: {
        bearer: objectAt(objectAt(components, "securitySchemes"), "bearer"),
      },
    },
  ],
  ["info", info],
  ["paths", sdkPaths],
  ["servers", [{ description: "Peal", url: defaultServer }]],
  [
    "tags",
    (isJsonArray(documentTags) ? documentTags : []).filter(
      (tag) =>
        isJsonObject(tag) && isString(tag["name"]) && usedTags.has(tag["name"])
    ),
  ],
]);

await Bun.write(
  sdkDocument,
  `${JSON.stringify(sdkDocumentContent, null, 2)}\n`
);
