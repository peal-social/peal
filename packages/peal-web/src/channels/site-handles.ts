/**
 * The publication's address a Hashnode channel was connected with, to
 * reconnect it: its handle when that is an address (a host, with a dot);
 * none when the publication had none and the handle is the member's
 * name, which Hashnode would not find.
 */
export const publicationAddressOf = (handle: string): string =>
  /^[^\s/@]+\.[^\s/@]+$/u.test(handle) ? handle : "";
