// A changelog entry, from the title of a pull request squash-merged on main:
// `type(scope)!: description (#NN)`, as the contributing guide asks. Only
// what changes for those who use Peal makes an entry: features, fixes,
// performance and security. Chores, tests, CI, docs, builds, style and
// refactors are left out, and so is a commit without its pull request's
// number, such as the history before the first pull request.

export const sections = [
  "features",
  "fixes",
  "performance",
  "security",
] as const;

export type Section = (typeof sections)[number];

export interface Entry {
  readonly section: Section;
  /** The title's description, as written, without its type or number. */
  readonly description: string;
  /** The pull request the entry links to. */
  readonly pull: number;
  /** A `!` after the type or scope: the change breaks what worked before. */
  readonly breaking: boolean;
}

const sectionOfType = new Map<string, Section>([
  ["feat", "features"],
  ["fix", "fixes"],
  ["perf", "performance"],
  ["security", "security"],
]);

const title =
  /^(?<type>[a-z]+)(?:\((?<scope>[^()]+)\))?(?<breaking>!)?: (?<description>.+) \(#(?<pull>[1-9]\d*)\)$/u;

/**
 * The section a title's type puts it in: `security` itself, or the scope
 * `security` on any type (`fix(security): …`, `chore(deps,security): …`).
 */
const sectionOf = (
  type: string,
  scope: string | undefined
): Section | undefined => {
  const scopes = (scope ?? "").split(",").map((part) => part.trim());

  return scopes.includes("security") ? "security" : sectionOfType.get(type);
};

// A work package's code at the end of a title, which means nothing to
// readers: a capital letter and digits, perhaps a letter, perhaps words
// (`(U15a)`, `(T10)`, `(U4 steps 1-2)`, `(P1 to P3)`).
const workPackage = /\s*\([A-Z]\d+[a-z]?(?:\s[^()]*)?\)$/u;

/** A description without the work-package codes that end it. */
export const withoutCodes = (description: string): string => {
  let text = description.trim();

  while (workPackage.test(text)) {
    text = text.replace(workPackage, "");
  }

  return text;
};

/** The entry a commit's subject makes, or undefined for one left out. */
export const entryOf = (subject: string): Entry | undefined => {
  const groups = title.exec(subject.trim())?.groups;

  if (groups === undefined) {
    return undefined;
  }

  const { breaking, description, pull, scope, type } = groups;

  if (type === undefined || description === undefined || pull === undefined) {
    return undefined;
  }

  const section = sectionOf(type, scope);

  return section === undefined
    ? undefined
    : {
        breaking: breaking === "!",
        description: withoutCodes(description),
        pull: Number(pull),
        section,
      };
};

/** The entries of commits' subjects, in the order given. */
export const entriesOf = (subjects: readonly string[]): readonly Entry[] =>
  subjects.flatMap((subject) => {
    const entry = entryOf(subject);

    return entry === undefined ? [] : [entry];
  });
