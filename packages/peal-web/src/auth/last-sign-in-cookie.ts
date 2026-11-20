import { cookies } from "next/headers";
import { lastSignInCookie } from "peal-contract";
import type { LastSignIn } from "peal-contract";

import { lastSignInOf } from "#auth/last-sign-in.ts";

/** How this browser last signed in, read from the request's cookies. */
export const lastSignIn = async (): Promise<LastSignIn | null> => {
  const jar = await cookies();

  return lastSignInOf(jar.get(lastSignInCookie)?.value);
};
