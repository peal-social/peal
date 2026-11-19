import { describe, expect, it } from "@effect/vitest";

import { makeAnswerConsent } from "#auth/answer-consent.ts";
import type { ConsentReply } from "#auth/answer-consent.ts";
import { makeChooseWorkspace } from "#auth/choose-workspace.ts";
import type { SetActiveAnswer } from "#auth/choose-workspace.ts";

const picked = "00000000-0000-7000-8000-0000000000a1";

const other = "00000000-0000-7000-8000-0000000000b2";

const redirect: ConsentReply = {
  data: { redirect: true, url: "http://127.0.0.1:4000/callback" },
  error: null,
};

// A stand-in for the server: one session, shared by every tab of the
// browser, whose active workspace setActive moves, and the workspace each
// consent bound its tokens to, read from the session as the server does.
const server = ({
  refuse = false,
  reply = redirect,
}: { readonly refuse?: boolean; readonly reply?: ConsentReply } = {}) => {
  const session = { active: picked };
  const bound: (string | null)[] = [];
  const calls: string[] = [];

  const setActive = async (organizationId: string) => {
    calls.push(`setActive ${organizationId}`);

    if (refuse) {
      return await Promise.resolve<SetActiveAnswer>({
        error: { code: "ORGANIZATION_NOT_FOUND", status: 400 },
      });
    }

    session.active = organizationId;

    return await Promise.resolve<SetActiveAnswer>({ error: null });
  };

  const answer = makeAnswerConsent({
    consent: async (sent) => {
      calls.push(`consent ${String(sent.accept)}`);
      bound.push(sent.accept ? session.active : null);

      return await Promise.resolve(reply);
    },
    setActive,
  });

  return { answer, bound, calls, session, setActive };
};

describe(makeAnswerConsent, () => {
  it("binds the tokens to the workspace shown, after another tab opened another", async () => {
    const { answer, bound, session, setActive } = server();

    // The consent page shows `picked`; another tab then opens `other`.
    await makeChooseWorkspace({ report: () => {}, setActive })(other);

    expect(session.active).toBe(other);

    await expect(answer({ accept: true }, picked)).resolves.toBeTruthy();
    expect(bound).toStrictEqual([picked]);
  });

  it("sets the workspace shown before it posts the consent", async () => {
    const { answer, calls } = server();

    await answer({ accept: true, scope: "openid workspace:read" }, picked);

    expect(calls).toStrictEqual([`setActive ${picked}`, "consent true"]);
  });

  it("does not allow when the workspace shown cannot be set", async () => {
    const { answer, bound } = server({ refuse: true });

    await expect(answer({ accept: true }, picked)).resolves.toBeFalsy();
    expect(bound).toStrictEqual([]);
  });

  it("does not allow when setting the workspace could not be sent", async () => {
    const answer = makeAnswerConsent({
      consent: async () => await Promise.resolve(redirect),
      setActive: async () =>
        await Promise.reject(new TypeError("Failed to fetch")),
    });

    await expect(answer({ accept: true }, picked)).resolves.toBeFalsy();
  });

  it("denies without touching the active workspace", async () => {
    const { answer, calls } = server();

    await expect(answer({ accept: false }, picked)).resolves.toBeTruthy();
    expect(calls).toStrictEqual(["consent false"]);
  });

  it("allows as the session stands while no workspace is shown", async () => {
    const { answer, calls } = server();

    await answer({ accept: true }, undefined);

    expect(calls).toStrictEqual(["consent true"]);
  });

  it("fails when Better Auth refuses the consent or answers no redirect", async () => {
    const refused = server({ reply: { data: null, error: { status: 400 } } });
    const odd = server({ reply: { data: { url: "x" }, error: null } });

    await expect(refused.answer({ accept: true }, picked)).resolves.toBeFalsy();
    await expect(odd.answer({ accept: true }, picked)).resolves.toBeFalsy();
  });
});
