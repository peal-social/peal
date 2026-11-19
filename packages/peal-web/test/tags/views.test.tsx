import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { NextIntlClientProvider } from "next-intl";
import { maxTagsPerPost } from "peal-contract";
import type { Tag } from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CalendarToolbar } from "#components/posts/calendar-toolbar.tsx";
import type { ViewLink } from "#components/posts/calendar-toolbar.tsx";
import { ChipTags } from "#components/posts/chip-tags.tsx";
import {
  PostTagsView,
  TagChoicesView,
} from "#components/posts/post-tags-field.tsx";
import {
  TagFieldsView,
  TagItemView,
  TagList,
} from "#components/tags/tag-views.tsx";
import { loadMessages } from "#i18n/messages.ts";

const render = async (locale: "en" | "fr", view: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="UTC"
    >
      {view}
    </NextIntlClientProvider>
  );

// The texts among `expected` that the markup lacks.
const missingFrom = (html: string, expected: readonly string[]) =>
  expected.filter((text) => !html.includes(text));

const noop = () => {
  // Nothing changes while rendering to markup.
};

const tag = (id: string, name: string, colour: Tag["colour"]): Tag => ({
  colour,
  createdAt: DateTime.makeUnsafe("2026-11-01T09:00:00Z"),
  id,
  name,
});

const launch = tag("t1", "Launch week", "teal");
const news = tag("t2", "Newsletter", "pink");

describe(TagItemView, () => {
  it("shows a tag with its colour, named for those who cannot see it", async () => {
    const html = await render(
      "en",
      <ul>
        <TagItemView
          tag={launch}
          nameId="tag-name"
          actions={<button type="button">Edit</button>}
        />
      </ul>
    );

    expect(
      missingFrom(html, [
        "Launch week",
        "bg-tag-teal",
        "Teal",
        'id="tag-name"',
        "<button",
      ])
    ).toStrictEqual([]);
  });

  it("shows no actions to a member who may not change tags", async () => {
    const html = await render(
      "fr",
      <ul>
        <TagItemView tag={news} />
      </ul>
    );

    expect(html).toContain("Rose");
    expect(html).not.toContain("<button");
  });
});

describe(TagFieldsView, () => {
  it("offers every colour of the palette as a radio button with its name", async () => {
    const html = await render(
      "en",
      <TagFieldsView
        draft={{ colour: "amber", name: "Launch" }}
        error={null}
        disabled={false}
        idPrefix="new"
        onChange={noop}
      />
    );

    expect(html.match(/type="radio"/gu)).toHaveLength(9);

    expect(
      missingFrom(html, [
        "Grey",
        "Red",
        "Orange",
        "Amber",
        "Green",
        "Teal",
        "Blue",
        "Purple",
        "Pink",
        'value="Launch"',
        'for="new-tag-colour-amber"',
      ])
    ).toStrictEqual([]);

    expect(html).toMatch(/id="new-tag-colour-amber"[^>]*checked=""/u);
  });

  it("explains a name already taken, and a workspace that is full", async () => {
    const taken = await render(
      "fr",
      <TagFieldsView
        draft={{ colour: "gray", name: "Lancement" }}
        error={{ key: "nameTaken" }}
        disabled={false}
        idPrefix="new"
        onChange={noop}
      />
    );

    expect(taken).toContain(
      "L’espace de travail a déjà une étiquette de ce nom."
    );

    const full = await render(
      "en",
      <TagFieldsView
        draft={{ colour: "gray", name: "Launch" }}
        error={{ allowed: 100, key: "tooMany" }}
        disabled={false}
        idPrefix="new"
        onChange={noop}
      />
    );

    expect(full).toContain("The workspace keeps 100 tags, the most it may.");
  });
});

describe(TagList, () => {
  it("lists tags under a name, and shows nothing for none", async () => {
    const html = await render(
      "en",
      <TagList label="Tags" tags={[launch, news]} />
    );

    expect(
      missingFrom(html, [
        'aria-label="Tags"',
        "Launch week",
        "Newsletter",
        "bg-tag-pink",
      ])
    ).toStrictEqual([]);

    await expect(
      render("en", <TagList label="Tags" tags={[]} />)
    ).resolves.toBe("");
  });
});

describe(PostTagsView, () => {
  it("shows a post's tags and what changes them", async () => {
    const html = await render(
      "en",
      <PostTagsView
        tags={[launch]}
        editor={<button type="button">Choose tags</button>}
      />
    );

    expect(
      missingFrom(html, ["Tags</h2>", "Launch week", "Choose tags"])
    ).toStrictEqual([]);
  });

  it("says a post has no tag", async () => {
    await expect(render("fr", <PostTagsView tags={[]} />)).resolves.toContain(
      "Aucune étiquette."
    );
  });
});

describe(TagChoicesView, () => {
  it("ticks the post's tags among the workspace's", async () => {
    const html = await render(
      "en",
      <TagChoicesView
        disabled={false}
        idPrefix="post"
        tagIds={["t2"]}
        tags={[launch, news]}
        onToggle={noop}
      />
    );

    expect(html).toMatch(
      /<button[^>]*id="post-tag-t2"[^>]*aria-checked="true"/u
    );
    expect(html).not.toMatch(
      /<button[^>]*id="post-tag-t1"[^>]*aria-checked="true"/u
    );
    expect(html).not.toContain("tags at most");
  });

  it("takes no other tag on a post that is full, and says why", async () => {
    const many = Array.from({ length: maxTagsPerPost + 1 }, (_, index) =>
      tag(`t${index}`, `Tag ${index}`, "blue")
    );

    const html = await render(
      "en",
      <TagChoicesView
        disabled={false}
        idPrefix="post"
        tagIds={many.slice(0, maxTagsPerPost).map(({ id }) => id)}
        tags={many}
        onToggle={noop}
      />
    );

    expect(html).toContain("A post has 10 tags at most.");
    expect(html).toMatch(
      new RegExp(
        `<button[^>]*id="post-tag-t${maxTagsPerPost}"[^>]* disabled=""`,
        "u"
      )
    );
    expect(html).not.toMatch(/<button[^>]*id="post-tag-t0"[^>]* disabled=""/u);
  });
});

describe(ChipTags, () => {
  it("shows the colour of three tags at most, then how many more", async () => {
    const tags = [
      launch,
      news,
      tag("t3", "Product", "red"),
      tag("t4", "Hiring", "green"),
      tag("t5", "Events", "blue"),
    ];

    const html = await render(
      "en",
      <ChipTags tags={tags} title="Tags: Launch week and four more." />
    );

    expect(html.match(/data-slot="tag-dot"/gu)).toHaveLength(3);

    expect(
      missingFrom(html, [
        "bg-tag-teal",
        "bg-tag-pink",
        "bg-tag-red",
        "+2",
        'title="Tags: Launch week and four more."',
      ])
    ).toStrictEqual([]);

    expect(html).not.toContain("bg-tag-green");
  });

  it("shows nothing for a post without tags", async () => {
    await expect(
      render("en", <ChipTags tags={[]} title="No tag." />)
    ).resolves.toBe("");
  });
});

// The calendar's view links, as plain links.
const PlainLink: ViewLink = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

// The toolbar around a week, with no queue.
const toolbar = (
  filter: Parameters<typeof CalendarToolbar>[0]["filter"],
  options: {
    readonly channels: Parameters<typeof CalendarToolbar>[0]["channels"];
    readonly hidden: number;
    readonly tags: Parameters<typeof CalendarToolbar>[0]["tags"];
  }
) => (
  <CalendarToolbar
    channels={options.channels}
    filter={filter}
    hidden={options.hidden}
    hrefOf={(view) => `/calendar?view=${view}`}
    labels={{ next: "Next week", previous: "Previous week" }}
    link={PlainLink}
    queues={[]}
    tags={options.tags}
    view="week"
    onFilter={noop}
    onStep={noop}
    onToday={noop}
  />
);

describe(CalendarToolbar, () => {
  const channel = {
    avatarUrl: null,
    connection: null,
    displayName: null,
    handle: "@peal@mastodon.example",
    id: "c1",
    label: null,
    platform: "mastodon",
    status: { _tag: "active" },
    tokenExpiresAt: null,
  } as const;

  it("shows its views and Filter, and no chip while nothing is chosen", async () => {
    const html = await render(
      "en",
      toolbar(
        { channelIds: [], queueIds: [], tagIds: [] },
        { channels: [channel], hidden: 0, tags: [launch] }
      )
    );

    expect(
      missingFrom(html, [">Day<", ">Week<", ">Month<", 'aria-label="Filter"'])
    ).toStrictEqual([]);
    expect(html).not.toContain('data-slot="filter-chip"');
    expect(html).not.toContain("hidden by filters");
  });

  it("names the chosen values in chips, says how many posts they hide, and offers Clear", async () => {
    const html = await render(
      "en",
      toolbar(
        { channelIds: ["c1"], queueIds: [], tagIds: ["t1", "t2"] },
        { channels: [channel], hidden: 3, tags: [launch, news] }
      )
    );

    expect(
      missingFrom(html, [
        "is any of",
        "Launch week, Newsletter",
        ">Clear<",
        "3 posts hidden by filters",
        "<output",
      ])
    ).toStrictEqual([]);
  });

  it("says so in French, and leaves out a kind with nothing to choose", async () => {
    const html = await render(
      "fr",
      toolbar(
        { channelIds: [], queueIds: [], tagIds: ["t1"] },
        { channels: [], hidden: 1, tags: [launch] }
      )
    );

    expect(
      missingFrom(html, [
        "Étiquette",
        ">Effacer<",
        "1 publication masquée par les filtres",
      ])
    ).toStrictEqual([]);

    expect(html).not.toContain("Canal");
  });
});
