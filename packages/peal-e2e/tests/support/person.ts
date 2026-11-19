// The SDK drops what a browser driven by a test sends as a bot's (its
// user agent says headless, `navigator.webdriver` is set): this one reads
// as a person's.
const personLike = `(() => {
  const userAgent = navigator.userAgent.replace("HeadlessChrome", "Chrome");
  const as = (name, value) =>
    Object.defineProperty(navigator, name, { configurable: true, get: () => value });
  as("userAgent", userAgent);
  as("userAgentData", undefined);
  as("webdriver", false);
})()`;

// A browser that refuses PostHog's well-known ingestion path, as tracker
// blockers do, and as the WebKit browser production was checked in did:
// what Peal sends must never depend on that path.
const knownIngestion = /\/i\/v0\/e\//u;

/** Makes the journey's browser read as a person's, behind a blocker. */
export const asPerson = async (browser: {
  readonly addInitScript: (script: string) => Promise<void>;
  readonly route: (
    pattern: RegExp,
    handler: (route: { readonly abort: () => Promise<void> }) => Promise<void>
  ) => Promise<void>;
}): Promise<void> => {
  await browser.addInitScript(personLike);
  await browser.route(knownIngestion, async (route) => {
    await route.abort();
  });
};
