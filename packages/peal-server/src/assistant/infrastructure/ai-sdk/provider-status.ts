// Some providers answer a wrong key with 400 rather than 401 (xAI's
// "Incorrect API key provided", Google's "API key not valid"), which would
// read as a refused request instead of settings to fix. The answer's body
// is searched for those words only, then dropped: it is never logged or
// kept.
const keyRefusal = /api[\s_-]?key|unauthori[sz]ed|authenticat/iu;

/** The status Peal reads a provider's failure by. */
export const providerStatusOf = (
  status: number,
  body: string | undefined
): number =>
  status === 400 && body !== undefined && keyRefusal.test(body) ? 401 : status;
