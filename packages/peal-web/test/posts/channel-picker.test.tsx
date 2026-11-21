import { describe, expect, it } from "@effect/vitest";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";

import { ChannelPicker } from "#components/posts/channel-picker.tsx";
import { loadMessages } from "#i18n/messages.ts";

const ignore = () => {
  // The picker is only rendered here.
};

const picker = async (connectHref: string | null) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale="en"
      messages={await loadMessages("en")}
      timeZone="UTC"
    >
      <ChannelPicker
        channels={[]}
        connectHref={connectHref}
        disabled={false}
        selected={[]}
        onChange={ignore}
      />
    </NextIntlClientProvider>
  );

describe(ChannelPicker, () => {
  it("leads a member who may connect to New channel when there is none", async () => {
    const html = await picker("/synthetic-workspace/channels/new");

    expect(html).toContain("No channel is connected to this workspace yet.");
    expect(html).toContain('href="/synthetic-workspace/channels/new"');
    expect(html).toContain("Connect a channel");
  });

  it("only says so to a member who may not connect", async () => {
    const html = await picker(null);

    expect(html).toContain("No channel is connected to this workspace yet.");
    expect(html).not.toContain("Connect a channel");
  });
});
