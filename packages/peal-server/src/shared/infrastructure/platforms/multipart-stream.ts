import { Stream } from "effect";

/** A text field of a multipart form. */
export interface MultipartField {
  readonly name: string;
  readonly value: string;
}

/** The file of a multipart form, whose bytes are read as they are sent. */
export interface MultipartFile<E, R> {
  /** The file's size, which the form's length is computed from. */
  readonly byteSize: number;
  readonly bytes: Stream.Stream<Uint8Array, E, R>;
  readonly contentType: string;
  readonly fileName: string;
  readonly name: string;
}

const encoder = new TextEncoder();

// A name between quotes in a part's header, as browsers write it (the HTML
// standard's multipart/form-data encoding): line breaks and quotes are
// percent-encoded, the rest goes as UTF-8.
const quoted = (name: string) =>
  name.replaceAll("\r", "%0D").replaceAll("\n", "%0A").replaceAll('"', "%22");

// The header of a file's part, after the boundary line.
const fileHeader = <E, R>(boundary: string, file: MultipartFile<E, R>) =>
  [
    `--${boundary}`,
    `Content-Disposition: form-data; name="${quoted(file.name)}"; filename="${quoted(file.fileName)}"`,
    `Content-Type: ${file.contentType}`,
    "",
    "",
  ].join("\r\n");

/**
 * A `multipart/form-data` body (RFC 7578) with text fields, then files,
 * each in turn, as a stream: each file's bytes pass through as they are
 * read, and a file is opened only once those before it are sent, so a
 * form with files of any size holds a chunk of one at a time, where
 * `FormData` needs every file whole. Its length is known beforehand from
 * the files' sizes, for servers that refuse a body without one.
 * `boundary` must not occur in the fields; a random one never does.
 */
export const multipartFormBody = <E, R>(form: {
  readonly boundary: string;
  readonly fields: readonly MultipartField[];
  readonly files: readonly MultipartFile<E, R>[];
}) => {
  const { boundary, fields, files } = form;

  // Each field's part, each ending in the line break before the next
  // boundary.
  const head = encoder.encode(
    fields
      .map(({ name, value }) =>
        [
          `--${boundary}`,
          `Content-Disposition: form-data; name="${quoted(name)}"`,
          "",
          `${value}\r\n`,
        ].join("\r\n")
      )
      .join("")
  );

  // Each file's part: its header, its bytes, and the line break that ends
  // it before the next boundary.
  const parts = files.map((file, index) => ({
    file,
    header: encoder.encode(
      `${index === 0 ? "" : "\r\n"}${fileHeader(boundary, file)}`
    ),
  }));

  // The line break that ends the last file's part, then the closing
  // boundary.
  const tail = encoder.encode(
    `${parts.length === 0 ? "" : "\r\n"}--${boundary}--\r\n`
  );

  let bytes: Stream.Stream<Uint8Array, E, R> = Stream.make(head);
  let contentLength = head.length + tail.length;

  for (const { file, header } of parts) {
    bytes = bytes.pipe(
      Stream.concat(Stream.make(header)),
      Stream.concat(file.bytes)
    );
    contentLength += header.length + file.byteSize;
  }

  return {
    bytes: bytes.pipe(Stream.concat(Stream.make(tail))),
    contentLength,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
};

/**
 * A `multipart/form-data` body with text fields and one file, the file
 * last (`multipartFormBody` with one file).
 */
export const multipartBody = <E, R>(form: {
  readonly boundary: string;
  readonly fields: readonly MultipartField[];
  readonly file: MultipartFile<E, R>;
}) =>
  multipartFormBody({
    boundary: form.boundary,
    fields: form.fields,
    files: [form.file],
  });

/**
 * A boundary for a form sent for the call `key` names (its idempotency
 * key): the same for every run of the call, and nothing a member typed can
 * hold it.
 */
export const formBoundary = (key: string): string =>
  `peal-${key.replaceAll(/[^\dA-Za-z]/gu, "-").slice(0, 60)}`;
