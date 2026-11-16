import { Schema } from "effect";

/**
 * The ad networks Peal reaches: Meta's (Facebook and Instagram) and
 * Google Ads. Stored with every account and object: add one, never rename
 * one. What each network does is in `network-traits.ts`.
 */
export const AdNetworkSchema = Schema.Literals(["meta", "google"]);

export type AdNetwork = typeof AdNetworkSchema.Type;
