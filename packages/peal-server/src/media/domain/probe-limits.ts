import { Duration } from "effect";

/**
 * How many probes of uploaded files run at once: two a workspace, so one
 * member's script calling `complete` again and again cannot have the
 * server read a dozen files together, and eight a server, each holding
 * up to an image (16 MiB) or a few mebibytes of a document in memory, or
 * an ffprobe for up to a minute. Past either, finishing an upload waits
 * for a slot (`probeSlotWait`), then is refused, to be asked again. Imports and the
 * assistant's images probe within their own slots (`importsAtOnce`).
 */
export const probesAtOnce = { perServer: 8, perWorkspace: 2 } as const;

/**
 * How long finishing an upload waits for a probe's slot before it is
 * refused: files dropped together finish one after the other, within the
 * proxy's two minutes with a probe's minute.
 */
export const probeSlotWait = Duration.seconds(20);

/** How often a waiting upload asks for a slot again. */
export const probeSlotPoll = Duration.millis(250);
