// What the Ruby SDK's tagged unions need from scripts/finish.ts. Ruby's
// generator writes each union's discriminant under the name the SDKs give
// it (`type`, which the document declares for `_tag`) and keys each member
// by its tag in capitals (`API_KEY` for `apiKey`), and its runtime looks
// for that name and that key in the JSON: no answer the API sends would
// ever match. The generator takes no option for either, so the union files
// are rewritten here with the names and the tags the API sends, read from
// the SDKs' document.
import { Schema } from "effect";

const isJsonObject = Schema.is(Schema.JsonObject);

const isOneValueEnum = Schema.is(
  Schema.Struct({ enum: Schema.Tuple([Schema.String]) })
);

const DiscriminatorSchema = Schema.Struct({
  propertyName: Schema.String,
  "x-fern-property-name": Schema.optional(Schema.String),
});

const isDiscriminator = Schema.is(DiscriminatorSchema);

/** What the rewriting reads of the SDKs' document. */
export interface UnionDocument {
  /** Each discriminant's SDK name, with the property the API sends it in. */
  readonly renamed: ReadonlyMap<string, string>;
  /** The document's schemas, by name. */
  readonly schemas: Schema.JsonObject;
}

/** A name without its case or separators: `CredentialAPIKey`, `credential_api_key`. */
const normalized = (name: string): string =>
  name.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");

/**
 * The discriminants the document renames (`type` for `_tag`): a name the
 * document gives two properties would leave the Ruby SDK unable to tell
 * which one the API sends.
 */
export const unionDocument = (schemas: Schema.JsonObject): UnionDocument => {
  const renamed = new Map<string, string>();

  for (const schema of Object.values(schemas)) {
    const discriminator = isJsonObject(schema)
      ? schema["discriminator"]
      : undefined;

    if (!isDiscriminator(discriminator)) {
      continue;
    }

    const name = discriminator["x-fern-property-name"];

    if (name === undefined) {
      continue;
    }

    const known = renamed.get(name);

    if (known !== undefined && known !== discriminator.propertyName) {
      throw new Error(
        `The document names both ${known} and ${discriminator.propertyName} ${name}`
      );
    }

    renamed.set(name, discriminator.propertyName);
  }

  return { renamed, schemas };
};

/** The schema a Ruby class was generated from, matched by its name. */
const schemaNamed = (
  document: UnionDocument,
  className: string
): Schema.JsonObject => {
  const matches = Object.entries(document.schemas).filter(
    ([name]) => normalized(name) === normalized(className)
  );

  const [match] = matches;

  if (matches.length !== 1 || match === undefined) {
    throw new Error(
      `The Ruby class ${className} matches ${matches.length} schemas of the document`
    );
  }

  const [name, schema] = match;

  if (!isJsonObject(schema)) {
    throw new Error(`The schema ${name} is not an object`);
  }

  return schema;
};

/** The property of the member's schema the API sends the discriminant in. */
const wireProperty = (
  document: UnionDocument,
  member: Schema.JsonObject,
  discriminant: string
): string | undefined => {
  const properties = isJsonObject(member["properties"])
    ? member["properties"]
    : {};

  return (
    document.renamed.get(discriminant) ??
    Object.keys(properties).find(
      (property) => normalized(property) === normalized(discriminant)
    )
  );
};

/** The member's tag: the one value its schema allows in that property. */
const tagOf = (member: Schema.JsonObject, property: string): string => {
  const properties = isJsonObject(member["properties"])
    ? member["properties"]
    : {};

  const schema = properties[property];

  if (!isOneValueEnum(schema)) {
    throw new Error(
      `A union member's ${property} is not one value: ${JSON.stringify(schema)}`
    );
  }

  return schema.enum[0];
};

/** A line that only a union file holds: its `extend`, discriminant or members. */
const unionLine = /^[ \t]*(?:extend\b.*\bUnion\b|discriminant\b|member\b)/mu;

const classLine = /^ *class (?<className>\w+) < Internal::Types::Model$/mu;

const extendLine = /^ *extend [\w:]+::Internal::Types::Union$/mu;

const anyDiscriminantLine = /^[ \t]*discriminant\b.*$/gmu;

const discriminantLine = /^(?<indent> *)discriminant :(?<name>\w+)$/mu;

const anyMemberLine = /^[ \t]*member\b.*$/gmu;

const memberLine =
  /^(?<start> *member -> \{ [\w:]+::(?<className>\w+) \}, key: )"(?<key>[^"]*)"$/gmu;

/** An undiscriminated union's member, whatever its type. */
const plainMemberLine = /^ *member -> \{ [^}]+ \}$/u;

/** An undiscriminated union's member that is one of the SDK's models. */
const modelMemberLine = /^ *member -> \{ Peal::Types::\w+ \}$/u;

/**
 * A Ruby string that interpolates nothing: double quotes for plain text, as
 * the generator writes, and single quotes, with their two escapes, for a
 * text that holds `#`, a quote, a backslash or anything else.
 */
export const rubyString = (text: string): string =>
  /^[\w./:-]*$/u.test(text)
    ? `"${text}"`
    : `'${text.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

/** A Ruby symbol: `:_tag`, or `:'…'` for a name a bare symbol cannot hold. */
const symbol = (name: string): string =>
  /^[A-Za-z_]\w*$/u.test(name) ? `:${name}` : `:${rubyString(name)}`;

/** A file the rewriting has read. */
export interface RubyUnion {
  /**
   * The union's class when every member is one of the SDK's types
   * (`Peal::Types::…`, never `Float` or `String`): a request whose whole
   * body it is goes through it (`.coerce`), so the body's fields take their
   * API names.
   */
  readonly modelUnion: string | undefined;
  /** The file as the API's JSON needs it. */
  readonly source: string;
}

/** The union's class and its `extend`, in the one form the script reads. */
const unionClass = (source: string): string => {
  const className = classLine.exec(source)?.groups?.["className"];

  if (className === undefined || !extendLine.test(source)) {
    throw new Error(
      `A Ruby union's class or its extend line is not in the form this script reads: ${source}`
    );
  }

  return className;
};

/** An undiscriminated union: checked, and left as the generator wrote it. */
const undiscriminated = (source: string, className: string): RubyUnion => {
  const members = source.match(anyMemberLine) ?? [];

  const unread = members.find((line) => !plainMemberLine.test(line));

  if (members.length === 0 || unread !== undefined) {
    throw new Error(
      `The Ruby union ${className} has no discriminant and a member this script cannot read: ${unread ?? "none"}`
    );
  }

  return {
    modelUnion: members.every((line) => modelMemberLine.test(line))
      ? className
      : undefined,
    source,
  };
};

/**
 * A file as the API's JSON needs it. A discriminated union reads its
 * discriminant under the property the API sends it in, and keys each
 * member by its tag; an undiscriminated one is left as it was. Any other
 * file comes back as it was. A union line in a form the script does not
 * read stops the run, as does a member whose schema, property or tag the
 * document does not give, or a key that is not the generator's form of
 * its tag.
 */
export const rubyUnion = (
  source: string,
  document: UnionDocument
): RubyUnion => {
  if (!unionLine.test(source)) {
    return { modelUnion: undefined, source };
  }

  const className = unionClass(source);
  const discriminants = source.match(anyDiscriminantLine) ?? [];

  if (discriminants.length === 0) {
    return undiscriminated(source, className);
  }

  const discriminant = discriminantLine.exec(source)?.groups;

  if (discriminants.length > 1 || discriminant === undefined) {
    throw new Error(
      `The Ruby union ${className} has a discriminant this script cannot read: ${discriminants.join(", ")}`
    );
  }

  const { indent = "", name = "" } = discriminant;
  const members = [...source.matchAll(memberLine)];
  const memberCount = source.match(anyMemberLine)?.length ?? 0;

  if (members.length === 0 || members.length !== memberCount) {
    throw new Error(
      `A Ruby union discriminated by ${name} has members this script cannot read`
    );
  }

  const properties = new Set<string>();

  const keyed = source.replaceAll(
    memberLine,
    (line, start: string, memberClass: string, key: string) => {
      const member = schemaNamed(document, memberClass);
      const property = wireProperty(document, member, name);

      if (property === undefined) {
        throw new Error(
          `The schema of ${memberClass} has no property for the discriminant ${name}`
        );
      }

      const tag = tagOf(member, property);

      if (normalized(tag) !== normalized(key)) {
        throw new Error(
          `${line.trim()} keys ${memberClass}, whose ${property} is ${tag}`
        );
      }

      properties.add(property);

      return `${start}${rubyString(tag)}`;
    }
  );

  const [property, ...others] = properties;

  if (property === undefined || others.length > 0) {
    throw new Error(
      `A Ruby union's members take ${name} from ${[...properties].join(" and ")}`
    );
  }

  return {
    modelUnion: className,
    source: keyed.replace(
      discriminantLine,
      `${indent}discriminant ${symbol(property)}`
    ),
  };
};

/** A document's paths: each path's operations, and anything else it holds. */
export const UnionPathsSchema = Schema.Record(
  Schema.String,
  Schema.Record(Schema.String, Schema.Json)
);

export type UnionPaths = typeof UnionPathsSchema.Type;

const BodySchema = Schema.Struct({
  operationId: Schema.String,
  requestBody: Schema.Struct({
    content: Schema.Struct({
      "application/json": Schema.Struct({ schema: Schema.Json }),
    }),
  }),
});

const isBody = Schema.is(BodySchema);

const isReference = Schema.is(Schema.Struct({ $ref: Schema.String }));

const isJsonArray = Schema.is(Schema.Array(Schema.Json));

/** A schema, through its reference when it is one. */
const resolved = (
  schemas: Schema.JsonObject,
  schema: Schema.Json
): Schema.Json =>
  isReference(schema)
    ? (schemas[schema.$ref.replace("#/components/schemas/", "")] ?? null)
    : schema;

/**
 * The operations whose JSON body is a union of objects (connecting a chat,
 * confirming a target, redelivering webhooks): the Ruby SDK builds each
 * one's body through the union, and finish.ts stops when it rewrote
 * another number of them.
 */
export const unionBodyOperations = (
  paths: UnionPaths,
  schemas: Schema.JsonObject
): readonly string[] =>
  Object.values(paths)
    .flatMap((item) => Object.values(item))
    .flatMap((operation) => {
      if (!isBody(operation)) {
        return [];
      }

      const body = resolved(
        schemas,
        operation.requestBody.content["application/json"].schema
      );

      const members = isJsonObject(body)
        ? (body["oneOf"] ?? body["anyOf"])
        : undefined;

      return isJsonArray(members) &&
        members.length > 0 &&
        members.every((member) => {
          const schema = resolved(schemas, member);

          return isJsonObject(schema) && schema["type"] === "object";
        })
        ? [operation.operationId]
        : [];
    })
    .toSorted();
