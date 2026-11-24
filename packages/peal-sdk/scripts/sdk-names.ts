/** One operation as the SDKs name it: its namespace, dotted, and its method. */
export interface SdkName {
  readonly method: string;
  readonly namespace: string;
}

/**
 * Every namespace the generators make a client for: each operation's, and
 * every one above it (`inbox` for `inbox.messages`), whether or not it
 * holds an operation of its own.
 */
export const namespacesOf = (names: readonly SdkName[]): ReadonlySet<string> =>
  new Set(
    names.flatMap(({ namespace }) =>
      namespace
        .split(".")
        .map((_, at, segments) => segments.slice(0, at + 1).join("."))
    )
  );

/**
 * What stops the SDKs' document: the generators name a namespace's client
 * and its inlined request types after its last segment alone, so Rust
 * numbers a second client of the same name (`UsageClient2`); a Ruby client
 * named like its gem's module (`peal`) does not load; and a method named as
 * a namespace beside it clashes in every language.
 */
export const namespaceProblems = (
  names: readonly SdkName[]
): readonly string[] => {
  const namespaces = namespacesOf(names);
  const byLast = new Map<string, string>();
  const problems: string[] = [];

  for (const namespace of namespaces) {
    const segments = namespace.split(".");
    const last = segments.at(-1) ?? namespace;
    const before = byLast.get(last);

    if (before === undefined) {
      byLast.set(last, namespace);
    } else {
      problems.push(
        `The SDKs' namespaces ${before} and ${namespace} end alike: rename one`
      );
    }

    if (segments.includes("peal")) {
      problems.push(`No SDK namespace may be called peal: ${namespace}`);
    }
  }

  for (const { method, namespace } of names) {
    if (namespaces.has(`${namespace}.${method}`)) {
      problems.push(
        `The method ${namespace}.${method} has the name of a namespace beside it`
      );
    }
  }

  return problems;
};
