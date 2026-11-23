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
      agents: {
        body: "Let an AI agent write, schedule or publish posts, choose whether it may publish, and read what it did.",
        headline: "Let an agent post for you",
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
      composer: {
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
        "Post to a Discord channel, a Slack channel or a Telegram chat from the same composer as every other platform.",
      title: "Discord, Slack and Telegram",
    },
    links: {
      agents: {
        description: "Let an agent write and schedule, with your approval.",
        title: "Agent skills",
      },
      analytics: {
        description: "See how each post and account did, and export it.",
        title: "Analytics",
      },
      api: {
        description: "One HTTP API for every platform, with OpenAPI.",
        title: "API",
      },
      approvals: {
        description: "Get a client's approval before a post goes out.",
        title: "Approvals",
      },
      calendar: {
        description: "Schedule in your time zone, move posts on the calendar.",
        title: "Calendar",
      },
      blog: {
        description: "News, guides and how Peal is built.",
        title: "Blog",
      },
      changelog: {
        description: "Every release and what changed in it.",
        title: "Changelog",
      },
      cli: {
        description: "The peal command, with answers as JSON.",
        title: "Command line",
      },
      composer: {
        description: "Write once, then adjust and preview each platform.",
        title: "Composer",
      },
      discord: {
        description: "Ask questions and talk with the team.",
        title: "Discord",
      },
      embedding: {
        description: "Peal inside your product, a workspace per customer.",
        title: "Embedding kit",
      },
      inbox: {
        description: "Answer comments, reviews and messages in one place.",
        title: "Inbox",
      },
      mcp: {
        description: "Connect an AI assistant, and choose if it may publish.",
        title: "MCP server",
      },
      sdks: {
        description: "Typed clients in eight languages.",
        title: "SDKs",
      },
      security: {
        description: "How to report a vulnerability.",
        title: "Security",
      },
      selfHosting: {
        description: "Run Peal on your own server with Postgres and S3.",
        title: "Self-hosting guide",
      },
      status: {
        description: "Whether Peal is up right now.",
        title: "Status",
      },
      webhooks: {
        description: "Hear what happens in a workspace, without polling.",
        title: "Webhooks",
      },
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
      agents: {
        body: "Laissez un agent IA rédiger, programmer ou publier, choisissez s’il peut publier, et lisez ce qu’il a fait.",
        headline: "Laissez un agent publier pour vous",
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
      composer: {
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
      agents: {
        description: "Un agent rédige et programme, avec votre accord.",
        title: "Skills pour agents",
      },
      analytics: {
        description: "Voir comment chaque publication a marché, et l’exporter.",
        title: "Statistiques",
      },
      api: {
        description: "Une API HTTP pour toutes les plateformes, avec OpenAPI.",
        title: "API",
      },
      approvals: {
        description: "L’accord d’un client avant qu’une publication parte.",
        title: "Approbations",
      },
      calendar: {
        description:
          "Programmer dans votre fuseau, déplacer sur le calendrier.",
        title: "Calendrier",
      },
      blog: {
        description: "Nouveautés, guides et coulisses de Peal.",
        title: "Blog",
      },
      changelog: {
        description: "Chaque version et ce qu’elle change.",
        title: "Journal des modifications",
      },
      cli: {
        description: "La commande peal, avec des réponses en JSON.",
        title: "Ligne de commande",
      },
      composer: {
        description:
          "Écrire une fois, puis ajuster et prévisualiser chaque plateforme.",
        title: "Éditeur",
      },
      discord: {
        description: "Poser vos questions et échanger avec l’équipe.",
        title: "Discord",
      },
      embedding: {
        description: "Peal dans votre produit, un espace par client.",
        title: "Kit d’intégration",
      },
      inbox: {
        description:
          "Répondre aux commentaires, avis et messages au même endroit.",
        title: "Boîte de réception",
      },
      mcp: {
        description: "Connecter un assistant IA, et choisir s’il peut publier.",
        title: "Serveur MCP",
      },
      sdks: {
        description: "Des clients typés dans huit langages.",
        title: "SDK",
      },
      security: {
        description: "Comment signaler une vulnérabilité.",
        title: "Sécurité",
      },
      selfHosting: {
        description: "Faire tourner Peal chez vous, avec Postgres et S3.",
        title: "Guide d’auto-hébergement",
      },
      status: {
        description: "Si Peal fonctionne en ce moment.",
        title: "État du service",
      },
      webhooks: {
        description: "Savoir ce qui se passe dans un espace, sans interroger.",
        title: "Webhooks",
      },
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
