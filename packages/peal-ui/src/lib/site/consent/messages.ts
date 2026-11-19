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
  readonly eyebrow: string;
  readonly policy: string;
  /** What the art's readout says each answer stores. */
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
    eyebrow: "Cookies",
    policy: "Privacy policy",
    readout: {
      allow: "cookies: 1 · 183 d",
      refuse: "cookies: 0",
      rest: "cookies: ?",
    },
    refuse: "Don’t allow",
    refused: "You didn’t allow this on {date}.",
    saved: "Saved. You can change it under Cookie settings.",
    settings: "Cookie settings",
    signal:
      "Your browser asks sites not to track you, so we measure nothing here and there’s nothing to choose.",
    text: "We count page views without cookies and without knowing who you are. Allow a cookie and we can also see which pages lead to a sign-up: it follows your visits to the site, the blog and the docs for 6 months, and we link them to your account if you create one. You can change your mind under Cookie settings.",
    title: "Can we keep a cookie?",
  },
  fr: {
    allow: "Autoriser",
    allowed: "Vous l’avez autorisé le {date}.",
    close: "Fermer",
    eyebrow: "Cookies",
    policy: "Politique de confidentialité",
    readout: {
      allow: "cookies : 1 · 183 j",
      refuse: "cookies : 0",
      rest: "cookies : ?",
    },
    refuse: "Refuser",
    refused: "Vous l’avez refusé le {date}.",
    saved:
      "Enregistré. Vous pouvez le modifier dans les Paramètres des cookies.",
    settings: "Paramètres des cookies",
    signal:
      "Votre navigateur demande aux sites de ne pas vous suivre. Nous ne mesurons donc rien ici, et il n’y a rien à choisir.",
    text: "Nous comptons les pages vues sans cookie et sans savoir qui vous êtes. Avec un cookie, nous voyons aussi quelles pages mènent à une inscription : il suit vos visites sur le site, le blog et la documentation pendant 6 mois, et nous les relions à votre compte si vous en créez un. Vous pouvez changer d’avis dans les Paramètres des cookies.",
    title: "Un cookie, vous permettez ?",
  },
};
