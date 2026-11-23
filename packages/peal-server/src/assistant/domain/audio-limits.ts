import { Duration } from "effect";

/**
 * The longest text a voice-over is made from, in UTF-16 code units: under
 * the shortest limit of the providers offered (OpenAI's speech API takes
 * 4,096 characters). The contract copies it (`maxVoiceoverTextLength`).
 */
export const maxVoiceoverTextLength = 4000;

/**
 * How many voice-overs and transcripts a workspace may ask its own
 * providers for each UTC day, whatever each ends with: a bound, not a
 * price (the contract's `voiceoversPerDay`, `transcriptionsPerDay`).
 */
export const voiceoversPerDay = 50;

export const transcriptionsPerDay = 50;

/**
 * The largest file a transcript is made of: what OpenAI's and Groq's
 * transcription APIs take in one request (the contract's
 * `maxTranscriptionBytes`).
 */
export const maxTranscriptionBytes = 25_000_000;

/**
 * The largest voice-over kept: a few minutes of speech, as MP3, or as
 * WAV at 24 kHz, take a few megabytes; past it the answer is refused.
 */
export const maxVoiceoverBytes = 48 * 1024 * 1024;

/**
 * How long a voice-over or a transcript is waited for: under the 110
 * seconds a request is given, as the import's own bound.
 */
export const audioTimeout = Duration.seconds(90);
