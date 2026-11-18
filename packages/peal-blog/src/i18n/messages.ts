import type { Locale } from "peal-ui/lib/site/locales";
import { chromeMessages } from "peal-ui/lib/site/messages";

// The blog's own strings, per locale, beside the header's and the footer's,
// which it shares with the site (peal-ui's lib/site/messages.ts). Posts are
// written in the admin, not here.

const en = {
  ...chromeMessages("en"),
  blog: {
    description:
      "News, release notes and guides from the team that builds Peal.",
    empty: "No posts yet. The first one is on its way.",
    headline: {
      muted: "What we're building, and why.",
      text: "The Peal blog.",
    },
    lead: "We write about new features, how Peal works under the hood, and what we learn from the platforms we post to.",
    notFound: {
      back: "Back to the blog",
      body: "This post doesn't exist, or it isn't published yet.",
      title: "Page not found",
    },
    title: "Blog",
  },
};

export type BlogMessages = typeof en;

const fr: BlogMessages = {
  ...chromeMessages("fr"),
  blog: {
    description:
      "Nouveautés, notes de version et guides de l’équipe qui construit Peal.",
    empty: "Aucun article pour l’instant. Le premier arrive bientôt.",
    headline: {
      muted: "Ce que nous construisons, et pourquoi.",
      text: "Le blog de Peal.",
    },
    lead: "Nous y parlons des nouvelles fonctionnalités, du fonctionnement de Peal et de ce que nous apprennent les plateformes où nous publions.",
    notFound: {
      back: "Retour au blog",
      body: "Cet article n’existe pas, ou il n’est pas encore publié.",
      title: "Page introuvable",
    },
    title: "Blog",
  },
};

const catalogues: Record<Locale, BlogMessages> = { en, fr };

export const messages = (locale: Locale): BlogMessages => catalogues[locale];
