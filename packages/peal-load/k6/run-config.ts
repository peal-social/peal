// The accounts `scripts/setup.ts` made, and the servers `scripts/serve.ts`
// runs (SERVERS of them, from port 3100), for the k6 scripts.

interface RunConfig {
  readonly base: string;
  readonly workspaces: readonly {
    readonly apiKey: string;
    readonly channelIds: readonly string[];
    readonly workspaceId: string;
  }[];
}

// k6 reads files only while it loads the script, from the script's folder.
export const config: RunConfig = JSON.parse(open("../.local/config.json"));

const servers = Number(__ENV["SERVERS"] ?? "1");

/** Every server's base address; a VU keeps to one. */
export const bases: readonly string[] = Array.from(
  { length: servers },
  (_, index) => `http://127.0.0.1:${3100 + index}`
);
