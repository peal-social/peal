import { Option, Schema } from "effect";

import {
  browserStorage,
  dropWorkspaceKey,
  personKeyOf,
} from "#auth/person-storage.ts";
import type { KeptFor, PersonStorage } from "#auth/person-storage.ts";
import type { StudioEdit } from "#studio/edit-document.ts";

// The editor keeps the person's work in this browser, per person and
// workspace (`#auth/person-storage.ts`), so a reload, a visit to another
// page or signing out and back in loses nothing, and nobody else signed
// in on the same browser loads it. Library files are kept by name
// (`peal:media/<id>`), never by address, which lasts an hour.

/** Where the person's draft of a workspace is kept in `localStorage`. */
export const draftKeyOf = (owner: KeptFor): string =>
  personKeyOf("studio-draft", owner);

// What a draft's document must look like for the editor to read it: an
// output and tracks. The SDK checks the rest against Shotstack's schema
// when it loads it, and the editor starts afresh when it refuses.
const isDocument = Schema.is(
  Schema.Struct({
    output: Schema.Record(Schema.String, Schema.Unknown),
    timeline: Schema.Struct({
      tracks: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
    }),
  })
);

// The document kept whole, every field the check does not name included.
const StudioEditSchema = Schema.declare((input): input is StudioEdit =>
  isDocument(input)
);

const DraftSchema = Schema.fromJsonString(
  Schema.Struct({ edit: StudioEditSchema, version: Schema.Literal(1) })
);

const decodeDraft = Schema.decodeUnknownOption(DraftSchema);

/** The draft a stored text holds, or none when it is not one. */
export const draftOf = (stored: string | null): Option.Option<StudioEdit> =>
  stored === null
    ? Option.none()
    : decodeDraft(stored).pipe(Option.map(({ edit }) => edit));

/** The text a draft is stored as. */
export const storedDraftOf = (edit: StudioEdit): string =>
  JSON.stringify({ edit, version: 1 });

/**
 * The person's draft of the workspace in this browser, or none. A draft
 * an older page kept under the workspace alone is dropped, never read.
 */
export const readDraft = (
  owner: KeptFor,
  storage: Option.Option<PersonStorage> = browserStorage()
): Option.Option<StudioEdit> =>
  storage.pipe(
    Option.flatMap((kept) => {
      dropWorkspaceKey(kept, "studio-draft", owner.workspaceId);

      try {
        return draftOf(kept.getItem(draftKeyOf(owner)));
      } catch {
        return Option.none();
      }
    })
  );

/** Keeps the person's draft in this browser, when the browser lets it. */
export const writeDraft = (
  owner: KeptFor,
  edit: StudioEdit,
  storage: Option.Option<PersonStorage> = browserStorage()
): void => {
  for (const kept of Option.toArray(storage)) {
    try {
      kept.setItem(draftKeyOf(owner), storedDraftOf(edit));
    } catch {
      // A private window or a full storage keeps nothing: the editor works on.
    }
  }
};

/** Forgets the person's draft of the workspace in this browser. */
export const clearDraft = (
  owner: KeptFor,
  storage: Option.Option<PersonStorage> = browserStorage()
): void => {
  for (const kept of Option.toArray(storage)) {
    try {
      kept.removeItem(draftKeyOf(owner));
    } catch {
      // Nothing kept, nothing to forget.
    }
  }
};
