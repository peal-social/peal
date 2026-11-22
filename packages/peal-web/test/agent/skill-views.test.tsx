import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import {
  NextIntlClientProvider,
  createFormatter,
  createTranslator,
} from "next-intl";
import type { Locale } from "next-intl";
import type { AgentMessage, AgentSkill } from "peal-contract/agent";
import { AgentSkillNotFound } from "peal-contract/agent";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { emptyChat } from "#agent/run-state.ts";
import { draftOf, emptySkillDraft } from "#agent/skill-draft.ts";
import {
  ComposerView,
  TranscriptView,
  refusalMessage,
  stepLine,
} from "#components/agent/chat-views.tsx";
import { SkillChipsView } from "#components/agent/skill-picker-views.tsx";
import {
  SkillFormView,
  SkillListView,
} from "#components/agent/skill-views.tsx";
import type { LinkComponent } from "#components/shell/sidebar-view.tsx";
import { loadMessages } from "#i18n/messages.ts";

const PlainLink: LinkComponent = ({ children, ...props }) => (
  <a data-app-link="" {...props}>
    {children}
  </a>
);

const render = async (node: ReactNode, locale: Locale = "en") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="Europe/Paris"
    >
      {node}
    </NextIntlClientProvider>
  );

const nothing = () => {
  // Not pressed in a render.
};

const at = DateTime.makeUnsafe("2026-11-22T08:51:00Z");

const skill = (fields: Partial<AgentSkill>): AgentSkill => ({
  createdAt: at,
  editable: true,
  id: "skill-1",
  instructions: "Look at next week, then write a draft for each empty day.",
  name: "Plan next week",
  scope: "personal",
  updatedAt: at,
  ...fields,
});

const shared = skill({
  id: "skill-2",
  name: "Answer a review",
  scope: "workspace",
});

const translator = async (locale: Locale) =>
  createTranslator({
    locale,
    messages: await loadMessages(locale),
    namespace: "Agent",
  });

describe(SkillChipsView, () => {
  it("shows each picked skill with a way to take it off", async () => {
    const html = await render(
      <SkillChipsView
        skills={[{ id: "skill-1", name: "Plan next week" }]}
        onRemove={nothing}
      />
    );

    expect([
      html.includes('aria-label="Picked skills"'),
      html.includes("Plan next week"),
      html.includes('aria-label="Remove the skill Plan next week"'),
    ]).toStrictEqual([true, true, true]);
  });

  it("draws nothing without a skill", async () => {
    await expect(
      render(<SkillChipsView skills={[]} onRemove={nothing} />)
    ).resolves.toBe("");
  });
});

// The send button's tag, as rendered.
const sendButton = (html: string): string =>
  /<button[^>]*aria-label="Send"[^>]*>/u.exec(html)?.[0] ?? "";

// The composer, with skills picked or not.
const composer = async (fields: {
  readonly picked: boolean;
  readonly value: string;
}) =>
  await render(
    <ComposerView
      disabled={false}
      label="Message to Peal"
      placeholder="Ask Peal…"
      running={false}
      onChange={nothing}
      onSend={nothing}
      onStop={nothing}
      {...fields}
    />
  );

describe(ComposerView, () => {
  it("sends a message with skills picked and no text of its own", async () => {
    const empty = await composer({ picked: false, value: "" });
    const picked = await composer({ picked: true, value: "" });

    expect([
      sendButton(empty).includes('disabled=""'),
      sendButton(picked).includes('disabled=""'),
    ]).toStrictEqual([true, false]);
  });
});

describe(TranscriptView, () => {
  it("shows the skills the person's message picked beside it", async () => {
    const asked: AgentMessage = {
      approvals: [],
      cards: [],
      createdAt: at,
      durationMs: null,
      id: "m1",
      media: [],
      outcome: null,
      rating: null,
      role: "user",
      skills: [{ id: "skill-1", name: "Plan next week" }],
      steps: [],
      text: "Plan next week",
    };

    const html = await render(
      <TranscriptView
        actions={{ onCopy: nothing, onRate: nothing }}
        links={{
          link: PlainLink,
          post: (postId) => `/synthetic-studio/posts/${postId}`,
          thread: (threadId) => `/synthetic-studio/inbox/${threadId}`,
        }}
        nameOf={() => null}
        now={null}
        state={{ ...emptyChat, loaded: true, messages: [asked] }}
        onAnswer={nothing}
      />
    );

    expect(html).toContain('aria-label="Picked skills"');
  });
});

describe(stepLine, () => {
  it.each([
    ["en", "Reading a skill…", "Read a skill"],
    ["fr", "Lecture d’une compétence…", "Compétence lue"],
  ] as const)("names reading a skill (%s)", async (locale, running, done) => {
    const t = await translator(locale);
    const step = { at: 0, callId: "c1", tool: "read_skill" } as const;

    expect([
      stepLine(t, { ...step, state: "running" }),
      stepLine(t, { ...step, state: "done" }),
    ]).toStrictEqual([running, done]);
  });
});

describe(refusalMessage, () => {
  it("says a picked skill is gone, never the server's English", async () => {
    const t = await translator("en");

    expect(
      refusalMessage(
        t,
        createFormatter({ locale: "en", timeZone: "Europe/Paris" }),
        new AgentSkillNotFound({ message: "Server words", skillId: "s1" })
      )
    ).toBe(
      "A skill you picked was deleted or is no longer shared. Take it off and send again."
    );
  });
});

describe(SkillListView, () => {
  it("lists each skill with whose it is and when it changed, opening its page", async () => {
    const html = await render(
      <SkillListView
        hrefOf={(id) => `/synthetic-studio/settings/agent/skills/${id}`}
        link={PlainLink}
        newSkill={null}
        skills={[skill({}), shared]}
      />
    );

    expect([
      html.includes('href="/synthetic-studio/settings/agent/skills/skill-1"'),
      html.includes("Personal"),
      html.includes("Workspace"),
      html.includes("Updated Nov 22, 2026"),
    ]).toStrictEqual([true, true, true, true]);
  });

  it("says what a skill is when there is none, with the way to make one", async () => {
    const html = await render(
      <SkillListView
        hrefOf={(id) => id}
        link={PlainLink}
        newSkill={<PlainLink href="/new">New skill</PlainLink>}
        skills={[]}
      />,
      "fr"
    );

    expect([
      html.includes("Aucune compétence pour l’instant"),
      html.includes('href="/new"'),
    ]).toStrictEqual([true, true]);
  });
});

describe(SkillFormView, () => {
  it("says what is wrong once the person tried to save, and the refusal in words", async () => {
    const html = await render(
      <SkillFormView
        busy={false}
        cancel={null}
        draft={emptySkillDraft}
        editable
        problem="nameTaken"
        tried
        onChange={nothing}
        onSave={nothing}
      />
    );

    expect([
      html.includes("Give the skill a name."),
      html.includes("Write what Peal should do."),
      html.includes("You can already use a skill with this name."),
      html.includes("Only you can use it."),
      html.includes("Every member who may use the agent"),
      html.includes(">Save<"),
    ]).toStrictEqual([true, true, true, true, true, true]);
  });

  it("shows a skill the person may not change read-only, saying why, with no Save", async () => {
    const html = await render(
      <SkillFormView
        busy={false}
        cancel={null}
        draft={draftOf(shared)}
        editable={false}
        problem={null}
        tried={false}
        onChange={nothing}
        onSave={nothing}
      />
    );

    expect([
      html.includes("manages the assistant&#x27;s settings"),
      html.includes(">Save<"),
      html.includes('disabled=""'),
    ]).toStrictEqual([true, false, true]);
  });
});
