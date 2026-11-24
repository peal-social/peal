// The modules oxlint.config.ts keeps apart, here so that a test can check
// that each still exists where the lint rules look for it
// (`lint-modules.test.ts`), as vitest.config.ts reads its helpers here too.
//
// A module is a part of a context kept apart inside it: a subfolder of the
// same name in each layer (`src/<context>/<layer>/<module>/`). Its files keep
// their layer's rules and may import the rest of the context; the rest of
// the context may not import it, but its container and the seams named
// here, each with its reason; and modules never import each other. A new
// module goes into this map with its seams.

export interface Module {
  readonly seams: readonly string[];
}

export const modules = {
  publishing: {
    feeds: {
      seams: [
        // Deleting a channel set clears the feeds that name it, in its
        // transaction, through FeedStore.
        "src/publishing/application/channel-sets.ts",
        // The daily retention run prunes the feeds' items and reads
        // (`Feeds.prune`) beside the idempotency keys.
        "src/publishing/infrastructure/crons.ts",
      ],
    },
  },
} satisfies Readonly<Record<string, Readonly<Record<string, Module>>>>;
