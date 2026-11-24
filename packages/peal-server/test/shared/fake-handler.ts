import type { IncomingMessage, ServerResponse } from "node:http";

// What a fake answers when its own code failed: a 500 if nothing was sent
// yet, the connection dropped otherwise.
const failed = (response: ServerResponse) => {
  if (response.headersSent) {
    response.destroy();

    return;
  }

  response.writeHead(500, { connection: "close" });
  response.end();
};

/**
 * A fake server's request listener, answering with `answer`: Node never
 * awaits a listener, so a failure of the fake's own (a handler that
 * throws, a path whose percent escape is malformed) would reject outside
 * every test, once the test that sent the request may have ended. It is
 * answered 500 instead, which the test that sent it reads.
 */
export const fakeHandler =
  (
    answer: (
      incoming: IncomingMessage,
      response: ServerResponse
    ) => Promise<void>
  ) =>
  (incoming: IncomingMessage, response: ServerResponse) => {
    const answering = async () => {
      try {
        await answer(incoming, response);
      } catch {
        failed(response);
      }
    };

    void answering();
  };
