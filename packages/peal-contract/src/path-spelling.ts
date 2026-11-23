/**
 * Whether a request's path is written in a way Peal refuses before it routes
 * it: with an encoded slash or backslash (`%2F`, `%5C`, in any case), a
 * backslash, a semicolon, raw or encoded (`;`, `%3B`), or a dot segment, raw
 * or encoded (`.`, `..`, `%2e%2e`, `.%2E`). The server answers such a path
 * 400 (`BadRequest`), and the web app its pages.
 *
 * The proxy in front of Peal (cloudflared) decodes a path and resolves its
 * dot segments and backslashes before it picks the rule that says whether
 * Cloudflare Access guards it, then forwards the path as sent. The server's
 * router and Next's do neither: they keep `%2F` inside a segment. So
 * `/api/admin/users/x%2F..%2F..%2F..%2F..%2Fapi%2Fhealth` is `/api/health`
 * to the proxy, which lets it through, and the staff console's
 * `/api/admin/users/:userId` to the router. It also drops what follows a
 * `;` in a segment, so `/api/admin/users/..;/..;/x` is `/api/x` to it, and
 * a user's id to the router. No route of Peal takes a slash, a backslash, a
 * semicolon or a lone dot in a path parameter (ids are UUIDs, codes letters
 * and digits, the rest literals), so refusing them costs nothing.
 *
 * Only the path counts: its query may hold anything.
 */
export const isRefusedPath = (url: string): boolean => {
  const [path = url] = url.split(/[?#]/u, 1);

  return (
    /%2f|%5c|%3b|[\\;]/iu.test(path) ||
    path.split("/").some((segment) => /^(?:\.|%2e){1,2}$/iu.test(segment))
  );
};
