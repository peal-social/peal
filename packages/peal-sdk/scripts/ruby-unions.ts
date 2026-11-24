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

const discriminantLine = /^(?<indent> *)discriminant :(?<name>\w+)$/mu;

const memberLine =
  /^(?<start> *member -> \{ [\w:]+::(?<className>\w+) \}, key: )"(?<key>[^"]*)"$/gmu;

/** A Ruby symbol: `:_tag`, or `:"…"` for a name a bare symbol cannot hold. */
const symbol = (name: string): string =>
  /^[A-Za-z_]\w*$/u.test(name) ? `:${name}` : `:${JSON.stringify(name)}`;

/**
 * A union file as the API's JSON needs it: the discriminant read under the
 * property the API sends it in, and each member keyed by its tag. A file
 * that is not a discriminated union comes back as it was; a member whose
 * schema, property or tag the document does not give stops the run, as
 * does a key that is not the generator's form of its tag.
 */
export const rubyUnionSource = (
  source: string,
  document: UnionDocument
): string => {
  if (!source.includes("::Internal::Types::Union\n")) {
    return source;
  }

  const discriminant = discriminantLine.exec(source)?.groups;

  if (discriminant === undefined) {
    return source;
  }

  const { indent = "", name = "" } = discriminant;
  const members = [...source.matchAll(memberLine)];
  const memberCount = source.match(/^ *member -> /gmu)?.length ?? 0;

  if (members.length === 0 || members.length !== memberCount) {
    throw new Error(
      `A Ruby union discriminated by ${name} has members this script cannot read`
    );
  }

  const properties = new Set<string>();

  const keyed = source.replaceAll(
    memberLine,
    (line, start: string, className: string, key: string) => {
      const member = schemaNamed(document, className);
      const property = wireProperty(document, member, name);

      if (property === undefined) {
        throw new Error(
          `The schema of ${className} has no property for the discriminant ${name}`
        );
      }

      const tag = tagOf(member, property);

      if (normalized(tag) !== normalized(key)) {
        throw new Error(
          `${line.trim()} keys ${className}, whose ${property} is ${tag}`
        );
      }

      properties.add(property);

      return `${start}${JSON.stringify(tag)}`;
    }
  );

  const [property, ...others] = properties;

  if (property === undefined || others.length > 0) {
    throw new Error(
      `A Ruby union's members take ${name} from ${[...properties].join(" and ")}`
    );
  }

  return keyed.replace(
    discriminantLine,
    `${indent}discriminant ${symbol(property)}`
  );
};
