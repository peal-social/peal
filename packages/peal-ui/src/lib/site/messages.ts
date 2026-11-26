import type { Locale } from "./locales.ts";

// The strings of the header and the footer that
// peal.social's pages share (the site's and the blog's), per locale.
// Each app spreads them into its own catalogue.

const en = {
  footer: {
    cancel: "Cancel your contract",
    company: "Company",
    // The section's id is its heading's slug in privacy.md.
    cookies: {
      label: "Cookie settings",
      section: "cookies-and-similar-technologies",
    },
    language: "Language",
    policies: "Policies",
    rights: "All rights reserved.",
    // The status icon's meaning, for its tooltip and screen readers.
    status: {
      degraded: "Some services have issues",
      down: "Peal is down",
      up: "All services are up",
    },
    socials: "Socials",
    source: "GitHub",
    withdraw: "Withdraw from contract here",
  },
  legal: {
    "data-deletion": "Data deletion",
    privacy: "Privacy policy",
    terms: "Terms of service",
  },
  nav: {
    comparePlatforms: "Compare every platform",
    platformsIntro: {
      body: "Write it once, adjust it where a platform needs to, and see what each network allows before you publish.",
      headline: "One post, every platform",
    },
    blog: "Blog",
    brand: "Peal",
    developers: "for developers and agents",
    discord: "Discord",
    docs: "Docs",
    drawer: { close: "Close the menu", open: "Open the menu", title: "Menu" },
    getStarted: "Get started",
    github: "GitHub",
    home: "Peal home page",
    intros: {
      ads: {
        body: "Read your Meta and Google Ads campaigns beside your posts' organic results, and boost a Facebook or Instagram post.",
        headline: "Ads next to your posts",
      },
      agents: {
        body: "Let an AI agent write, schedule or publish posts, choose whether it may publish, and read what it did.",
        headline: "Let an agent post for you",
      },
      aiAgent: {
        body: "Ask what's scheduled this week or which comments still need an answer, have it write drafts, and approve each change before it's made.",
        headline: "An agent that knows your workspace",
      },
      analytics: {
        body: "See how your posts and accounts did on each platform and which posts did best, then export the figures.",
        headline: "See what worked",
      },
      api: {
        body: "Authenticate with a key and publish a post in five requests, with an OpenAPI document and a reference for the rest.",
        headline: "Peal over HTTP",
      },
      approvals: {
        body: "Show a post to a client who has no Peal account, collect their comments, and get their approval before it goes out.",
        headline: "Get a yes before it goes out",
      },
      calendar: {
        body: "Schedule in your own time zone, move or cancel a post on the calendar, and follow how it went on each channel.",
        headline: "Schedule posts on a calendar",
      },
      assistant: {
        body: "Write, rewrite, shorten or translate a post, get hashtag ideas, or make an image to go with it.",
        headline: "Write with AI in the editor",
      },
      blog: {
        body: "Articles from the people who build Peal: what is new, how to use it and how it works.",
        headline: "News from the Peal team",
      },
      changelog: {
        body: "Release notes for each version of Peal, on GitHub, with a link to every change.",
        headline: "Every release, as it ships",
      },
      cli: {
        body: "Sign in or use an API key, choose the workspace, and read every answer as JSON.",
        headline: "Peal from your terminal",
      },
      publishing: {
        body: "Give a channel its own text and options where it needs them, and preview the post on each.",
        headline: "Write a post once",
      },
      discord: {
        body: "Ask for help, share what you build on the API or the MCP server, and hear what ships next.",
        headline: "Talk with the people building Peal",
      },
      embedding: {
        body: "A partner account, a workspace for each of your customers, and a hosted page where they connect their accounts.",
        headline: "Peal inside your own product",
      },
      inbox: {
        body: "Comments under your posts, your Google Business Profile reviews, and your Mastodon and Bluesky direct messages, answered in one place.",
        headline: "Reply from one inbox",
      },
      mcp: {
        body: "Connect an AI assistant or any MCP client to one workspace, and choose whether it may publish.",
        headline: "Let an assistant work in Peal",
      },
      sdks: {
        body: "Install the client for your language, check the credential, publish a post and handle errors the same way in each.",
        headline: "Clients in eight languages",
      },
      security: {
        body: "How to report it privately, what to put in the report, and how we keep you informed while we fix it.",
        headline: "Found a vulnerability?",
      },
      selfHosting: {
        body: "A server needs Postgres, an S3-compatible store and a way to send email. The guide walks through each service and the settings it reads.",
        headline: "Run Peal on your own server",
      },
      status: {
        body: "Live checks of the app, the API, the docs and this site, with their recent results.",
        headline: "Is Peal up right now?",
      },
      webhooks: {
        body: "Peal tells your own server what happens in a workspace, so you never have to poll.",
        headline: "Hear about changes as they happen",
      },
    },
    launch: {
      caption: "latest launch",
      description:
        "Post to a Discord channel, a Slack channel or a Telegram chat from the same editor as every other platform.",
      title: "Discord, Slack and Telegram",
    },
    // Each row's name alone: the hover preview says what it is.
    links: {
      ads: "Ads",
      agents: "Agent skills",
      aiAgent: "AI agent",
      analytics: "Analytics",
      api: "API",
      approvals: "Approvals",
      assistant: "Writing assistant",
      blog: "Blog",
      calendar: "Schedule",
      changelog: "Changelog",
      cli: "Command line",
      discord: "Discord",
      embedding: "Embedding kit",
      inbox: "Inbox",
      mcp: "MCP server",
      publishing: "Publishing",
      sdks: "SDKs",
      security: "Security",
      selfHosting: "Self-hosting guide",
      status: "Status",
      webhooks: "Webhooks",
    },
    main: "Main",
    platformGroups: {
      ads: "Ads",
      blog: "Blog",
      chat: "Chat",
      social: "Social",
    },
    platforms: "Platforms",
    products: "Products",
    resources: "Resources",
    resourcesGroup: "Learn and get help",
    signIn: "Log in",
    star: {
      caption: "fair source",
      description:
        "Peal is fair source: read the code, run it yourself, and watch every change land.",
      title: "The source is public",
    },
    stars: "stars",
    studio: "for marketing teams",
  },
  pricing: {
    nav: "Pricing",
  },
};

export type ChromeMessages = typeof en;

const fr: ChromeMessages = {
  footer: {
    cancel: "Résilier votre contrat",
    company: "Entreprise",
    cookies: {
      label: "Paramètres des cookies",
      section: "cookies-et-technologies-similaires",
    },
    language: "Langue",
    policies: "Informations légales",
    rights: "Tous droits réservés.",
    status: {
      degraded: "Certains services ont des problèmes",
      down: "Peal est hors service",
      up: "Tous les services fonctionnent",
    },
    socials: "Réseaux sociaux",
    source: "GitHub",
    withdraw: "Renoncer au contrat ici",
  },
  legal: {
    "data-deletion": "Suppression des données",
    privacy: "Politique de confidentialité",
    terms: "Conditions d’utilisation",
  },
  nav: {
    comparePlatforms: "Comparer toutes les plateformes",
    platformsIntro: {
      body: "Écrivez-la une fois, ajustez-la là où une plateforme le demande, et voyez ce que chaque réseau accepte avant de publier.",
      headline: "Une publication, toutes les plateformes",
    },
    blog: "Blog",
    brand: "Peal",
    developers: "pour les développeurs et les agents",
    discord: "Discord",
    docs: "Documentation",
    drawer: { close: "Fermer le menu", open: "Ouvrir le menu", title: "Menu" },
    getStarted: "Commencer",
    github: "GitHub",
    home: "Accueil de Peal",
    intros: {
      ads: {
        body: "Suivez vos campagnes Meta et Google Ads à côté des résultats organiques de vos publications, et boostez une publication Facebook ou Instagram.",
        headline: "La publicité à côté de vos publications",
      },
      agents: {
        body: "Laissez un agent IA rédiger, programmer ou publier, choisissez s’il peut publier, et lisez ce qu’il a fait.",
        headline: "Laissez un agent publier pour vous",
      },
      aiAgent: {
        body: "Demandez-lui ce qui est programmé cette semaine ou quels commentaires attendent une réponse, faites-lui écrire des brouillons, et validez chaque changement avant qu’il soit fait.",
        headline: "Un agent qui connaît votre espace",
      },
      analytics: {
        body: "Voyez comment vos publications et vos comptes ont marché sur chaque plateforme et lesquelles ont le mieux marché, puis exportez les chiffres.",
        headline: "Voyez ce qui a marché",
      },
      api: {
        body: "Authentifiez-vous avec une clé et publiez en cinq requêtes, avec un document OpenAPI et une référence pour le reste.",
        headline: "Peal en HTTP",
      },
      approvals: {
        body: "Montrez une publication à un client sans compte Peal, recueillez ses commentaires, et obtenez son accord avant qu’elle parte.",
        headline: "Un oui avant la publication",
      },
      calendar: {
        body: "Programmez dans votre fuseau horaire, déplacez ou annulez une publication sur le calendrier, et suivez comment elle s’est passée sur chaque canal.",
        headline: "Programmez sur un calendrier",
      },
      assistant: {
        body: "Rédigez, réécrivez, raccourcissez ou traduisez une publication, trouvez des hashtags, ou créez une image pour l’accompagner.",
        headline: "Écrivez avec l’IA dans l’éditeur",
      },
      blog: {
        body: "Les articles de l’équipe qui fait Peal : les nouveautés, comment s’en servir et comment il fonctionne.",
        headline: "Les nouvelles de l’équipe Peal",
      },
      changelog: {
        body: "Les notes de chaque version de Peal, sur GitHub, avec un lien vers chaque changement.",
        headline: "Chaque version, dès sa sortie",
      },
      cli: {
        body: "Connectez-vous ou utilisez une clé d’API, choisissez l’espace de travail, et lisez chaque réponse en JSON.",
        headline: "Peal depuis votre terminal",
      },
      publishing: {
        body: "Donnez à un canal son propre texte et ses options là où il le faut, et prévisualisez la publication sur chacun.",
        headline: "Écrivez une publication une fois",
      },
      discord: {
        body: "Demandez de l’aide, montrez ce que vous construisez sur l’API ou le serveur MCP, et découvrez ce qui arrive ensuite.",
        headline: "Échangez avec l’équipe qui construit Peal",
      },
      embedding: {
        body: "Un compte partenaire, un espace de travail par client, et une page hébergée où ils connectent leurs comptes.",
        headline: "Peal dans votre propre produit",
      },
      inbox: {
        body: "Les commentaires sous vos publications, les avis de vos établissements Google Business Profile et vos messages privés Mastodon et Bluesky, traités au même endroit.",
        headline: "Répondez depuis une seule boîte",
      },
      mcp: {
        body: "Connectez un assistant IA ou tout client MCP à un espace de travail, et choisissez s’il peut publier.",
        headline: "Un assistant qui travaille dans Peal",
      },
      sdks: {
        body: "Installez le client de votre langage, vérifiez l’identifiant, publiez et traitez les erreurs de la même façon dans chacun.",
        headline: "Des clients dans huit langages",
      },
      security: {
        body: "Comment la signaler en privé, quoi mettre dans le signalement, et comment nous vous tenons informé pendant la correction.",
        headline: "Vous avez trouvé une vulnérabilité ?",
      },
      selfHosting: {
        body: "Un serveur a besoin de Postgres, d’un stockage compatible S3 et d’un moyen d’envoyer des e-mails. Le guide passe en revue chaque service et les réglages qu’il lit.",
        headline: "Faites tourner Peal sur votre serveur",
      },
      status: {
        body: "Des vérifications en direct de l’application, de l’API, de la documentation et de ce site, avec leurs résultats récents.",
        headline: "Peal fonctionne-t-il en ce moment ?",
      },
      webhooks: {
        body: "Peal dit à votre serveur ce qui se passe dans un espace de travail, sans que vous ayez à interroger.",
        headline: "Soyez prévenu au moment où ça change",
      },
    },
    launch: {
      caption: "dernière nouveauté",
      description:
        "Publiez dans un salon Discord, un canal Slack ou une conversation Telegram depuis le même éditeur que pour les autres plateformes.",
      title: "Discord, Slack et Telegram",
    },
    links: {
      ads: "Publicité",
      agents: "Skills pour agents",
      aiAgent: "Agent IA",
      analytics: "Statistiques",
      api: "API",
      approvals: "Approbations",
      assistant: "Assistant de rédaction",
      blog: "Blog",
      calendar: "Programmation",
      changelog: "Journal des modifications",
      cli: "Ligne de commande",
      discord: "Discord",
      embedding: "Kit d’intégration",
      inbox: "Boîte de réception",
      mcp: "Serveur MCP",
      publishing: "Publication",
      sdks: "SDK",
      security: "Sécurité",
      selfHosting: "Guide d’auto-hébergement",
      status: "État du service",
      webhooks: "Webhooks",
    },
    main: "Principal",
    platformGroups: {
      ads: "Publicité",
      blog: "Blog",
      chat: "Messageries",
      social: "Réseaux sociaux",
    },
    platforms: "Plateformes",
    products: "Produits",
    resources: "Ressources",
    resourcesGroup: "Apprendre et trouver de l’aide",
    signIn: "Se connecter",
    star: {
      caption: "fair source",
      description:
        "Peal est fair source : lisez le code, hébergez-le vous-même et voyez arriver chaque changement.",
      title: "Le code est public",
    },
    stars: "étoiles",
    studio: "pour les équipes marketing",
  },
  pricing: {
    nav: "Tarifs",
  },
};

const catalogues: Record<Locale, ChromeMessages> = { en, fr };

export const chromeMessages = (locale: Locale): ChromeMessages =>
  catalogues[locale];

/** Each locale's name, written in that language, for the language switcher. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};
