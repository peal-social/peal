/** The header Peal's API reads the web app's measured session from. */
export const sessionHeader = "x-posthog-session-id";

// What names the session now, none until the measurement says. The
// app's HTTP client keeps the `fetch` it started with, so it never sees
// the SDK's own patch of it, and asks here instead. Only the browser's
// measurement sets it (`components/measurement/measurement.tsx`).
let current: () => string | null = () => null;

/**
 * The session the app's requests to Peal's API name: only once the
 * person allowed it, while a page of the app is measured.
 */
export const namedSession = (): string | null => current();

/** Names the session with `name` until the function it answers is called. */
export const nameSessionWith = (name: () => string | null): (() => void) => {
  current = name;

  return () => {
    if (current === name) {
      current = () => null;
    }
  };
};
