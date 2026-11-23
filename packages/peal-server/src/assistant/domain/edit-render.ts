import { Option, Result, Schema } from "effect";

import type { ImageAspect } from "./image-aspect.ts";
import {
  maxEditClips,
  maxEditSeconds,
  maxEditTracks,
} from "./slideshow-limits.ts";
import { SlideshowRejected } from "./slideshow-rejected.ts";

/**
 * The rules a whole Shotstack Edit is held to before Peal sends it, once
 * `EditChecker` found it one Shotstack's schema accepts: which files it
 * names, the output Peal renders, its size and its length. Pure: the
 * library's answers are the use case's.
 *
 * Where an Edit names a file, as `@shotstack/schemas` 1.27.0 defines it:
 *
 * - `timeline.tracks[].clips[].asset.src` of the assets that fetch one:
 *   `video`, `image`, `audio`, `luma`, `caption`, `rich-caption` and
 *   `image-to-video` (an `svg` asset's `src` is its markup, not a file;
 *   `text`, `rich-text`, `title`, `html`, `html5`, `shape`,
 *   `text-to-image` and `text-to-speech` name none);
 * - `timeline.tracks[].clips[].asset.options` of `image`, `video` and
 *   `audio`, the generation options, which may name a first frame
 *   (`startSrc`, `inputSrc`): every text in them is read;
 * - `timeline.soundtrack.src`;
 * - `timeline.fonts[].src`.
 *
 * Nothing else names a file: `output.destinations` is replaced when it is
 * sent, `merge` (whose placeholders could name any address anywhere) is
 * refused, and so are `output.poster` and `output.thumbnail`.
 */

/** How an edit names a file of the workspace's library. */
export const mediaReferencePrefix = "peal:media/";

/** The one address a font may come from: Google's font files. */
export const googleFontsPrefix = "https://fonts.gstatic.com/";

/** A media library file's kind, as a slide video reads it. */
export type EditMediaKind = "audio" | "document" | "image" | "video";

/** A file of the library an edit names, and the kinds its place takes. */
export interface EditFile {
  /** What follows `peal:media/`, unchecked. */
  readonly mediaId: string;
  readonly kinds: ReadonlySet<string>;
}

/** Where in an edit a file is named. */
export type SourcePlace =
  | { readonly _tag: "asset"; readonly assetType: string }
  | { readonly _tag: "font" }
  | { readonly _tag: "option" }
  | { readonly _tag: "soundtrack" };

const decodeObject = Schema.decodeUnknownOption(Schema.JsonObject);

const decodeArray = Schema.decodeUnknownOption(Schema.Array(Schema.Json));

const decodeString = Schema.decodeUnknownOption(Schema.String);

const decodeNumber = Schema.decodeUnknownOption(Schema.Finite);

const objectAt = (
  value: Schema.JsonObject,
  key: string
): Schema.JsonObject | undefined =>
  Option.getOrUndefined(decodeObject(value[key]));

const arrayAt = (
  value: Schema.JsonObject,
  key: string
): readonly Schema.Json[] | undefined =>
  Option.getOrUndefined(decodeArray(value[key]));

const stringAt = (value: Schema.JsonObject, key: string): string | undefined =>
  Option.getOrUndefined(decodeString(value[key]));

/** The value as a JSON object, when it is one. */
export const jsonObjectOf = (
  value: Schema.Json | undefined
): Schema.JsonObject | undefined => Option.getOrUndefined(decodeObject(value));

const kinds = (...each: readonly EditMediaKind[]): ReadonlySet<EditMediaKind> =>
  new Set(each);

// The assets whose `src` is a file, and the kinds of the library each
// takes: captions are transcribed from a voice or a video.
const fileAssets: ReadonlyMap<string, ReadonlySet<EditMediaKind>> = new Map([
  ["audio", kinds("audio")],
  ["caption", kinds("audio", "video")],
  ["image", kinds("image")],
  ["image-to-video", kinds("image")],
  ["luma", kinds("image", "video")],
  ["rich-caption", kinds("audio", "video")],
  ["video", kinds("video")],
]);

// The assets Shotstack may generate, whose options may name a frame.
const generatedAssets: ReadonlySet<string> = new Set([
  "audio",
  "image",
  "video",
]);

// The assets whose `src` may name another clip of the timeline instead.
const aliasedAssets: ReadonlySet<string> = new Set(["caption", "rich-caption"]);

const aliasPattern = /^alias:\/\/[A-Za-z0-9_-]+$/u;

// Any text that reads as an address: a scheme, or a host without one.
const addressPattern = /^[A-Za-z][A-Za-z0-9+.-]*:|^\/\//u;

type SourceMap = (src: string, place: SourcePlace) => string;

const mapStrings = (
  value: Schema.Json,
  map: (text: string) => string
): Schema.Json => {
  const text = decodeString(value);

  if (Option.isSome(text)) {
    return map(text.value);
  }

  const array = decodeArray(value);

  if (Option.isSome(array)) {
    return array.value.map((each): Schema.Json => mapStrings(each, map));
  }

  const object = decodeObject(value);

  return Option.isSome(object)
    ? Object.fromEntries(
        Object.entries(object.value).map(([key, each]) => [
          key,
          mapStrings(each, map),
        ])
      )
    : value;
};

/**
 * The object with each value given set, the others kept: what an edit's
 * object becomes when Peal changes some of its keys.
 */
export const withValues = (
  object: Schema.JsonObject,
  values: Readonly<Record<string, Schema.Json | undefined>>
): Schema.JsonObject =>
  Object.fromEntries([
    ...Object.entries(object),
    ...Object.entries(values).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, value] as const]
    ),
  ]);

const mapAsset = (
  asset: Schema.JsonObject,
  map: SourceMap
): Schema.JsonObject => {
  const assetType = stringAt(asset, "type") ?? "";
  const src = stringAt(asset, "src");
  const { options } = asset;

  // Its source first, then its options: the order files are listed in.
  const mappedSrc =
    src !== undefined && fileAssets.has(assetType)
      ? map(src, { _tag: "asset", assetType })
      : undefined;

  const mappedOptions =
    options !== undefined && generatedAssets.has(assetType)
      ? mapStrings(options, (text) => map(text, { _tag: "option" }))
      : undefined;

  return withValues(asset, { options: mappedOptions, src: mappedSrc });
};

const mapClip = (clip: Schema.Json, map: SourceMap): Schema.Json => {
  const object = jsonObjectOf(clip);
  const asset = object === undefined ? undefined : objectAt(object, "asset");

  return object === undefined || asset === undefined
    ? clip
    : withValues(object, { asset: mapAsset(asset, map) });
};

const mapTrack = (track: Schema.Json, map: SourceMap): Schema.Json => {
  const object = jsonObjectOf(track);
  const clips = object === undefined ? undefined : arrayAt(object, "clips");

  return object === undefined || clips === undefined
    ? track
    : withValues(object, { clips: clips.map((clip) => mapClip(clip, map)) });
};

const mapSrc = (
  value: Schema.Json,
  map: (src: string) => string
): Schema.Json => {
  const object = jsonObjectOf(value);
  const src = object === undefined ? undefined : stringAt(object, "src");

  return object === undefined || src === undefined
    ? value
    : withValues(object, { src: map(src) });
};

/**
 * The edit with every file it names passed through `map`, in order: the
 * tracks' clips, then the soundtrack, then the fonts. Everything else is
 * kept as it is.
 */
export const mapEditSources = (
  edit: Schema.JsonObject,
  map: SourceMap
): Schema.JsonObject => {
  const timeline = objectAt(edit, "timeline");

  if (timeline === undefined) {
    return edit;
  }

  const tracks = arrayAt(timeline, "tracks");
  const { soundtrack } = timeline;
  const fonts = arrayAt(timeline, "fonts");

  // In the order files are listed in: the tracks, the soundtrack, the
  // fonts.
  const mappedTracks = tracks?.map((track) => mapTrack(track, map));

  const mappedSoundtrack =
    soundtrack === undefined
      ? undefined
      : mapSrc(soundtrack, (src) => map(src, { _tag: "soundtrack" }));

  const mappedFonts = fonts?.map((font) =>
    mapSrc(font, (src) => map(src, { _tag: "font" }))
  );

  return withValues(edit, {
    timeline: withValues(timeline, {
      fonts: mappedFonts,
      soundtrack: mappedSoundtrack,
      tracks: mappedTracks,
    }),
  });
};

const refused = (reason: SlideshowRejected["reason"]) =>
  Result.fail(new SlideshowRejected({ reason }));

/**
 * What a text at a place of an edit is: a file of the library (`file`),
 * nothing Peal checks (`none`: another clip's alias, a Google font, a word
 * of a generation's options), or refused: any other address is
 * `editInvalid`, and a library file where none is taken (a font)
 * `mediaNotSupported`.
 */
const sourceOf = (
  src: string,
  place: SourcePlace
): Result.Result<EditFile | null, SlideshowRejected> => {
  const named = src.startsWith(mediaReferencePrefix)
    ? src.slice(mediaReferencePrefix.length)
    : null;

  if (place._tag === "font") {
    if (named !== null) {
      return refused("mediaNotSupported");
    }

    return src.startsWith(googleFontsPrefix)
      ? Result.succeed(null)
      : refused("editInvalid");
  }

  if (place._tag === "option") {
    if (named !== null) {
      return Result.succeed({ kinds: kinds("image", "video"), mediaId: named });
    }

    return addressPattern.test(src.trim())
      ? refused("editInvalid")
      : Result.succeed(null);
  }

  if (place._tag === "soundtrack") {
    return named === null
      ? refused("editInvalid")
      : Result.succeed({ kinds: kinds("audio"), mediaId: named });
  }

  if (named !== null) {
    return Result.succeed({
      kinds: fileAssets.get(place.assetType) ?? kinds(),
      mediaId: named,
    });
  }

  return aliasedAssets.has(place.assetType) && aliasPattern.test(src)
    ? Result.succeed(null)
    : refused("editInvalid");
};

/**
 * Every file of the library an edit names, in order, each with the kinds
 * its place takes (a file named twice is listed twice); refused when the
 * edit names any other address (`editInvalid`), merges fields
 * (`editInvalid`) or names a library file as a font
 * (`mediaNotSupported`). The first refusal decides.
 */
export const editFilesOf = (
  edit: Schema.JsonObject
): Result.Result<readonly EditFile[], SlideshowRejected> => {
  if ((arrayAt(edit, "merge")?.length ?? 0) > 0) {
    return refused("editInvalid");
  }

  const files: EditFile[] = [];
  let refusal: SlideshowRejected | null = null;

  mapEditSources(edit, (src, place) => {
    if (refusal === null) {
      Result.match(sourceOf(src, place), {
        onFailure: (failure) => {
          refusal = failure;
        },
        onSuccess: (file) => {
          if (file !== null) {
            files.push(file);
          }
        },
      });
    }

    return src;
  });

  return refusal === null ? Result.succeed(files) : Result.fail(refusal);
};

/**
 * The library files an edit names, once each, in order: what a job links
 * when it sends a checked edit.
 */
export const editMediaIdsOf = (edit: Schema.JsonObject): readonly string[] => {
  const ids = new Set<string>();

  mapEditSources(edit, (src) => {
    if (src.startsWith(mediaReferencePrefix)) {
      ids.add(src.slice(mediaReferencePrefix.length));
    }

    return src;
  });

  return [...ids];
};

/**
 * The edit with each library file it names swapped for its link, as the
 * service fetches it; a file without a link is left as it is named.
 */
export const editWithLinks = (
  edit: Schema.JsonObject,
  links: ReadonlyMap<string, string>
): Schema.JsonObject =>
  mapEditSources(edit, (src) =>
    src.startsWith(mediaReferencePrefix)
      ? (links.get(src.slice(mediaReferencePrefix.length)) ?? src)
      : src
  );

/**
 * The edit with the output Peal renders where it says none: MP4, at
 * 1080p, 16:9. Applied before Shotstack's schema reads it, which wants a
 * format and a resolution.
 */
export const withOutputDefaults = (
  edit: Schema.JsonObject
): Schema.JsonObject => {
  const given =
    edit["output"] === undefined ? {} : jsonObjectOf(edit["output"]);

  if (given === undefined) {
    return edit;
  }

  return withValues(edit, {
    output: withValues(
      withValues(
        { aspectRatio: "16:9", format: "mp4" },
        // A size stands for a resolution.
        { resolution: given["size"] === undefined ? "1080" : undefined }
      ),
      given
    ),
  });
};

// The aspects Peal renders, as the job's aspect.
const aspects: ReadonlyMap<string, ImageAspect> = new Map([
  ["16:9", "landscape"],
  ["1:1", "square"],
  ["9:16", "portrait"],
]);

const resolutions: ReadonlySet<string> = new Set([
  "preview",
  "mobile",
  "sd",
  "hd",
  "1080",
]);

// An output that renders something else than one video of the timeline:
// another size, a part of it, a scaled copy, a loop, a poster or a frame.
const refusedOutputKeys = [
  "size",
  "range",
  "scaleTo",
  "repeat",
  "poster",
  "thumbnail",
] as const;

/** The most frames a second Peal renders. */
const maxEditFps = 30;

// Milliseconds are as fine as a timeline takes.
const toMillis = (seconds: number): number => Math.round(seconds * 1000) / 1000;

/** What an edit Peal renders comes to: the job's aspect and length. */
export interface EditVideo {
  readonly aspect: ImageAspect;
  readonly durationSeconds: number;
}

const outputAspectOf = (
  edit: Schema.JsonObject
): Result.Result<ImageAspect, SlideshowRejected> => {
  const output = objectAt(edit, "output") ?? {};
  const format = stringAt(output, "format") ?? "mp4";
  const resolution = stringAt(output, "resolution") ?? "1080";
  const aspect = aspects.get(stringAt(output, "aspectRatio") ?? "16:9");
  const fps = Option.getOrUndefined(decodeNumber(output["fps"]));

  const supported =
    format === "mp4" &&
    resolutions.has(resolution) &&
    aspect !== undefined &&
    refusedOutputKeys.every((key) => output[key] === undefined) &&
    (output["fps"] === undefined || (fps !== undefined && fps <= maxEditFps));

  return supported && aspect !== undefined
    ? Result.succeed(aspect)
    : refused("outputNotSupported");
};

const clipsOf = (
  edit: Schema.JsonObject
): readonly (readonly Schema.Json[])[] => {
  const timeline = objectAt(edit, "timeline") ?? {};

  return (arrayAt(timeline, "tracks") ?? []).map((track) => {
    const object = jsonObjectOf(track);

    return object === undefined ? [] : (arrayAt(object, "clips") ?? []);
  });
};

/**
 * Where the edit ends, as far as numbers say: the latest end of a clip
 * whose start and length are both numbers, 0 when none is. A clip that
 * starts or lasts `auto`, `end` or as another clip (`alias://…`) is not
 * counted here: Shotstack's own render bounds it, and the video Peal keeps
 * is bounded in bytes.
 */
const editEndOf = (
  tracks: readonly (readonly Schema.Json[])[]
): Result.Result<number, SlideshowRejected> => {
  let end = 0;

  for (const clip of tracks.flat()) {
    const object = jsonObjectOf(clip) ?? {};
    const start = Option.getOrUndefined(decodeNumber(object["start"]));
    const length = Option.getOrUndefined(decodeNumber(object["length"]));

    if (start !== undefined && length !== undefined) {
      const clipEnd = toMillis(start + length);

      if (clipEnd > maxEditSeconds) {
        return refused("editTooLong");
      }

      end = Math.max(end, clipEnd);
    }
  }

  return Result.succeed(end);
};

/**
 * The output, size and length rules, in that order: an MP4 (`format` `mp4`
 * or none), at `preview`, `mobile`, `sd`, `hd` or `1080` (none: 1080p), in
 * 16:9, 9:16 or 1:1 (none: 16:9), without `size`, `range`, `scaleTo`,
 * `repeat`, `poster` or `thumbnail`, at 30 frames a second at most
 * (`outputNotSupported`); `maxEditTracks` tracks and `maxEditClips` clips
 * at most (`editTooLarge`); every clip whose start and length are numbers
 * ending by `maxEditSeconds` (`editTooLong`).
 */
export const editVideoOf = (
  edit: Schema.JsonObject
): Result.Result<EditVideo, SlideshowRejected> =>
  Result.gen(function* video() {
    const aspect = yield* outputAspectOf(edit);
    const tracks = clipsOf(edit);
    const clips = tracks.reduce((total, track) => total + track.length, 0);

    if (tracks.length > maxEditTracks || clips > maxEditClips) {
      return yield* refused("editTooLarge");
    }

    const durationSeconds = yield* editEndOf(tracks);

    return { aspect, durationSeconds };
  });
