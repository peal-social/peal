/**
 * How the app's atom registry keeps what no component reads any more: two
 * seconds before letting it go. A page the router opens is rendered, its
 * queries read and their requests sent, before it is committed, once its
 * payload is in; without the wait, the registry drops a query read then
 * before the commit mounts it, which cancels its request and sends it
 * again, two or three times for one list.
 */
export const registryOptions = { defaultIdleTTL: 2000 } as const;
