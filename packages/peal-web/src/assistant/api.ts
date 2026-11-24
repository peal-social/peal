import { Effect } from "effect";
import { Atom } from "effect/reactivity";
import { forWorkspace } from "peal-contract";

import { PealApi } from "#api/client.ts";

// The writing assistant's status and suggestions. A request can change the
// count of requests left however it ends, so the composer refreshes the
// status after each one.

/**
 * Whether the assistant writes for the workspace, who writes, and the
 * workspace's requests left today.
 */
export const assistantStatus = (workspaceId: string) =>
  PealApi.query("assistant", "status", {
    headers: forWorkspace(workspaceId),
    // The workspace's own providers change who writes and who makes images.
    reactivityKeys: [`ai-providers:${workspaceId}`],
  });

export const suggestChange = PealApi.mutation("assistant", "suggest");

/**
 * Makes an image into the workspace's media library; send it with the
 * media list's reactivity key, so the library shows the new image.
 */
export const generateImage = PealApi.mutation("assistant", "generateImage");

/** What lists a workspace's videos on their way, which asking for one refreshes. */
export const videosKey = (workspaceId: string): string =>
  `video-generations:${workspaceId}`;

/** The videos the workspace asked for, newest first, with where each stands. */
export const videoGenerations = Atom.family((workspaceId: string) =>
  PealApi.query("videoGenerations", "list", {
    headers: forWorkspace(workspaceId),
    query: {},
    reactivityKeys: [videosKey(workspaceId)],
  })
);

/**
 * Asks for a video, which the server makes in a durable job; send it with
 * the videos' reactivity key and the status's, so the library shows it on
 * its way and the count left changes.
 */
export const generateVideo = PealApi.mutation("videoGenerations", "create");

/** Reads where one video stands, with its file once made. */
export const readVideo = PealApi.runtime.fn<{
  readonly generationId: string;
  readonly workspaceId: string;
}>()(({ generationId, workspaceId }) =>
  Effect.gen(function* read() {
    const client = yield* PealApi;

    const job = yield* client.videoGenerations.get({
      headers: forWorkspace(workspaceId),
      params: { generationId },
    });

    const media =
      job.mediaId === null
        ? null
        : yield* client.media.get({
            headers: forWorkspace(workspaceId),
            params: { mediaId: job.mediaId },
          });

    return { job, media };
  })
);

/** What lists a workspace's slide videos, which asking for one refreshes. */
export const slideshowsKey = (workspaceId: string): string =>
  `slideshows:${workspaceId}`;

/** The slide videos the workspace asked for, newest first, with where each stands. */
export const slideshows = Atom.family((workspaceId: string) =>
  PealApi.query("slideshows", "list", {
    headers: forWorkspace(workspaceId),
    query: {},
    reactivityKeys: [slideshowsKey(workspaceId)],
  })
);

/**
 * Asks for a slide video, which the workspace's Shotstack account composes
 * in a durable job; send it with the slide videos' reactivity key.
 */
export const createSlideshow = PealApi.mutation("slideshows", "create");

/**
 * Renders the editor's document through the same job as a slide video;
 * send it with the slide videos' reactivity key.
 */
export const renderEdit = PealApi.mutation("slideshows", "createFromEdit");

/**
 * Makes a voice-over into the workspace's media library; send it with the
 * media list's reactivity key, so the library shows it.
 */
export const createVoiceover = PealApi.mutation(
  "mediaAudio",
  "createVoiceover"
);

/**
 * Transcribes a file of the library; send it with the media list's
 * reactivity key when the transcript is saved as its description.
 */
export const transcribeMedia = PealApi.mutation("mediaAudio", "transcribe");
