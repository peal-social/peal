// The deployed app's versions: the day a release ships, in UTC, as a tag
// `vYYYY.MM.DD`, and `vYYYY.MM.DD.2`, `.3`… for the next ones that day. Git,
// gh and GitHub take them as they are, and a version sort (`git tag
// --sort=v:refname`, and compareVersions here) puts each after the one
// before it. The SDKs keep SemVer and their own tags (`sdk-<language>-v…`,
// `packages/peal-sdk/go/v…`), which this pattern never matches: a year has
// four digits, and the tag has no prefix.

export interface Version {
  /** The day it shipped, `YYYY-MM-DD`, in UTC. */
  readonly date: string;
  /** 1 for the day's first release, 2 for its second… */
  readonly sequence: number;
}

const tagPattern =
  /^v(?<year>\d{4})\.(?<month>\d{2})\.(?<day>\d{2})(?:\.(?<sequence>[1-9]\d*))?$/u;

const datePattern = /^\d{4}-\d{2}-\d{2}$/u;

/** Whether `YYYY-MM-DD` names a day of the calendar. */
export const isDate = (date: string): boolean =>
  datePattern.test(date) &&
  !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
  new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);

/** The version an app tag names, or undefined for any other tag. */
export const versionOfTag = (tag: string): Version | undefined => {
  const groups = tagPattern.exec(tag)?.groups;

  if (groups === undefined) {
    return undefined;
  }

  const date = `${groups["year"]}-${groups["month"]}-${groups["day"]}`;
  const sequence = Number(groups["sequence"] ?? "1");

  // `.1` is never written: the day's first release has no suffix.
  return isDate(date) && (groups["sequence"] === undefined || sequence > 1)
    ? { date, sequence }
    : undefined;
};

/** The tag of a version: `v2026.11.16`, `v2026.11.16.2`. */
export const tagOf = (version: Version): string => {
  const day = `v${version.date.replaceAll("-", ".")}`;

  return version.sequence === 1 ? day : `${day}.${version.sequence}`;
};

/** Older first. */
export const compareVersions = (left: Version, right: Version): number =>
  left.date === right.date
    ? left.sequence - right.sequence
    : left.date.localeCompare(right.date);

/** The version a release shipping on `date` takes, after those there are. */
export const nextVersion = (
  existing: readonly Version[],
  date: string
): Version => {
  const sameDay = existing.flatMap((version) =>
    version.date === date ? [version.sequence] : []
  );

  return { date, sequence: Math.max(0, ...sameDay) + 1 };
};

/** Today, `YYYY-MM-DD`, in UTC. */
export const today = (now: Date = new Date()): string =>
  now.toISOString().slice(0, 10);
