/**
 * HTTPS on Peal's zones, as the zone settings say it: plain HTTP answered
 * with a redirect to HTTPS, TLS 1.2 at least, and HSTS as the web app sends
 * it (packages/peal-web/next.config.ts: two years, the subdomains too, never
 * preloaded), with nosniff. Cloudflare's edge adds the header to every
 * answer it proxies, the site's, the docs' and the blog's included.
 *
 * The setting's value is passed to Cloudflare's API as it is written, so
 * its keys are the API's own, in snake case.
 */
export const httpsZoneSettings = {
  always_use_https: "on",
  min_tls_version: "1.2",
  security_header: {
    strict_transport_security: {
      enabled: true,
      include_subdomains: true,
      max_age: 63_072_000,
      nosniff: true,
      preload: false,
    },
  },
} as const;
