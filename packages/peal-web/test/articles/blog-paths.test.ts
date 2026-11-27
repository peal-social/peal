import { describe, expect, it } from "@effect/vitest";
import type { Channel } from "peal-contract";

import { articlePathOf, blogPathOf } from "#articles/blog-paths.ts";
import { blogNameOf } from "#components/articles/blog-name.tsx";
import { crumbHrefOf, navigationOf } from "#shell/navigation.ts";

const site = "00000000-0000-7000-8000-0000000000d1";
const articleId = "00000000-0000-7000-8000-0000000000c1";

const wordpress: Channel = {
  avatarUrl: null,
  connection: null,
  displayName: null,
  handle: "notes.example",
  id: site,
  label: "Field notes",
  platform: "wordpress",
  status: { _tag: "active" },
  tokenExpiresAt: null,
};

// Where the editor goes once a request worked: a new article opens at its
// own address in its website's blog, a deleted one goes back to the blog.
describe("a blog's addresses", () => {
  it("open a new article in its website's blog, and go back there after a delete", () => {
    expect([
      articlePathOf({ channelId: site, id: articleId }),
      blogPathOf(site),
    ]).toStrictEqual([`/blogs/${site}/${articleId}`, `/blogs/${site}`]);
  });

  it("name the article's website in its page's breadcrumb, leading back to its blog", () => {
    const navigation = navigationOf({
      pathname: `/north-studio${articlePathOf({ channelId: site, id: articleId })}`,
      permissions: ["post:read", "channel:read"],
      workspace: "north-studio",
    });

    expect([
      navigation.breadcrumb,
      crumbHrefOf("north-studio", "blog", navigation.site),
      blogNameOf([wordpress], navigation.site ?? ""),
      blogNameOf([], site),
    ]).toStrictEqual([
      { page: "article", trail: ["blogs", "blog"] },
      `/north-studio/blogs/${site}`,
      "Field notes",
      null,
    ]);
  });
});
