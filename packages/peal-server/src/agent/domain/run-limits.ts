import { Duration } from "effect";

/** The most model rounds (requests to the provider) one run takes. */
export const maxRounds = 8;

/**
 * How long one round waits for the provider, as the assistant waits for an
 * answer (`answerTimeout`).
 */
export const roundTimeout = Duration.seconds(90);

/**
 * How long a whole run lasts at most, rounds, tools and title included.
 * It ends below what sits between the browser and the server: the web
 * app's `/api` proxy (120 seconds, `experimental.proxyTimeout`) and the
 * self-hosters' Caddy (150), so no run is ever cut by them, whether they
 * count a quiet socket or the whole answer.
 */
export const runTimeout = Duration.seconds(110);

/**
 * How long a run's claim on its chat holds: past it, a server that
 * crashed during a run lets go of the chat, and another run may start.
 * Longer than any run, so no live run loses its claim.
 */
export const runLease = Duration.seconds(150);

/** How long the title's own request waits for the provider. */
export const titleTimeout = Duration.seconds(15);

/** How long a chat nobody wrote in is kept after it was made, in hours. */
export const emptyChatRetentionHours = 24;

/** How long a chat is kept after its last message. */
export const chatRetentionDays = 90;

/**
 * The most of a tool's answer, as JSON in UTF-16 code units, that the
 * model reads, and that the chat keeps for its next rounds.
 */
export const maxToolResultLength = 12_000;

/** The most of an answer's text a chat keeps. */
export const maxAnswerLength = 40_000;

/** The most of a comment's or review's text an approval quotes. */
export const maxQuotedLength = 500;

/** The most of an item's text a card shows. */
export const maxExcerptLength = 280;

/** The most of a person's first words a chat is named after, failing a title. */
export const fallbackTitleLength = 60;

/** The longest title, as the contract takes it. */
export const maxTitleLength = 120;

/** The longest message a person sends, as the contract takes it. */
export const maxMessageLength = 8000;

/** The most files a message attaches, as the contract takes it. */
export const maxMessageMedia = 10;

/** How many chats a page of the history holds. */
export const chatPageSize = 50;
