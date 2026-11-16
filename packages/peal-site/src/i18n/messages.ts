import type { Locale } from "./locales.ts";

// Every string the site shows, per locale. Long-form legal text lives in the
// `legal` content collection instead (src/content/legal/<locale>/).

const en = {
  draft: {
    body: "This document is not in force yet. Text in square brackets is still to be written.",
    title: "Draft pending legal review",
  },
  footer: {
    cancel: "Cancel your contract",
    contract: "Your contract",
    follow: "Follow Peal",
    language: "Language",
    legal: "Legal",
    license:
      "Fair source under the Functional Source License (FSL-1.1-ALv2); the SDKs are under the Apache License 2.0.",
    captions: { end: "fair source · self-hostable", start: "peal.social" },
    source: "Source code on GitHub",
    withdraw: "Withdraw from contract here",
  },
  home: {
    description:
      "Write a post once, schedule it across platforms and see how it performs. Built for teams, self-hostable and fair source.",
    fairSource: {
      body: "The source is public under the Functional Source License. Use it, change it and run it for anything but a competing service, and each release becomes Apache 2.0 two years after it ships.",
      title: "Fair source",
    },
    features: [
      {
        body: "Draft a post in one editor, then adjust it for each platform where it needs to differ.",
        title: "Write once",
      },
      {
        body: "Pick the accounts and the time. Each post goes out when it is due, in the time zone you chose, daylight saving included.",
        title: "Schedule across platforms",
      },
      {
        body: "Each platform’s metrics come back to one place, so you can see what worked without opening every app.",
        title: "See results",
      },
      {
        body: "Bring your team into an organisation, give each person a role, and write, review and schedule together.",
        title: "Work as a team",
      },
    ],
    featuresTitle: "What we are building",
    hero: {
      lead: "Peal is a social media scheduling platform for teams. Write a post once, schedule it across platforms and follow its results in one place.",
      primary: "See how it works",
      secondary: "Run it yourself",
      status:
        "In development: not released yet. This is what Peal is being built to do.",
      title: "Write once. Schedule everywhere. See what works.",
    },
    selfHost: {
      body: "A self-hosted instance needs only Postgres and an S3-compatible store. Email, billing, captcha, AI and telemetry are optional, and each one has a self-hostable choice.",
      docs: "Read the self-hosting guide",
      title: "Run it yourself",
    },
    title: "Peal: schedule social media posts across platforms",
    unconfirmed: {
      body: "When a platform does not confirm that a post went out, Peal marks it unconfirmed and asks you to check, instead of posting it again blindly.",
      title: "No blind reposts",
    },
  },
  legal: {
    "data-deletion": "Data deletion",
    privacy: "Privacy policy",
    terms: "Terms of service",
  },
  nav: {
    allPlatforms: {
      caption: "every platform",
      description:
        "What a post may hold on each platform, and how to connect it.",
      title: "Compare the platforms",
    },
    blog: "Blog",
    brand: "Peal",
    developers: "For developers and agents",
    discord: "Discord",
    docs: "Docs",
    drawer: { close: "Close the menu", open: "Open the menu", title: "Menu" },
    getStarted: "Get started",
    github: "GitHub",
    home: "Peal home page",
    launch: {
      caption: "latest launch",
      description:
        "Post to a Discord channel or a Telegram chat from the same composer as every other platform.",
      title: "Discord and Telegram",
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
      changelog: {
        description: "Every release and what changed in it.",
        title: "Changelog",
      },
      cli: {
        description: "The peal command, with answers as JSON.",
        title: "Command line",
      },
      composer: {
        description: "Write once, adjust each platform, preview them all.",
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
        description: "Whether Peal is up, and past incidents.",
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
        "The source is public: read it, run it yourself, and follow every release.",
      title: "Star us on GitHub",
    },
    stars: "stars",
    studio: "Studio, for marketing teams",
  },
  pricing: {
    coming: "Coming soon: prices to be announced",
    dayRule:
      "Counted by the day: each UTC day of the month counts the most accounts connected at once that day, across every workspace of the billing account, for days {first} to {days} only (day {after} is never counted). The month's account-days are added up and divided by {days}, and that number of accounts goes through the ladder, so the first {freeDays} account-days are free. An account you disconnect stops counting from the next day, and nothing else is charged for accounts: no fee of any kind.",
    description:
      "Peal Cloud's prices: per connected account, by the day, with your first accounts free, in US dollars, excluding VAT and with France's VAT.",
    examples: {
      accounts: "Accounts",
      caption: "What a month costs, each account connected all month",
      lead: "With every account connected all month.",
      month: "A month",
      title: "What a month costs",
    },
    ladder: {
      free: "Free",
      last: "Accounts {from} and up",
      accounts: "Accounts",
      caption: "The ladder, per account and month",
      lead: "One ladder per billing account: the person, or the partner, who pays for its workspaces. The month's accounts, counted by the day as below, are priced band by band: the first ones cost nothing, and each further band costs less.",
      perAccount: "{price} per account a month",
      price: "A month, per account",
      range: "Accounts {from} to {to}",
      title: "Connected accounts",
    },
    lead: "Pay for the accounts you connect, by the day: your first {free} are free, and each one costs less the more you connect. Members, workspaces and posts are unlimited, and every account has every platform, the calendar, analytics, the API, the MCP server and the command line.",
    legal: {
      billing:
        "Billed each month, on the first, for the month past: nothing is paid in advance.",
      cancel:
        "Cancel online at any time, with “Cancel your contract”, at the foot of every page and on the billing page, signed in or not: billing ends with the month, whose use is invoiced, and nothing more is charged.",
      legacy:
        "A subscription to one of the earlier plans, priced by channels, keeps its plan and price until it ends.",
      prices:
        "A price change is announced by email 30 days ahead: you may cancel before it applies.",
      terms: "Read the terms of service",
      title: "Clear terms",
      withdrawal:
        "As a consumer, you may withdraw within 14 days of subscribing, with “Withdraw from contract here”, at the foot of every page and on the billing page: the subscription ends at once, and you pay only for what was used until then.",
    },
    meters: {
      allowance: "{count} a month included",
      xIncluded: "Nothing included",
      lead: "What costs Peal by use has a monthly allowance per billing account, across all its workspaces, from the first of each month (UTC). Without a payment method, such a use pauses at its allowance until the next month; with one, each unit past it is billed. Until your first invoice is paid, what usage bills is capped.",
      names: {
        assistantImages: "Writing assistant images",
        assistantRequests: "Writing assistant",
        managedAds: "Managed ads",
        outboundMessages: "Inbox messages sent",
        xApi: "X's API",
      },
      notes: {
        assistantImages:
          "Needs a payment method. A workspace's own image provider costs nothing, on any plan.",
        assistantRequests:
          "Needs a payment method. A workspace's own text provider costs nothing, on any plan.",
        managedAds:
          "Each ad active in the month, among those Peal manages for you.",
        outboundMessages:
          "Each reply sent from the inbox, to a message or a comment.",
        xApi: "Passed through at X's published rates, with nothing added. Needs a payment method.",
      },
      prices: {
        assistantImages: "then {price} per image",
        assistantRequests: "then {price} per request",
        managedAds: "then {price} per active ad a month",
        outboundMessages:
          "then {price} for {per} messages, billed by the message",
        xApi: "at X's rates",
      },
      title: "Usage",
      x: {
        ceiling:
          "What X bills a month stops at a ceiling of {ceiling} excluding tax by default, which you change on your billing page.",
        lead: "X bills each call to its API. Peal passes it on at X's published pay-per-use rates, with nothing added: here are those a scheduler uses. A post's counts and an account's followers are read only for the workspaces that turn X's reads on, and each one once a UTC day.",
        names: {
          postCreate: "A post sent",
          postCreateWithUrl: "A post sent with a link",
          postRead: "A post's counts read",
          userRead: "An account's followers read",
        },
        readOn:
          "X's rates as read on X's developer pricing page on {day}. X may change them: the billing page always shows those billed.",
        title: "X's rates",
      },
    },
    nav: "Pricing",
    partMonth: {
      body: "{allMonth} accounts connected all month, plus {extras}, come to {accountDays} account-days. Divided by {days}, that is {units} accounts through the ladder: {price} for the month.",
      extra: "one for {days}",
      title: "A month not held in full",
    },
    selfHost:
      "A server you run yourself bills nothing and limits nothing: these prices are Peal Cloud's.",
    api: {
      body: "Each API key, and each application acting for a member, sends {without} requests a minute to the API and the MCP server together without a payment method, and {withPaymentMethod} with one; {onRequest} on request.",
      title: "API rate limit",
    },
    storage: {
      body: "Fair use, across every workspace of the billing account: {without} without a payment method; with one, {perAccount} per connected account, {minimum} at least.",
      title: "Media storage",
    },
    taxes: {
      currency:
        "At checkout you can pay in your own currency, converted by our payment provider at the day's rate; otherwise your card is charged in US dollars.",
      excluded: "Prices are in US dollars and exclude tax.",
      reverseCharge:
        "A business with a valid VAT number pays the price excluding VAT, the VAT being reverse-charged; in France, French VAT applies.",
      shown:
        "Each price is shown excluding VAT and with France's {rate}% VAT, in US dollars.",
      vat: "The VAT you pay depends on your country: it is added at checkout for customers in the EU, at their country's rate.",
      withVat: "{excluded} excl. VAT · {included} with France's {rate}% VAT",
    },
    title: "Pricing",
    unlimited: {
      items: [
        "Unlimited members",
        "Unlimited workspaces",
        "Unlimited posts",
        "Every platform, the calendar, analytics, the API, the MCP server and the command line",
      ],
      title: "With every account",
    },
  },
};

export type Messages = typeof en;

const fr: Messages = {
  draft: {
    body: "Ce document n’est pas encore en vigueur. Le texte entre crochets reste à rédiger.",
    title: "Projet en attente de relecture juridique",
  },
  footer: {
    cancel: "Résilier votre contrat",
    contract: "Votre contrat",
    follow: "Suivre Peal",
    language: "Langue",
    legal: "Informations juridiques",
    license:
      "Fair source sous la Functional Source License (FSL-1.1-ALv2) ; les SDK sont sous licence Apache 2.0.",
    captions: { end: "fair source · auto-hébergeable", start: "peal.social" },
    source: "Code source sur GitHub",
    withdraw: "Renoncer au contrat ici",
  },
  home: {
    description:
      "Écrivez une publication une fois, planifiez-la sur plusieurs plateformes et suivez ses résultats. Pensé pour les équipes, auto-hébergeable et fair source.",
    fairSource: {
      body: "Le code source est public, sous la Functional Source License. Utilisez-le, modifiez-le et faites-le tourner pour tout usage sauf un service concurrent ; chaque version passe sous licence Apache 2.0 deux ans après sa sortie.",
      title: "Fair source",
    },
    features: [
      {
        body: "Rédigez une publication dans un seul éditeur, puis ajustez-la pour chaque plateforme là où elle doit différer.",
        title: "Écrire une fois",
      },
      {
        body: "Choisissez les comptes et l’heure. Chaque publication part à l’échéance, dans le fuseau horaire choisi, changements d’heure compris.",
        title: "Planifier sur plusieurs plateformes",
      },
      {
        body: "Les statistiques de chaque plateforme reviennent au même endroit : vous voyez ce qui a fonctionné sans ouvrir chaque application.",
        title: "Suivre les résultats",
      },
      {
        body: "Réunissez votre équipe dans une organisation, donnez un rôle à chacun, et rédigez, relisez et planifiez ensemble.",
        title: "Travailler en équipe",
      },
    ],
    featuresTitle: "Ce que nous construisons",
    hero: {
      lead: "Peal est une plateforme de planification pour les réseaux sociaux, pensée pour les équipes. Écrivez une publication une fois, planifiez-la sur plusieurs plateformes et suivez ses résultats au même endroit.",
      primary: "Voir comment ça marche",
      secondary: "L’héberger soi-même",
      status:
        "En cours de développement : pas encore sorti. Voici ce que Peal est conçu pour faire.",
      title: "Écrire une fois. Planifier partout. Voir ce qui marche.",
    },
    selfHost: {
      body: "Une instance auto-hébergée n’a besoin que de Postgres et d’un stockage compatible S3. L’e-mail, la facturation, le captcha, l’IA et la télémétrie sont facultatifs, et chacun a une option auto-hébergeable.",
      docs: "Lire le guide d’auto-hébergement",
      title: "L’héberger soi-même",
    },
    title: "Peal : planifiez vos publications sur les réseaux sociaux",
    unconfirmed: {
      body: "Quand une plateforme ne confirme pas qu’une publication est partie, Peal la marque comme non confirmée et vous demande de vérifier, au lieu de republier à l’aveugle.",
      title: "Pas de republication à l’aveugle",
    },
  },
  legal: {
    "data-deletion": "Suppression des données",
    privacy: "Politique de confidentialité",
    terms: "Conditions d’utilisation",
  },
  nav: {
    allPlatforms: {
      caption: "toutes les plateformes",
      description:
        "Ce qu’une publication peut contenir sur chaque plateforme, et comment la connecter.",
      title: "Comparer les plateformes",
    },
    blog: "Blog",
    brand: "Peal",
    developers: "Pour les développeurs et les agents",
    discord: "Discord",
    docs: "Documentation",
    drawer: { close: "Fermer le menu", open: "Ouvrir le menu", title: "Menu" },
    getStarted: "Commencer",
    github: "GitHub",
    home: "Accueil de Peal",
    launch: {
      caption: "dernière nouveauté",
      description:
        "Publiez dans un salon Discord ou une conversation Telegram depuis le même éditeur que pour les autres plateformes.",
      title: "Discord et Telegram",
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
          "Écrire une fois, ajuster par plateforme, tout prévisualiser.",
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
        description: "Si Peal fonctionne, et les incidents passés.",
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
        "Le code est public : lisez-le, hébergez-le vous-même et suivez chaque version.",
      title: "Une étoile sur GitHub",
    },
    stars: "étoiles",
    studio: "Studio, pour les équipes marketing",
  },
  pricing: {
    coming: "Bientôt : tarifs à venir",
    dayRule:
      "Compté au jour : chaque jour UTC du mois compte le plus grand nombre de comptes connectés en même temps ce jour-là, dans tous les espaces de travail du compte de facturation, pour les jours {first} à {days} seulement (le jour {after} n’est jamais compté). Les jours-comptes du mois sont additionnés et divisés par {days}, et ce nombre de comptes passe au barème : les {freeDays} premiers jours-comptes sont donc gratuits. Un compte que vous déconnectez cesse de compter dès le lendemain, et rien d’autre n’est facturé pour les comptes : aucuns frais.",
    description:
      "Les tarifs de Peal Cloud : au compte connecté, au jour, vos premiers comptes gratuits, en dollars américains, HT et avec la TVA française.",
    examples: {
      accounts: "Comptes",
      caption: "Ce que coûte un mois, chaque compte connecté tout le mois",
      lead: "Chaque compte connecté tout le mois.",
      month: "Par mois",
      title: "Ce que coûte un mois",
    },
    ladder: {
      free: "Gratuit",
      last: "Comptes {from} et au-delà",
      accounts: "Comptes",
      caption: "Le barème, par compte et par mois",
      lead: "Un barème par compte de facturation : la personne, ou le partenaire, qui paie ses espaces de travail. Les comptes du mois, comptés au jour comme ci-dessous, sont facturés tranche par tranche : les premiers ne coûtent rien, et chaque tranche suivante coûte moins.",
      perAccount: "{price} par compte et par mois",
      price: "Par mois et par compte",
      range: "Comptes {from} à {to}",
      title: "Comptes connectés",
    },
    lead: "Payez les comptes que vous connectez, au jour : vos {free} premiers sont gratuits, et chacun coûte moins à mesure que vous en connectez. Membres, espaces de travail et publications sont illimités, et chaque compte comprend toutes les plateformes, le calendrier, les statistiques, l’API, le serveur MCP et la ligne de commande.",
    legal: {
      billing:
        "Facturé chaque mois, le premier, pour le mois écoulé : rien n’est payé d’avance.",
      cancel:
        "Résiliez en ligne à tout moment, avec « Résilier votre contrat », au pied de chaque page et sur la page de facturation, connecté ou non : la facturation prend fin avec le mois, dont l’usage est facturé, et plus rien n’est facturé ensuite.",
      legacy:
        "Un abonnement à l’une des offres précédentes, au nombre de canaux, garde son offre et son prix jusqu’à sa fin.",
      prices:
        "Un changement de prix est annoncé par e-mail 30 jours à l’avance : vous pouvez résilier avant qu’il s’applique.",
      terms: "Lire les conditions d’utilisation",
      title: "Des conditions claires",
      withdrawal:
        "En tant que consommateur, vous pouvez vous rétracter dans les 14 jours suivant la souscription, avec « Renoncer au contrat ici », au pied de chaque page et sur la page de facturation : l’abonnement prend fin immédiatement, et vous ne payez que ce qui a été utilisé jusque-là.",
    },
    meters: {
      allowance: "{count} inclus par mois",
      xIncluded: "Rien d’inclus",
      lead: "Ce qui coûte à Peal à l’usage a une franchise mensuelle par compte de facturation, pour tous ses espaces de travail, à partir du premier de chaque mois (UTC). Sans moyen de paiement, cet usage s’interrompt à sa franchise jusqu’au mois suivant ; avec un moyen de paiement, chaque unité au-delà est facturée. Tant que votre première facture n’est pas payée, ce que l’usage facture est plafonné.",
      names: {
        assistantImages: "Images de l’assistant de rédaction",
        assistantRequests: "Assistant de rédaction",
        managedAds: "Publicités gérées",
        outboundMessages: "Messages envoyés depuis la boîte de réception",
        xApi: "API de X",
      },
      notes: {
        assistantImages:
          "Demande un moyen de paiement. Le fournisseur d’images d’un espace de travail ne coûte rien, quelle que soit l’offre.",
        assistantRequests:
          "Demande un moyen de paiement. Le fournisseur de texte d’un espace de travail ne coûte rien, quelle que soit l’offre.",
        managedAds:
          "Chaque publicité active dans le mois, parmi celles que Peal gère pour vous.",
        outboundMessages:
          "Chaque réponse envoyée depuis la boîte de réception, à un message ou à un commentaire.",
        xApi: "Refacturée aux tarifs publiés par X, sans rien ajouter. Demande un moyen de paiement.",
      },
      prices: {
        assistantImages: "puis {price} par image",
        assistantRequests: "puis {price} par demande",
        managedAds: "puis {price} par publicité active et par mois",
        outboundMessages:
          "puis {price} pour {per} messages, facturé au message",
        xApi: "aux tarifs de X",
      },
      title: "Usage",
      x: {
        ceiling:
          "Ce que X facture dans un mois s’arrête par défaut à un plafond de {ceiling} hors taxes, que vous modifiez sur votre page de facturation.",
        lead: "X facture chaque appel à son API. Peal le refacture aux tarifs à l’usage publiés par X, sans rien ajouter : voici ceux dont se sert un outil de programmation. Les chiffres d’une publication et les abonnés d’un compte ne sont lus que pour les espaces de travail qui activent la lecture de X, et chacun une fois par jour UTC.",
        names: {
          postCreate: "Une publication envoyée",
          postCreateWithUrl: "Une publication envoyée avec un lien",
          postRead: "Les chiffres d’une publication lus",
          userRead: "Les abonnés d’un compte lus",
        },
        readOn:
          "Tarifs de X relevés sur sa page de tarifs pour développeurs le {day}. X peut les changer : la page de facturation montre toujours ceux qui sont facturés.",
        title: "Les tarifs de X",
      },
    },
    nav: "Tarifs",
    partMonth: {
      body: "{allMonth} comptes connectés tout le mois, plus {extras}, font {accountDays} jours-comptes. Divisés par {days}, cela fait {units} comptes passés au barème : {price} pour le mois.",
      extra: "un pendant {days}",
      title: "Un mois incomplet",
    },
    selfHost:
      "Un serveur que vous hébergez vous-même ne facture rien et ne limite rien : ces tarifs sont ceux de Peal Cloud.",
    api: {
      body: "Chaque clé d’API, et chaque application qui agit pour un membre, envoie {without} requêtes par minute à l’API et au serveur MCP réunis sans moyen de paiement, et {withPaymentMethod} avec un moyen de paiement ; {onRequest} sur demande.",
      title: "Limite de débit de l’API",
    },
    storage: {
      body: "Usage raisonnable, pour tous les espaces de travail du compte de facturation : {without} sans moyen de paiement ; avec un moyen de paiement, {perAccount} par compte connecté, {minimum} au moins.",
      title: "Stockage des médias",
    },
    taxes: {
      currency:
        "Au paiement, vous pouvez régler dans votre propre devise, convertie par notre prestataire de paiement au taux du jour ; sinon, votre carte est débitée en dollars américains.",
      excluded: "Les prix sont fixés en dollars américains, hors taxes.",
      reverseCharge:
        "Une entreprise avec un numéro de TVA valide paie le prix HT, la TVA étant autoliquidée ; en France, la TVA française s’applique.",
      shown:
        "Chaque prix est affiché HT et avec la TVA française de {rate} %, en dollars américains.",
      vat: "La TVA que vous payez dépend de votre pays : elle est ajoutée au paiement pour les clients de l’UE, au taux de leur pays.",
      withVat: "{excluded} HT · {included} avec la TVA française de {rate} %",
    },
    title: "Tarifs",
    unlimited: {
      items: [
        "Membres illimités",
        "Espaces de travail illimités",
        "Publications illimitées",
        "Toutes les plateformes, le calendrier, les statistiques, l’API, le serveur MCP et la ligne de commande",
      ],
      title: "Avec chaque compte",
    },
  },
};

const catalogues: Record<Locale, Messages> = { en, fr };

export const messages = (locale: Locale): Messages => catalogues[locale];

/** Each locale's name, written in that language, for the language switcher. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};
