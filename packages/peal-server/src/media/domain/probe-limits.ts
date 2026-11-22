/**
 * How many probes of uploaded files run at once: two a workspace, so one
 * member's script calling `complete` again and again cannot have the
 * server read a dozen files together, and eight a server, each holding
 * up to an image (16 MiB) or a few mebibytes of a document in memory, or
 * an ffprobe for up to a minute. Past either, finishing an upload is
 * refused at once, to be asked again in a moment. Imports and the
 * assistant's images probe within their own slots (`importsAtOnce`).
 */
export const probesAtOnce = { perServer: 8, perWorkspace: 2 } as const;
