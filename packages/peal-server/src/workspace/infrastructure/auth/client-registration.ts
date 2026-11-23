import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";
import { Option, Schema } from "effect";

// What a client registering itself may ask for that would have Peal call
// an address it chose when its user signs out: Better Auth posts to it
// with a fetch of its own, outside the outbound guard, so a client could
// point it inside Peal's network.
const refusedFields = [
  "backchannel_logout_uri",
  "backchannel_logout_session_required",
] as const;

// The body as JSON gave it, every key kept whatever its value.
const decodeBody = Schema.decodeUnknownOption(
  Schema.Record(Schema.String, Schema.Json)
);

/** The code a registration with a refused field answers with. */
export const registrationFieldCode = "REGISTRATION_FIELD_NOT_ALLOWED";

/**
 * Refuses with 400 `REGISTRATION_FIELD_NOT_ALLOWED` a dynamic client
 * registration (`/oauth2/register`) that asks for back-channel logout:
 * Peal tells no client of a sign-out. A body that is no JSON object is
 * left to the route, which refuses it.
 */
export const guardClientRegistration = (ctx: GenericEndpointContext): void => {
  if (ctx.path !== "/oauth2/register") {
    return;
  }

  const refused = Option.match(decodeBody(ctx.body), {
    onNone: () => [],
    onSome: (body) =>
      refusedFields.filter((field) => Object.hasOwn(body, field)),
  });

  if (refused.length > 0) {
    throw APIError.from("BAD_REQUEST", {
      code: registrationFieldCode,
      message: `Peal tells no client of a sign-out: register without ${refused.join(" and ")}`,
    });
  }
};
