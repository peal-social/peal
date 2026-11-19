import { onCLS, onFCP, onINP, onLCP } from "web-vitals";
import type { Metric } from "web-vitals";

// How fast a page loaded, as numbers: the four web vitals PostHog's web
// analytics reads (`$web_vitals_<name>_value`), sent once as the page is
// hidden or left, in one `$web_vitals` event. Measured with Google's
// `web-vitals` itself, without attribution, so no element is named.

/** The event's properties for the metrics measured so far. */
export const webVitalsProperties = (
  metrics: ReadonlyMap<Metric["name"], number>
): Record<string, number> =>
  Object.fromEntries(
    [...metrics].map(([name, value]) => [`$web_vitals_${name}_value`, value])
  );

/** Measures the page, and calls `send` once with what was measured. */
export const watchWebVitals = (
  send: (properties: Record<string, number>) => void
): void => {
  const metrics = new Map<Metric["name"], number>();
  let sent = false;

  const keep = (metric: Metric) => {
    metrics.set(metric.name, metric.value);
  };

  onCLS(keep);
  onFCP(keep);
  onINP(keep);
  onLCP(keep);

  // After web-vitals' own listeners, which report CLS and INP on hiding.
  const flush = () => {
    if (!sent && metrics.size > 0) {
      sent = true;
      send(webVitalsProperties(metrics));
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush();
    }
  });
  window.addEventListener("pagehide", flush);
};
