// The agent's skills: a person's own, or the workspace's, which every
// member who may use the agent there uses; changed by their author, and
// a workspace's by those who manage it too; picked in a message, or read
// by the agent when a request fits one; and kept with the workspace, or
// gone with the person, when they leave.
import { assert, layer } from "@effect/vitest";
import { Effect, Option, Stream } from "effect";
import { SqlClient } from "effect/sql";
import { CurrentMember } from "peal-contract";

import { AgentDesk } from "#agent/application/agent-desk.ts";
import type { RunAsked, SentMessage } from "#agent/application/agent-desk.ts";
import { AgentRecords } from "#agent/application/agent-records.ts";
import { AgentSkillDesk } from "#agent/application/agent-skill-desk.ts";
import type { NewSkill } from "#agent/application/agent-skill-desk.ts";
import type { SkillChange } from "#agent/domain/agent-skill.ts";
import { maxSkills } from "#agent/domain/agent-skill.ts";
import { Ids } from "#shared/application/ids.ts";
import { Actor } from "#shared/domain/access.ts";
import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import {
  agentTest,
  calls,
  DatabaseTest,
  FakeAgentModel,
  FakeTools,
  freshPerson,
  personIn,
  says,
} from "#test/agent/support.ts";
import type { Person } from "#test/agent/support.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

const asked: RunAsked = {
  origin: { headers: {}, remoteAddress: Option.none() },
  timeZone: "UTC",
};

const desk = AgentSkillDesk;

const create = (person: Person, skill: NewSkill) =>
  desk.use((skills) => skills.createSkill(person.actor, skill));

const update = (person: Person, skillId: string, change: SkillChange) =>
  desk.use((skills) => skills.updateSkill(person.actor, skillId, change));

const remove = (person: Person, skillId: string) =>
  desk.use((skills) => skills.deleteSkill(person.actor, skillId));

const listed = (person: Person) =>
  desk.use((skills) => skills.skills(person.actor));

const namesOf = (person: Person) =>
  listed(person).pipe(
    Effect.map((usable) =>
      usable.map(({ editable, skill }) => [skill.name, skill.scope, editable])
    )
  );

const personal = (name: string, instructions = "Do it well."): NewSkill => ({
  instructions,
  name,
  scope: "personal",
});

const shared = (name: string, instructions = "Do it well."): NewSkill => ({
  instructions,
  name,
  scope: "workspace",
});

// Someone else in the same workspace, an editor unless given a role.
const colleagueOf = (person: Person, role = "editor") =>
  Ids.use((ids) => ids.next).pipe(
    Effect.map((id) =>
      personIn(person.workspaceId, UserIdSchema.make(id), permissionsFor(role))
    )
  );

const sendAs = (person: Person, chatId: string, message: SentMessage) =>
  AgentDesk.use((agent) => agent.send(person.actor, chatId, message, asked));

const sent = (person: Person, chatId: string, message: SentMessage) =>
  sendAs(person, chatId, message).pipe(
    Effect.flatMap(Stream.runCollect),
    Effect.provideService(CurrentMember, person.member)
  );

// The texts of the person's last message the model read, in order.
const besideTexts = Effect.gen(function* besideTexts() {
  const prompts = yield* FakeAgentModel.use((model) => model.prompts);
  const user = prompts[0]?.content.findLast(({ role }) => role === "user");

  return user?.role === "user"
    ? user.content.flatMap((part) => (part.type === "text" ? [part.text] : []))
    : [];
});

const systemOf = (index: number) =>
  FakeAgentModel.use((model) => model.prompts).pipe(
    Effect.map((prompts) => {
      const system = prompts[index]?.content.find(
        ({ role }) => role === "system"
      );

      return system?.role === "system" ? system.content : "";
    })
  );

const skillRows = (person: Person) =>
  SqlClient.SqlClient.use(
    (sql) =>
      sql<{
        readonly author_id: string | null;
        readonly name: string;
      }>`SELECT author_id, name FROM agent.skills WHERE workspace_id = ${person.workspaceId} ORDER BY name`
  );

layer(DatabaseTest, { timeout: "60 seconds" })("the agent's skills", (it) => {
  it.effect(
    "lists the person's own and the workspace's by name, whatever its case, never another's own",
    () =>
      Effect.gen(function* lists() {
        const person = yield* freshPerson;
        const colleague = yield* colleagueOf(person);

        yield* create(person, personal("weekly plan"));
        yield* create(person, shared("Answer reviews"));
        yield* create(colleague, personal("Colleague's own"));
        yield* create(colleague, shared("Brand voice"));

        assert.deepStrictEqual(yield* namesOf(person), [
          ["Answer reviews", "workspace", true],
          ["Brand voice", "workspace", false],
          ["weekly plan", "personal", true],
        ]);

        // Another workspace's are none of theirs.
        const elsewhere = personIn(
          WorkspaceIdSchema.make(yield* Ids.use((ids) => ids.next)),
          person.userId
        );

        assert.lengthOf(yield* listed(elsewhere), 0);
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "answers only a person in their own session, with assistant:use",
    () =>
      Effect.gen(function* gate() {
        const person = yield* freshPerson;

        const byKey = new Actor({
          permissions: person.actor.permissions,
          subject: { _tag: "apiKey", apiKeyId: "key-1" },
          workspaceId: person.workspaceId,
        });

        const impersonated = new Actor({
          permissions: person.actor.permissions,
          subject: {
            _tag: "user",
            impersonatedBy: Option.some(
              UserIdSchema.make("6c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f")
            ),
            userId: person.userId,
          },
          workspaceId: person.workspaceId,
        });

        const viewer = personIn(
          person.workspaceId,
          person.userId,
          permissionsFor("viewer")
        );

        for (const actor of [byKey, impersonated]) {
          const refused = yield* desk
            .use((skills) => skills.createSkill(actor, personal("Plan")))
            .pipe(Effect.flip);

          assert.strictEqual(refused._tag, "PersonRequired");
        }

        const refused = yield* listed(viewer).pipe(Effect.flip);

        assert.strictEqual(refused._tag, "MissingPermission");
        assert.lengthOf(yield* skillRows(person), 0);
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "refuses a name another skill the person may use has, whatever its case",
    () =>
      Effect.gen(function* names() {
        const person = yield* freshPerson;
        const colleague = yield* colleagueOf(person);

        const mine = yield* create(person, personal("Weekly plan"));

        yield* create(colleague, shared("Brand voice"));

        // Their own, and the workspace's, are both taken.
        for (const skill of [shared("weekly PLAN"), personal("BRAND voice")]) {
          assert.deepInclude(yield* create(person, skill).pipe(Effect.flip), {
            _tag: "SkillRefused",
            reason: "nameTaken",
          });
        }

        assert.deepInclude(
          yield* update(person, mine.skill.id, { name: "brand Voice" }).pipe(
            Effect.flip
          ),
          { _tag: "SkillRefused", reason: "nameTaken" }
        );

        // Its own name, in another case, is its own; another's own name
        // is not the person's to collide with.
        const renamed = yield* update(person, mine.skill.id, {
          name: "WEEKLY plan",
        });

        assert.strictEqual(renamed.skill.name, "WEEKLY plan");

        const theirs = yield* create(colleague, personal("Weekly plan"));

        assert.strictEqual(theirs.skill.name, "Weekly plan");
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    `refuses a skill past the ${String(maxSkills)} the person sees`,
    () =>
      Effect.gen(function* many() {
        const person = yield* freshPerson;
        const colleague = yield* colleagueOf(person);

        // Half the workspace's, from a colleague, half their own.
        yield* Effect.forEach(
          Array.from({ length: maxSkills / 2 }, (_, index) => index),
          (index) =>
            create(colleague, shared(`Shared ${String(index)}`)).pipe(
              Effect.andThen(create(person, personal(`Own ${String(index)}`)))
            )
        );

        assert.deepInclude(
          yield* create(person, personal("One more")).pipe(Effect.flip),
          {
            _tag: "SkillRefused",
            reason: "tooMany",
          }
        );

        // The colleague sees fewer: their own personal ones are none.
        const more = yield* create(colleague, personal("One more"));

        assert.strictEqual(more.skill.name, "One more");
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "lets the author change and delete theirs, and the workspace's those who manage it",
    () =>
      Effect.gen(function* editable() {
        const person = yield* freshPerson;
        const colleague = yield* colleagueOf(person);
        const admin = yield* colleagueOf(person, "admin");

        const own = yield* create(person, personal("Mine"));
        const theirs = yield* create(person, shared("Ours"));

        // Another's own is none of theirs, whatever they may manage.
        assert.deepInclude(
          yield* update(admin, own.skill.id, { name: "Taken" }).pipe(
            Effect.flip
          ),
          { _tag: "SkillNotFound", skillId: own.skill.id }
        );

        // A workspace skill another member wrote is theirs to use only.
        for (const refused of [
          update(colleague, theirs.skill.id, { instructions: "Other." }),
          remove(colleague, theirs.skill.id),
        ]) {
          assert.deepInclude(yield* refused.pipe(Effect.flip), {
            _tag: "SkillRefused",
            reason: "notEditable",
          });
        }

        // One who manages the workspace's skills changes it.
        const changed = yield* update(admin, theirs.skill.id, {
          instructions: "Answer in our voice.",
        });

        assert.isTrue(changed.editable);
        assert.strictEqual(changed.skill.instructions, "Answer in our voice.");

        yield* remove(person, own.skill.id);

        assert.deepInclude(
          yield* remove(person, own.skill.id).pipe(Effect.flip),
          { _tag: "SkillNotFound" }
        );
        assert.deepInclude(
          yield* update(person, "not-an-id", { name: "x" }).pipe(Effect.flip),
          { _tag: "SkillNotFound", skillId: "not-an-id" }
        );
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "moves a person's own to the workspace, and back for its author only",
    () =>
      Effect.gen(function* moves() {
        const person = yield* freshPerson;
        const colleague = yield* colleagueOf(person);
        const admin = yield* colleagueOf(person, "admin");

        const own = yield* create(person, personal("Launch checklist"));

        const shared_ = yield* update(person, own.skill.id, {
          scope: "workspace",
        });

        assert.strictEqual(shared_.skill.scope, "workspace");
        assert.deepStrictEqual(yield* namesOf(colleague), [
          ["Launch checklist", "workspace", false],
        ]);

        // Only its author takes it back, whoever may manage it.
        assert.deepInclude(
          yield* update(admin, own.skill.id, { scope: "personal" }).pipe(
            Effect.flip
          ),
          { _tag: "SkillRefused", reason: "notEditable" }
        );

        const back = yield* update(person, own.skill.id, {
          scope: "personal",
        });

        assert.strictEqual(back.skill.scope, "personal");
        assert.lengthOf(yield* listed(colleague), 0);
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "keeps a workspace skill with the workspace when its author leaves, and their own goes with them",
    () =>
      Effect.gen(function* leaves() {
        const person = yield* freshPerson;
        const colleague = yield* colleagueOf(person);
        const admin = yield* colleagueOf(person, "admin");

        yield* create(person, personal("Mine"));

        const ours = yield* create(person, shared("Ours"));

        const exported = yield* AgentRecords.use((records) =>
          records.exportSkills(person.userId)
        );

        assert.deepStrictEqual(
          exported.map(({ name, scope }) => [name, scope]),
          [
            ["Mine", "personal"],
            ["Ours", "workspace"],
          ]
        );

        yield* AgentRecords.use((records) =>
          records.eraseMember(person.workspaceId, person.userId)
        );

        assert.deepStrictEqual(
          (yield* skillRows(person)).map(({ author_id, name }) => [
            name,
            author_id,
          ]),
          [["Ours", null]]
        );

        // Nobody's now: those who manage the workspace's change it.
        assert.deepStrictEqual(yield* namesOf(colleague), [
          ["Ours", "workspace", false],
        ]);
        assert.isTrue(
          (yield* update(admin, ours.skill.id, { name: "Ours still" })).editable
        );

        // A closed account's go the same way; the workspace's, with it.
        yield* create(colleague, personal("Theirs"));
        yield* create(colleague, shared("Team's"));
        yield* AgentRecords.use((records) =>
          records.eraseUser(colleague.userId)
        );

        assert.deepStrictEqual(
          (yield* skillRows(person)).map(({ author_id, name }) => [
            name,
            author_id,
          ]),
          [
            ["Ours still", null],
            ["Team's", null],
          ]
        );

        yield* AgentRecords.use((records) =>
          records.eraseWorkspace(person.workspaceId)
        );

        assert.lengthOf(yield* skillRows(person), 0);
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "gives the model a picked skill's instructions beside the message, the others by name, and keeps how it was named",
    () =>
      Effect.gen(function* picked() {
        const person = yield* freshPerson;
        const colleague = yield* colleagueOf(person);

        const plan = yield* create(
          person,
          personal("Weekly plan", "List next week's drafts by day.")
        );

        const voice = yield* create(
          colleague,
          shared("Brand voice", "Write warmly, never with emoji.")
        );

        const chat = yield* AgentDesk.use((agent) =>
          agent.createChat(person.actor)
        );

        yield* FakeAgentModel.use((model) => model.script([says("Planned.")]));
        yield* sent(person, chat.id, {
          skillIds: [plan.skill.id, plan.skill.id],
          text: "Plan it",
        });

        assert.deepStrictEqual(yield* besideTexts, [
          "Plan it",
          JSON.stringify({
            skills: [
              {
                instructions: "List next week's drafts by day.",
                name: "Weekly plan",
                skillId: plan.skill.id,
              },
            ],
          }),
          JSON.stringify({
            otherSkills: [{ name: "Brand voice", skillId: voice.skill.id }],
          }),
        ]);

        // Never in the rules.
        assert.notInclude(yield* systemOf(0), "next week's drafts");

        // Renamed later, the message still says how it was named.
        yield* update(person, plan.skill.id, { name: "Week ahead" });

        const kept = yield* AgentDesk.use((agent) =>
          agent.chat(person.actor, chat.id)
        );

        assert.deepStrictEqual(
          kept.messages.map(({ role, skills }) => [role, skills]),
          [
            ["user", [{ id: plan.skill.id, name: "Weekly plan" }]],
            ["assistant", []],
          ]
        );
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect("tells the model of no skill when the person may use none", () =>
    Effect.gen(function* none() {
      const person = yield* freshPerson;

      const chat = yield* AgentDesk.use((agent) =>
        agent.createChat(person.actor)
      );

      yield* FakeAgentModel.use((model) => model.script([says("Hi.")]));
      yield* sent(person, chat.id, { text: "Hello" });

      assert.deepStrictEqual(yield* besideTexts, ["Hello"]);
    }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "refuses a message picking a skill the person may not use, before anything is kept",
    () =>
      Effect.gen(function* refuses() {
        const person = yield* freshPerson;
        const colleague = yield* colleagueOf(person);

        const theirs = yield* create(colleague, personal("Their own"));

        const chat = yield* AgentDesk.use((agent) =>
          agent.createChat(person.actor)
        );

        for (const skillId of [theirs.skill.id, "nope"]) {
          const refused = yield* sendAs(person, chat.id, {
            skillIds: [skillId],
            text: "Use it",
          }).pipe(
            Effect.provideService(CurrentMember, person.member),
            Effect.flip
          );

          assert.deepInclude(refused, { _tag: "SkillNotFound", skillId });
        }

        const kept = yield* AgentDesk.use((agent) =>
          agent.chat(person.actor, chat.id)
        );

        assert.lengthOf(kept.messages, 0);
        assert.lengthOf(yield* FakeAgentModel.use((model) => model.prompts), 0);
      }).pipe(Effect.provide(agentTest()))
  );

  it.effect(
    "reads a skill the person may use when the model asks, as a step that changes nothing, and refuses another's",
    () =>
      Effect.gen(function* reads() {
        const person = yield* freshPerson;
        const colleague = yield* colleagueOf(person);

        const voice = yield* create(
          colleague,
          shared("Brand voice", "Write warmly, never with emoji.")
        );

        const theirs = yield* create(
          colleague,
          personal("Their own", "synthetic-private-instructions-3b9d")
        );

        const chat = yield* AgentDesk.use((agent) =>
          agent.createChat(person.actor)
        );

        yield* FakeAgentModel.use((model) =>
          model.script([
            calls("read_skill", { skillId: voice.skill.id }, "call-voice"),
            calls("read_skill", { skillId: theirs.skill.id }, "call-theirs"),
            says("Written warmly."),
          ])
        );

        const events = yield* sent(person, chat.id, {
          text: "Answer this review",
        });

        assert.deepStrictEqual(
          events.flatMap((event) =>
            event._tag === "step" ? [[event.step.tool, event.step.state]] : []
          ),
          [
            ["read_skill", "running"],
            ["read_skill", "done"],
            ["read_skill", "running"],
            ["read_skill", "refused"],
          ]
        );

        const prompts = yield* FakeAgentModel.use((model) => model.prompts);

        const results = (prompts[2]?.content ?? []).flatMap((message) =>
          message.role === "tool"
            ? message.content.flatMap((part) =>
                part.type === "tool-result" ? [part] : []
              )
            : []
        );

        assert.deepStrictEqual(
          results.map(({ id, isFailure }) => [id, isFailure]),
          [
            ["call-voice", false],
            ["call-theirs", true],
          ]
        );
        assert.include(
          JSON.stringify(results[0]?.result),
          "Write warmly, never with emoji."
        );
        assert.notInclude(
          JSON.stringify(prompts),
          "synthetic-private-instructions-3b9d"
        );

        // Reading is no change: nothing is recorded.
        assert.lengthOf(yield* FakeTools.use((tools) => tools.records), 0);
      }).pipe(Effect.provide(agentTest()))
  );
});
