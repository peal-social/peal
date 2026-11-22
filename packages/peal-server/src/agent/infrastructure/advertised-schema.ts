import { Schema } from "effect";

// The JSON Schema a tool is advertised with to a provider, made from the
// schema its own Effect Schema writes. Effect writes a string with two
// checks as `{"pattern": …, "allOf": [{"pattern": …}]}` (an id's UUID and
// its lowercase), which Anthropic refuses: an `allOf` member may set no key
// its object sets too ("sibling keys conflict"). The advertised schema
// keeps the object's own key and drops the member's; the tool's own codec
// still decodes every call whole, so nothing it checks is lost.

const JsonObjectSchema = Schema.Record(Schema.String, Schema.Json);

type JsonObject = typeof JsonObjectSchema.Type;

const isObject = Schema.is(JsonObjectSchema);

const isArray = Schema.is(Schema.Array(Schema.Json));

// An `allOf` member without the keys its object sets, or none once
// nothing is left of it.
const withoutSiblings = (
  member: Schema.Json,
  object: JsonObject
): readonly Schema.Json[] => {
  if (!isObject(member)) {
    return [member];
  }

  const own = Object.entries(member).filter(
    ([key]) => !Object.hasOwn(object, key)
  );

  return own.length === 0 ? [] : [Object.fromEntries(own)];
};

const cleanedObject = (object: JsonObject): JsonObject => {
  const cleaned: Record<string, Schema.Json> = Object.fromEntries(
    Object.entries(object).map(([key, value]) => [key, advertised(value)])
  );

  const { allOf } = cleaned;

  if (allOf === undefined || !isArray(allOf)) {
    return cleaned;
  }

  const { allOf: _members, ...siblings } = cleaned;
  const members = allOf.flatMap((member) => withoutSiblings(member, siblings));

  return members.length === 0 ? siblings : { ...siblings, allOf: members };
};

/**
 * The schema, everywhere in it, without an `allOf` member's key that its
 * object sets too: what a provider is sent for a tool's parameters.
 */
export const advertised = (schema: Schema.Json): Schema.Json => {
  if (isArray(schema)) {
    return schema.map(advertised);
  }

  return isObject(schema) ? cleanedObject(schema) : schema;
};

/** A tool's parameters' schema, a JSON object, as a provider is sent it. */
export const advertisedObject = (schema: JsonObject): JsonObject =>
  cleanedObject(schema);

/** A JSON object, as a JSON Schema's root is one. */
export { JsonObjectSchema };

/**
 * The places in a schema where an object sets a key one of its `allOf`
 * members sets too, by their paths: none in what the agent advertises.
 */
export const siblingConflicts = (
  schema: Schema.Json,
  path = "$"
): readonly string[] => {
  if (isArray(schema)) {
    return schema.flatMap((item, index) =>
      siblingConflicts(item, `${path}[${String(index)}]`)
    );
  }

  if (!isObject(schema)) {
    return [];
  }

  const { allOf } = schema;

  const here =
    allOf !== undefined && isArray(allOf)
      ? allOf.flatMap((member, index) =>
          isObject(member)
            ? Object.keys(member)
                .filter((key) => key !== "allOf" && Object.hasOwn(schema, key))
                .map((key) => `${path}.allOf[${String(index)}].${key}`)
            : []
        )
      : [];

  return [
    ...here,
    ...Object.entries(schema).flatMap(([key, value]) =>
      siblingConflicts(value, `${path}.${key}`)
    ),
  ];
};
