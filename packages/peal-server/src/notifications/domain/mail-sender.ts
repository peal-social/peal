import { Schema } from "effect";

/**
 * Whose address an email leaves from: the server's (`automatic`), or that of
 * the person who signs it (`personal`).
 */
export const MailSenderSchema = Schema.Literals(["automatic", "personal"]);

export type MailSender = typeof MailSenderSchema.Type;
