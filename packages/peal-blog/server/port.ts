import { Option, Schema } from "effect";

/** The port the image and development listen on. */
export const defaultPort = 4324;

// A whole port from 1 to 65535, written in decimal.
const PortSchema = Schema.String.check(
  Schema.isPattern(/^[1-9]\d{0,4}$/u)
).pipe(
  Schema.decodeTo(Schema.FiniteFromString),
  Schema.decodeTo(
    Schema.Finite.check(Schema.isBetween({ maximum: 65_535, minimum: 1 }))
  )
);

/** The port PORT names, or the default when it is unset, empty or not one. */
export const portOf = (value: string | undefined): number =>
  Schema.decodeUnknownOption(PortSchema)(value?.trim()).pipe(
    Option.getOrElse(() => defaultPort)
  );
