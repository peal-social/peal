import { Config, Option, Schema } from "effect";
import { PlatformSchema } from "peal-contract";
import type { Platform } from "peal-contract";

const isPlatform = Schema.is(PlatformSchema);

/** The platforms a comma-separated list names; any other word is left out. */
export const platformsNamed = (list: string): readonly Platform[] =>
  list
    .split(",")
    .map((word) => word.trim())
    .filter(isPlatform);

/**
 * The platforms the operator keeps off the home page's setup card:
 * PEAL_SETUP_HIDDEN_PLATFORMS, platform names separated by commas (such as
 * `facebook,instagram,threads` while Meta reviews the apps), read at
 * request time; none when it is unset or empty. New channel still offers
 * them.
 */
export const setupHiddenPlatformsConfig = Config.option(
  Config.String("PEAL_SETUP_HIDDEN_PLATFORMS")
).pipe(
  Config.map((list) =>
    list.pipe(
      Option.map(platformsNamed),
      Option.getOrElse((): readonly Platform[] => [])
    )
  )
);
