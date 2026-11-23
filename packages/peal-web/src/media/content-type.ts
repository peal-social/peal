import { MediaContentTypeSchema } from "peal-contract";

// Browsers name some formats by older or vendor types: Chrome on macOS
// gives a WAV file `audio/x-wav`, others `audio/wave`, an M4A
// `audio/x-m4a`. The API takes one type a format, so the uploader declares
// the one it takes; the server still reads the file's first bytes.
const aliases: ReadonlyMap<string, string> = new Map([
  ["audio/mp3", "audio/mpeg"],
  ["audio/x-mp3", "audio/mpeg"],
  ["audio/x-mpeg", "audio/mpeg"],
  ["audio/m4a", "audio/mp4"],
  ["audio/x-m4a", "audio/mp4"],
  ["audio/wave", "audio/wav"],
  ["audio/x-wav", "audio/wav"],
  ["audio/x-pn-wav", "audio/wav"],
  ["audio/vnd.wave", "audio/wav"],
]);

/** The type the uploader declares for a file the browser typed so. */
export const declaredTypeOf = (browserType: string): string => {
  const type = browserType.trim().toLowerCase();

  return aliases.get(type) ?? type;
};

/** What the file picker offers: the types the API takes, and their aliases. */
export const pickerAccept = [
  ...MediaContentTypeSchema.literals,
  ...aliases.keys(),
].join(",");
