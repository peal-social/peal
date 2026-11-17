import { Schema } from "effect";

// Next types an imported SVG as anything: it is the file's address, which
// Next's build hands over as a static image and Vite's as a string.
const ImportedFileSchema = Schema.Union([
  Schema.String,
  Schema.Struct({ src: Schema.String }),
]);

const decodeImportedFile = Schema.decodeUnknownSync(ImportedFileSchema);

const isAddress = Schema.is(Schema.String);

/** The address of an imported file, as Next's build or Vite gives it. */
export const assetAddress = (imported: typeof ImportedFileSchema.Type) =>
  isAddress(imported) ? imported : imported.src;

export { decodeImportedFile };
