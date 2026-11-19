import type { Locale } from "../locales";

// The consent notice's strings (DESIGN.md, Site), apart from the chrome's
// messages because the docs import them too. The answers' labels are the
// app's (`Measurement.card` in packages/peal-web/messages): one word per
// notion. French takes U+202F before ? and inside « », U+00A0 before :.

export interface ConsentMessages {
  readonly allow: string;
  /** `{date}` is the day the answer was given, written out. */
  readonly allowed: string;
  readonly close: string;
  readonly policy: string;
  /** What the art's readout says of the one cookie that follows a visitor. */
  readonly readout: {
    readonly allow: string;
    readonly refuse: string;
    readonly rest: string;
  };
  readonly refuse: string;
  readonly refused: string;
  readonly saved: string;
  readonly settings: string;
  /** Why there is nothing to choose: the browser asks not to be followed. */
  readonly signal: string;
  readonly text: string;
  readonly title: string;
}

export const consentMessages: Record<Locale, ConsentMessages> = {
  en: {
    allow: "Allow",
    allowed: "You allowed this on {date}.",
    close: "Close",
    policy: "Privacy policy",
    readout: {
      allow: "cookie: 183 d",
      refuse: "cookie: none",
      rest: "cookie: ?",
    },
    refuse: "Don’t allow",
    refused: "You didn’t allow this on {date}.",
    saved: "Saved. You can change it under Cookie settings.",
    settings: "Cookie settings",
    signal:
      "Your browser asks sites not to track you, so we measure nothing here and there’s nothing to choose.",
    text: "We count visits without cookies. Allow one and we’ll also see which pages lead to a sign-up, and link your visits to your account if you create one. It lasts 6 months; change your mind under Cookie settings.",
    title: "Can we keep a cookie?",
  },
  fr: {
    allow: "Autoriser",
    allowed: "Vous l’avez autorisé le {date}.",
    close: "Fermer",
    policy: "Politique de confidentialité",
    readout: {
      allow: "cookie : 183 j",
      refuse: "cookie : aucun",
      rest: "cookie : ?",
    },
    refuse: "Refuser",
    refused: "Vous l’avez refusé le {date}.",
    saved:
      "Enregistré. Vous pouvez le modifier dans les Paramètres des cookies.",
    settings: "Paramètres des cookies",
    signal:
      "Votre navigateur demande aux sites de ne pas vous suivre. Nous ne mesurons donc rien ici, et il n’y a rien à choisir.",
    text: "Nous comptons les visites sans cookie. Autorisez-en un et nous verrons aussi quelles pages mènent à une inscription, et relierons vos visites à votre compte si vous en créez un. Il dure 6 mois ; changez d’avis dans les Paramètres des cookies.",
    title: "Un cookie, vous permettez ?",
  },
};
