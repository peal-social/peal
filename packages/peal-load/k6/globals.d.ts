// k6 gives every script the Web Crypto API as a global, which its types
// leave out: the one part these scripts use.
declare const crypto: { readonly randomUUID: () => string };
