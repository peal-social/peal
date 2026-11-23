import { assert, layer } from "@effect/vitest";
import { Effect, Ref, Schema } from "effect";

import { filesLayer, signedIn } from "./signed-in.ts";
import { readyMediaId } from "./studio.ts";

const inStudio = ["--workspace", "studio"];

const Transcript = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({ descriptionSaved: Schema.Boolean, text: Schema.String })
  )
);

const Made = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({ id: Schema.String, kind: Schema.String })
  )
);

layer(filesLayer)("peal media voiceover and transcribe", (it) => {
  it.effect("makes a voice-over in the voice asked", () =>
    Effect.gen(function* voiceover() {
      const session = yield* signedIn();

      const printed = yield* session.printed([
        "media",
        "voiceover",
        "--text",
        "A synthetic welcome.",
        "--voice",
        "nova",
        ...inStudio,
      ]);

      assert.include(printed, "Made a voice-over");
      assert.include(printed, "marked as made by AI");

      const { changes } = yield* Ref.get(session.studio.state);

      assert.isTrue(
        changes.some((change) => change.startsWith("voiceover:nova:"))
      );

      const json = yield* session.printed([
        "media",
        "voiceover",
        "--text",
        "Another synthetic welcome.",
        "--json",
        ...inStudio,
      ]);

      assert.strictEqual(Made(json).kind, "audio");
    })
  );

  it.effect("says why no voice-over is made", () =>
    Effect.gen(function* unavailable() {
      const session = yield* signedIn();

      const refused = yield* session.refused([
        "media",
        "voiceover",
        "--text",
        "An unavailable synthetic text.",
        ...inStudio,
      ]);

      assert.include(refused, "peal assistant models set speech");
    })
  );

  it.effect("prints a file's transcript, and saves it when asked", () =>
    Effect.gen(function* transcribe() {
      const session = yield* signedIn();

      const printed = yield* session.printed([
        "media",
        "transcribe",
        readyMediaId,
        "--save-description",
        ...inStudio,
      ]);

      assert.include(printed, "A synthetic transcript.");
      assert.include(
        printed,
        `Saved as the description of media ${readyMediaId}`
      );

      const json = yield* session.printed([
        "media",
        "transcribe",
        readyMediaId,
        "--json",
        ...inStudio,
      ]);

      assert.deepStrictEqual(Transcript(json), {
        descriptionSaved: false,
        text: "A synthetic transcript.",
      });

      const { changes } = yield* Ref.get(session.studio.state);

      assert.include(changes, `transcribe:${readyMediaId}:true`);
    })
  );
});
