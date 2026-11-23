import { Option, Schema } from "effect";

import type { StudioEdit } from "#studio/edit-document.ts";

// The editor keeps the person's work in this browser, per workspace, so a
// reload or a visit to another page loses nothing. Library files are kept
// by name (`peal:media/<id>`), never by address, which lasts an hour.

/** Where a workspace's draft is kept in `localStorage`. */
export const draftKeyOf = (workspaceId: string): string =>
  `peal.studio-draft.${workspaceId}`;

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

/** The workspace's draft in this browser, or none. */
export const readDraft = (workspaceId: string): Option.Option<StudioEdit> => {
  try {
    return draftOf(localStorage.getItem(draftKeyOf(workspaceId)));
  } catch {
    return Option.none();
  }
};

/** Keeps the draft in this browser, when the browser lets it. */
export const writeDraft = (workspaceId: string, edit: StudioEdit): void => {
  try {
    localStorage.setItem(draftKeyOf(workspaceId), storedDraftOf(edit));
  } catch {
    // A private window or a full storage keeps nothing: the editor works on.
  }
};

/** Forgets the workspace's draft in this browser. */
export const clearDraft = (workspaceId: string): void => {
  try {
    localStorage.removeItem(draftKeyOf(workspaceId));
  } catch {
    // Nothing kept, nothing to forget.
  }
};
