/**
 * Where the browser sends what the web app measures, on Peal's own
 * origin: the relay (`relay.ts`) forwards it to PostHog. A neutral name,
 * as PostHog advises against obvious ones.
 */
export const relayPrefix = "/pulse";
