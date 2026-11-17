// The marks of the brands simple-icons does not hold, read from the files
// their owners publish (src/brand-marks/README.md). A drawing is copied
// from its file, never drawn: the test checks each against its file.

/** A mark drawn in one colour: its paths as one, and the box they fill. */
interface OneColourMark {
  /** `evenodd` where a shape inside another is a hole, such as a letter. */
  readonly fillRule?: "evenodd" | undefined;
  readonly path: string;
  readonly viewBox: string;
}

/**
 * LinkedIn's [in] mark, LinkedIn's one-colour symbol: the box crops the
 * 40-unit symbol to its artwork, which runs from 3 to 37.
 */
const linkedin: OneColourMark & { readonly hex: string } = {
  hex: "0A66C2",
  path: "M34.5,3H5.6C4.2,3,3,4.1,3,5.4v29.1C3,35.9,4.2,37,5.6,37h29C35.9,37,37,35.9,37,34.6V5.4C37,4.1,35.9,3,34.5,3zM13,32H8V16h5V32zM10.5,13.9c-1.9,0-3.4-1.5-3.4-3.4c0-1.9,1.5-3.4,3.4-3.4s3.4,1.5,3.4,3.4C13.9,12.4,12.4,13.9,10.5,13.9zM32,32h-5v-7.9c0-2.4-1-4-2.6-4c-2.3,0-3.4,2.1-3.4,4.6V32h-5V16h5v2.1c0.8-1.4,2.2-2.5,4.7-2.5c4.7,0,6.3,1.7,6.3,5.4V32z",
  viewBox: "3 3 34 34",
};

/** Slack's mark in one colour: the eight paths of its black icon, as one. */
const slackPaths = [
  "M84.039,252.769c0,23.127-18.893,42.02-42.02,42.02S0,275.896,0,252.769s18.893-42.02,42.02-42.02h42.02v42.02Z",
  "M105.212,252.769c0-23.127,18.893-42.02,42.02-42.02s42.02,18.893,42.02,42.02v105.212c0,23.127-18.893,42.02-42.02,42.02s-42.02-18.893-42.02-42.02c0,0,0-105.212,0-105.212Z",
  "M147.231,84.039c-23.127,0-42.02-18.893-42.02-42.02S124.104,0,147.231,0s42.02,18.893,42.02,42.02v42.02h-42.02Z",
  "M147.231,105.212c23.127,0,42.02,18.893,42.02,42.02s-18.893,42.02-42.02,42.02H42.02c-23.127,0-42.02-18.893-42.02-42.02s18.893-42.02,42.02-42.02c0,0,105.212,0,105.212,0Z",
  "M315.961,147.231c0-23.127,18.893-42.02,42.02-42.02s42.02,18.893,42.02,42.02-18.893,42.02-42.02,42.02h-42.02v-42.02Z",
  "M294.788,147.231c0,23.127-18.893,42.02-42.02,42.02s-42.02-18.893-42.02-42.02V42.02c0-23.127,18.893-42.02,42.02-42.02s42.02,18.893,42.02,42.02v105.212Z",
  "M252.769,315.961c23.127,0,42.02,18.893,42.02,42.02s-18.893,42.02-42.02,42.02-42.02-18.893-42.02-42.02v-42.02h42.02Z",
  "M252.769,294.788c-23.127,0-42.02-18.893-42.02-42.02s18.893-42.02,42.02-42.02h105.212c23.127,0,42.02,18.893,42.02,42.02s-18.893,42.02-42.02,42.02h-105.212Z",
] as const;

const slack: OneColourMark = {
  path: slackPaths.join(""),
  viewBox: "0 0 400 400",
};

/**
 * Google Business Profile's logo in one colour, which Google does not
 * publish: Peal's, made from Google's file and nothing else. Its outline
 * (the clip path `c`, the awning and the store as one) with its "G" (the
 * `#EEE` path) cut out, each copied as it is. The box is the outline's,
 * 8 to 184 wide and 20 to 172 high, made square.
 */
const googleBusinessProfilePaths = {
  g: "M138 134v8.51h11.84c-.95 5.06-5.37 8.74-11.84 8.74-7.18 0-13-6.07-13-13.25s5.82-13.25 13-13.25c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31c-3.81-3.55-8.79-5.73-14.72-5.73-12.15 0-22 9.85-22 22s9.85 22 22 22c12.71 0 21.12-8.93 21.12-21.5 0-1.56-.14-3.06-.4-4.5H138z",
  outline:
    "M184 76l-12.5-47.5c0-.2-.1-.3-.2-.5s-.1-.4-.2-.5c-.1-.2-.1-.3-.2-.5s-.2-.3-.2-.5c-.1-.2-.2-.3-.2-.5-.1-.2-.2-.3-.3-.5-.1-.1-.2-.3-.3-.4-.1-.2-.3-.4-.4-.5-.1-.1-.2-.3-.3-.4l-.6-.6-.3-.3c-.2-.1-.3-.3-.5-.4l-.3-.3c-.2-.1-.3-.3-.5-.4-.1-.1-.2-.2-.4-.2-.2-.1-.4-.3-.6-.4-.1-.1-.2-.1-.3-.2-.3-.2-.6-.3-.9-.5-.1 0-.2-.1-.3-.1-.2-.1-.5-.2-.8-.3-.1 0-.2-.1-.4-.1-.2-.1-.5-.1-.7-.2-.1 0-.3-.1-.4-.1-.2 0-.5-.1-.8-.1h-.4c-.4 0-.7-.1-1.1-.1H32c-.4 0-.8 0-1.1.1h-.4c-.3 0-.5.1-.8.1-.1 0-.3.1-.4.1-.2.1-.5.1-.7.2-.1 0-.2.1-.4.1-.3.1-.5.2-.8.3-.1 0-.2.1-.3.1-.3.1-.6.3-.9.5-.1.1-.2.1-.3.2-.2.1-.4.2-.6.4-.1.1-.2.2-.4.2-.2.1-.3.2-.5.4l-.3.3c-.2.1-.3.3-.5.4l-.3.3-.6.6c-.1.1-.2.3-.3.4-.1.2-.3.4-.4.5s-.2.3-.3.4c-.1.2-.2.3-.3.5-.1.1-.2.3-.2.4-.1.2-.2.3-.2.5-.1.2-.1.3-.2.5s-.1.4-.2.6c-.1.1-.1.3-.2.4L8 76c0 8.5 4.9 16 12 19.6V160c0 6.6 5.4 12 12 12h128c6.6 0 12-5.4 12-12V95.6c7.1-3.6 12-11.1 12-19.6z",
} as const;

const googleBusinessProfile: OneColourMark = {
  fillRule: "evenodd",
  path: googleBusinessProfilePaths.outline + googleBusinessProfilePaths.g,
  viewBox: "8 8 176 176",
};

export {
  googleBusinessProfile,
  googleBusinessProfilePaths,
  linkedin,
  slack,
  slackPaths,
};

export type { OneColourMark };
