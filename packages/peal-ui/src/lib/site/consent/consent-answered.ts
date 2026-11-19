/** The answer a visitor just gave in the consent notice. */
export interface ConsentDetail {
  readonly answer: "allowed" | "refused";
}

/**
 * `peal:consent`, which the notice dispatches on `window` once the answer
 * cookie is written; measurement follows it.
 */
export class ConsentAnswered extends CustomEvent<ConsentDetail> {
  static readonly type = "peal:consent";

  constructor(answer: ConsentDetail["answer"]) {
    super(ConsentAnswered.type, { detail: { answer } });
  }
}
