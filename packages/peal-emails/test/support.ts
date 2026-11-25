import type { RenderedEmail } from "../src/index.ts";

/** The subject of an email once it is rendered. */
export const subjectOf = async (
  email: Promise<RenderedEmail>
): Promise<string> => {
  const { subject } = await email;

  return subject;
};

/** The text of an email once it is rendered. */
export const textOf = async (
  email: Promise<RenderedEmail>
): Promise<string> => {
  const { text } = await email;

  return text;
};
