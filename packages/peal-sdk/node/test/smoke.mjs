// The smoke test, which scripts/test.ts runs against a stand-in API: the
// health check, the credential check with a bearer token, and the error a
// refused token raises, through the ES modules npm ships.
import { Peal, PealClient, PealError } from "../dist/esm/index.mjs";

const baseUrl = process.env.PEAL_API_URL;
const peal = new PealClient({ baseUrl, token: "peal_test" });

await peal.system.health();
const credential = await peal.credential.get();

if (
  credential._tag !== "apiKey" ||
  credential.workspace.name !== "Studio" ||
  credential.expiresAt !== null ||
  credential.start !== null ||
  !credential.permissions.includes(Peal.Permission.PostSchedule)
) {
  throw new Error(`Unexpected answer: ${JSON.stringify(credential)}`);
}

try {
  await new PealClient({ baseUrl, token: "refused" }).credential.get();
  throw new Error("A refused token got an answer");
} catch (error) {
  if (!(error instanceof PealError) || error.statusCode !== 401) {
    throw error;
  }
}

console.log("ok");
