// Files of the workspace's media library attached to a message to the
// agent: read as the person may read them, kept on their message, and
// given to the model as data beside it, never their bytes.
import { assert, layer } from "@effect/vitest";
import { Effect, Option, Schema, Stream } from "effect";
import { CurrentMember } from "peal-contract";
import { AgentMessageRequestSchema } from "peal-contract/agent";
import sharp from "sharp";

import { AgentDesk } from "#agent/application/agent-desk.ts";
import type { RunAsked } from "#agent/application/agent-desk.ts";
import { MediaLibrary } from "#media/application/media-library.ts";
import { Ids } from "#shared/application/ids.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import {
  agentTest,
  DatabaseTest,
  FakeAgentModel,
  freshPerson,
  personIn,
  says,
} from "#test/agent/support.ts";
import type { Person } from "#test/agent/support.ts";

const asked: RunAsked = {
  origin: { headers: {}, remoteAddress: Option.none() },
  timeZone: "UTC",
};

const png = Effect.promise(
  async () =>
    new Uint8Array(
      await sharp({
        create: { background: "#3366ff", channels: 3, height: 32, width: 48 },
      })
        .png()
        .toBuffer()
    )
);

// An image of the person's workspace, stored and ready.
const readyImage = (person: Person) =>
  png.pipe(
    Effect.flatMap((bytes) =>
      MediaLibrary.use((library) => library.storeGenerated(person.actor, bytes))
    ),
    Effect.map(({ asset }) => asset.id)
  );

const send = (person: Person, chatId: string, mediaIds: readonly string[]) =>
  AgentDesk.use((desk) =>
    desk.send(person.actor, chatId, "Use this", mediaIds, asked)
  ).pipe(
    Effect.flatMap(Stream.runCollect),
    Effect.provideService(CurrentMember, person.member)
  );

const refusalOf = (
  person: Person,
  chatId: string,
  mediaIds: readonly string[]
) =>
  AgentDesk.use((desk) =>
    desk.send(person.actor, chatId, "Use this", mediaIds, asked)
  ).pipe(Effect.provideService(CurrentMember, person.member), Effect.flip);

// So many made-up media ids.
const madeUpIds = (count: number) =>
  Array.from({ length: count }, (_, index) => `media-${String(index)}`);

layer(DatabaseTest, { timeout: "60 seconds" })(
  "files attached to a message",
  (it) => {
    it.effect(
      "keeps them on the person's message and gives the model their ids as data",
      () =>
        Effect.gen(function* attaches() {
          const person = yield* freshPerson;

          const chat = yield* AgentDesk.use((desk) =>
            desk.createChat(person.actor)
          );

          const imageId = yield* readyImage(person);

          yield* FakeAgentModel.use((model) => model.script([says("Got it.")]));
          yield* send(person, chat.id, [imageId, imageId]);

          const kept = yield* AgentDesk.use((desk) =>
            desk.chat(person.actor, chat.id)
          );

          assert.deepStrictEqual(
            kept.messages.map(({ media, role }) => [role, media]),
            [
              ["user", [{ id: imageId, kind: "image", name: null }]],
              ["assistant", []],
            ]
          );

          // The person's words, then the files as JSON: never in the rules.
          const [prompt] = yield* FakeAgentModel.use((model) => model.prompts);
          const user = prompt?.content.find(({ role }) => role === "user");

          const texts =
            user?.role === "user"
              ? user.content.flatMap((part) =>
                  part.type === "text" ? [part.text] : []
                )
              : [];

          assert.deepStrictEqual(texts, [
            "Use this",
            JSON.stringify({
              attachments: [{ kind: "image", mediaId: imageId, name: null }],
            }),
          ]);

          const system = prompt?.content.find(({ role }) => role === "system");

          assert.notInclude(
            system?.role === "system" ? system.content : "",
            imageId
          );
        }).pipe(Effect.provide(agentTest({ files: true })))
    );

    it.effect(
      "refuses another workspace's file, and one not ready, before anything is kept",
      () =>
        Effect.gen(function* refuses() {
          const person = yield* freshPerson;

          const chat = yield* AgentDesk.use((desk) =>
            desk.createChat(person.actor)
          );

          // An image of another workspace's.
          const elsewhere = personIn(
            WorkspaceIdSchema.make(yield* Ids.use((ids) => ids.next)),
            person.userId
          );

          const theirs = yield* readyImage(elsewhere);

          assert.deepInclude(yield* refusalOf(person, chat.id, [theirs]), {
            _tag: "MediaRejected",
            mediaId: theirs,
            reason: "notFound",
          });

          // A file still waiting for its upload.
          const pending = yield* MediaLibrary.use((library) =>
            library.createUpload(person.actor, {
              altText: Option.none(),
              byteSize: 10,
              contentType: "image/png",
              fileName: Option.some("launch.png"),
            })
          );

          assert.deepInclude(
            yield* refusalOf(person, chat.id, [pending.asset.id]),
            {
              _tag: "MediaRejected",
              mediaId: pending.asset.id,
              reason: "notReady",
            }
          );

          // An id that is no asset at all.
          assert.deepInclude(yield* refusalOf(person, chat.id, ["nope"]), {
            _tag: "MediaRejected",
            reason: "notFound",
          });

          const kept = yield* AgentDesk.use((desk) =>
            desk.chat(person.actor, chat.id)
          );

          assert.lengthOf(kept.messages, 0);
          assert.lengthOf(
            yield* FakeAgentModel.use((model) => model.prompts),
            0
          );
        }).pipe(Effect.provide(agentTest({ files: true })))
    );

    it.effect("takes ten files at most", () =>
      Effect.sync(() => {
        const decode = Schema.decodeUnknownExit(AgentMessageRequestSchema);

        assert.isTrue(
          decode({ mediaIds: madeUpIds(10), text: "Hi" })._tag === "Success"
        );
        assert.isTrue(
          decode({ mediaIds: madeUpIds(11), text: "Hi" })._tag === "Failure"
        );
      })
    );
  }
);
