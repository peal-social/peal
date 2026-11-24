import type { Buffer } from "node:buffer";
import type { IncomingMessage } from "node:http";
import { buffer } from "node:stream/consumers";

/**
 * A request's whole body, as a fake server receives it, or `undefined`
 * when its client went away before sending all of it: a fetch aborted by
 * its timeout, or the connections a fake closes with its scope. The read
 * then fails with Node's `aborted` (`ECONNRESET`), and the fake, which
 * has no one left to answer, forgets the request; left to the handler
 * that awaits it, that failure rejects outside every test, once the test
 * that sent it may have ended.
 */
export const receivedBody = async (
  incoming: IncomingMessage
): Promise<Buffer | undefined> => {
  try {
    return await buffer(incoming);
  } catch {
    return undefined;
  }
};
