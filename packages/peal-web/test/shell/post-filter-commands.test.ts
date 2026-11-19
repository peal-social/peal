import { describe, expect, it } from "@effect/vitest";

import { filtersOf } from "#posts/post-list-filter.ts";
import {
  postFilterCommands,
  postFilterHref,
  postFilterKey,
  postFilterView,
} from "#shell/post-filter-commands.ts";

const workspace = "synthetic-studio";

const queryOfHref = (href: string) =>
  new URLSearchParams(href.slice(href.indexOf("?") + 1));

describe(postFilterHref, () => {
  it("opens the posts list on scheduled posts", () => {
    expect(
      postFilterHref(workspace, { kind: "status", status: "scheduled" })
    ).toBe(`/${workspace}/posts?status=scheduled`);
  });

  it("asks finished posts with an outcome, as the list's filter needs", () => {
    expect(
      postFilterHref(workspace, { kind: "outcome", outcome: "failed" })
    ).toBe(`/${workspace}/posts?status=finished&outcome=failed`);
  });

  it("writes every command as filters the posts list reads back", () => {
    const read = postFilterCommands.map((command) => {
      const { outcome, status } = filtersOf(
        queryOfHref(postFilterHref(workspace, command))
      );

      return { outcome, status };
    });

    expect(read).toStrictEqual(
      postFilterCommands.map((command) =>
        command.kind === "status"
          ? { outcome: undefined, status: command.status }
          : { outcome: command.outcome, status: "finished" }
      )
    );
  });
});

describe(postFilterKey, () => {
  it("opens the Drafts and Needs approval tabs with G then D and G then A", () => {
    expect(
      postFilterCommands.flatMap((command) => {
        const key = postFilterKey(command);

        return key === null
          ? []
          : [
              [
                postFilterView(command),
                key,
                postFilterHref(workspace, command),
              ],
            ];
      })
    ).toStrictEqual([
      ["drafts", "d", `/${workspace}/posts?status=draft`],
      ["approval", "a", `/${workspace}/posts?status=awaitingApproval`],
    ]);
  });
});
