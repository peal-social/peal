/** The host an address names, which a provider's row shows; the address itself when it is not one. */
export const hostOf = (address: string): string =>
  URL.canParse(address) ? new URL(address).host : address;
