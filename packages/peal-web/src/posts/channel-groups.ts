import type { Platform, SocialChannel } from "peal-contract";

/** The workspace's channels on one platform, in the list's order. */
export interface PlatformGroup<C extends Pick<SocialChannel, "platform">> {
  readonly channels: readonly C[];
  readonly platform: Platform;
}

/**
 * The channels grouped by platform, each platform where its first channel
 * is in the list, its channels in the list's order: the composer's picker
 * and its list of channels read the same groups.
 */
export const platformGroupsOf = <C extends Pick<SocialChannel, "platform">>(
  channels: readonly C[]
): readonly PlatformGroup<C>[] => {
  const groups = new Map<Platform, C[]>();

  for (const channel of channels) {
    const group = groups.get(channel.platform);

    if (group === undefined) {
      groups.set(channel.platform, [channel]);
    } else {
      group.push(channel);
    }
  }

  return [...groups].map(([platform, grouped]) => ({
    channels: grouped,
    platform,
  }));
};

/** How many of a platform's channels the post goes to. */
export type GroupChoice = "all" | "none" | "some";

/**
 * Whether the post goes to every channel of the group that it could be
 * sent to, to some, or to none: the group's box is ticked, half ticked or
 * empty. A channel turned off or to reconnect counts only once chosen.
 */
export const groupChoiceOf = (
  group: readonly Pick<SocialChannel, "id" | "status">[],
  selected: readonly string[]
): GroupChoice => {
  const chosen = group.filter(({ id }) => selected.includes(id)).length;

  const offered = group.filter(
    ({ id, status }) => status._tag === "active" || selected.includes(id)
  ).length;

  if (chosen === 0) {
    return "none";
  }

  return chosen === offered ? "all" : "some";
};

/**
 * The selection once a platform's box is ticked (every channel it stands
 * for that publishes joins) or cleared (every one of them leaves), in the
 * list's order, the others' choices kept. The box stands for the
 * platform's channels the list shows (`group`): all of them, or those a
 * search leaves, so it never picks a channel out of sight.
 */
export const withGroup = (
  channels: readonly Pick<SocialChannel, "id" | "status">[],
  selected: readonly string[],
  group: readonly Pick<SocialChannel, "id">[],
  checked: boolean
): readonly string[] =>
  channels.flatMap(({ id, status }) => {
    if (!group.some((member) => member.id === id)) {
      return selected.includes(id) ? [id] : [];
    }

    if (!checked) {
      return [];
    }

    return status._tag === "active" || selected.includes(id) ? [id] : [];
  });

/** A search's words, lower case, without spaces around them. */
const wordsOf = (query: string): readonly string[] =>
  query
    .toLocaleLowerCase()
    .split(/\s+/u)
    .filter((word) => word !== "");

/**
 * Whether a channel answers a search: every word of it is in one of the
 * names the picker shows (the workspace's, the platform's, the handle) or
 * in the platform's name, so "insta bakery" finds the bakery's Instagram.
 */
export const answersSearch = (
  channel: Pick<SocialChannel, "displayName" | "handle" | "label">,
  platformName: string,
  query: string
): boolean => {
  const names = [
    channel.label ?? "",
    channel.displayName ?? "",
    channel.handle,
    platformName,
  ]
    .join(" ")
    .toLocaleLowerCase();

  return wordsOf(query).every((word) => names.includes(word));
};

// From how many channels the picker offers a search.
const searchFrom = 8;

/** Whether the picker offers a search among the workspace's channels. */
export const offersSearch = (channels: readonly unknown[]): boolean =>
  channels.length >= searchFrom;
