import { chromeMessages } from "peal-ui/lib/site/messages";

import type { Locale } from "./locales.ts";

// Every string the site shows, per locale. The header's and the footer's
// come from peal-ui, which the blog shares. Long-form
// legal text lives in the `legal` content collection instead
// (src/content/legal/<locale>/).

const en = {
  ...chromeMessages("en"),
  draft: {
    body: "This document is not in force yet. Text in square brackets is still to be written.",
    title: "Draft pending legal review",
  },
  home: {
    api: {
      action: "Explore the docs",
      connect: {
        asks: "{host} asks to connect your accounts on these platforms, to publish there for you.",
        connect: "Connect {platform}",
        connected: ":: Connected",
        heading: "Connect your accounts",
        partner: "Example Studio",
      },
      copied: "Copied",
      copy: "Copy",
      demoLabel: "Ways to publish",
      eyebrow: "PealAPI",
      lead: "Use the HTTP API, which comes with an OpenAPI document, the MCP server for AI agents, the command line or an SDK in one of eight languages. Whichever you pick, you're working in the same workspaces your team opens in PealCreative.",
      rows: {
        cli: {
          link: "The command line",
          text: "Sign in to the peal command with your Peal account, or give it an API key. It answers in JSON, so your scripts and agents can read it.",
          title: "Command line",
        },
        embedding: {
          link: "Embedding Peal",
          text: "Give each of your customers a workspace and send them a connect link. It opens a page Peal hosts, where they sign in to their own accounts and then return to your product.",
          title: "Embedding kit",
        },
        mcp: {
          link: "Connect an MCP client",
          text: "Connect an AI assistant to one workspace. If you untick publishing on the consent page, it can still write drafts, and Peal refuses any call that would schedule or publish.",
          title: "MCP server",
        },
        publish: {
          link: "API quickstart",
          text: "Send one post to several channels in a single request. Ask it to wait, and the answer comes back once every channel has its result.",
          title: "Publishing API",
        },
        sdks: {
          link: "Install an SDK",
          text: "TypeScript, Python, Go, Ruby, Java, PHP, .NET and Rust clients, generated from the same API contract.",
          title: "SDKs in eight languages",
        },
        webhooks: {
          link: "Webhooks",
          text: "Peal sends a signed request to your endpoint when something happens in a workspace, such as a post going live on a channel. An event carries ids, states and links, never the post's text.",
          title: "Webhooks",
        },
      },
      title: { text: "Or build Peal into your own product." },
    },
    cta: {
      line: "It's free to start, and every line of code is public on GitHub.",
      primary: "Get started",
      secondary: "Read the docs",
      title: "Start posting with Peal",
    },
    hardParts: {
      cells: {
        approvals: {
          label: "Approvals",
          lead: "Your client says yes first.",
          text: "Send a review link to someone who doesn't have a Peal account. They comment, and the post waits until they approve it.",
        },
        inbox: {
          label: "Inbox",
          lead: "Replies in one place.",
          text: "Answer the comments under your posts, your Google Business Profile reviews, and your Mastodon and Bluesky direct messages from one inbox.",
        },
        limits: {
          label: "Platform limits",
          lead: "Checked before you schedule.",
          text: "Peal counts your text against each platform's limit and checks your images and videos against what it accepts. If something's over, it tells you what to fix.",
        },
        media: {
          label: "Media",
          lead: "Sent the way each platform takes it.",
          text: "Where a platform wants a file in parts, Peal uploads it in parts. Then it waits for the platform to finish processing before your post goes out.",
        },
        timeZones: {
          label: "Time zones",
          lead: "Your time, daylight saving included.",
          text: "Pick a time zone, and your post goes out when a clock there shows the time you set.",
        },
        unconfirmed: {
          label: "No blind reposts",
          lead: "When a platform doesn't answer, Peal asks you.",
          text: "If a post may have gone out but the platform never replied, Peal marks it unconfirmed. It won't send it again on its own, because you'd risk posting twice.",
        },
      },
      eyebrow: "Under the hood",
      lead: "What Peal checks and does between your post and each network.",
      title: {
        muted: "A post goes out once, in the form each platform wants.",
        text: "We handle the hard parts.",
      },
    },
    mock: {
      approval: ":: Needs approval",
      check: ":: Check the platform",
      comment: "Comment",
      // Made-up posts for the mocks, with example.com's address.
      longPost:
        "Our spring catalogue is out. Forty new prints this season, from botanical studies to city maps, each printed on recycled paper and shipped flat in a reusable tube. Order before Sunday and we add a free frame to every second print. Read the whole catalogue at https://example.com/spring and tell us which one you would hang first.",
      message: "Direct message",
      post: "Our spring catalogue is out: forty new prints, printed on recycled paper. Read it at https://example.com/spring",
      shortPost:
        "Spring catalogue: forty new prints. https://example.com/spring",
      over: ":: Over the limit",
      processed: ":: Processed",
      published: ":: Published",
      publishing: ":: Publishing…",
      review: "Review",
      scheduled: ":: Scheduled",
      unconfirmed: ":: Unconfirmed",
      uploading: ":: Uploading",
      within: ":: Within the limit",
    },
    open: {
      cells: {
        platforms: {
          label: "Platforms",
          lead: "{platforms} platforms.",
          text: "Social networks, chats and blogs, from one composer and one API.",
        },
        repository: {
          label: "Fair source",
          lead: "Apache 2.0 after two years.",
          pulls: "merged lately",
          stars: "stars",
          text: "The source is under the Functional Source License, and each release becomes Apache 2.0 two years after it ships.",
        },
        sdks: {
          label: "SDKs",
          lead: "Eight languages.",
          text: "TypeScript, Python, Go, Ruby, Java, PHP, .NET and Rust clients, generated from the same API contract.",
        },
        selfHosting: {
          label: "Self-hosting",
          lead: "Postgres and an S3-compatible store.",
          link: "Read the self-hosting guide",
          text: "That's all a server needs. Email, billing, captcha, AI and telemetry are optional.",
        },
      },
      eyebrow: "Built in the open",
      lead: "The code, the API contract and the SDKs are public on GitHub.",
      title: {
        muted: "You can read the code and run it yourself.",
        text: "Built in the open.",
      },
    },
    platforms: {
      api: "Publish from your code, an AI agent or your own product.",
      eyebrow: "One foundation",
      lead: "PealCreative and PealAPI are two sides of one app. You switch between them in the sidebar.",
      mock: {
        apiKeys: "API keys",
        deliveries: "Webhook deliveries",
        keys: ["Publishing bot", "Analytics export"],
        groups: { build: "Build", engage: "Engage", partners: "Partners" },
        pages: {
          ads: "Ads",
          analytics: "Analytics",
          apiKeys: "API keys",
          calendar: "Calendar",
          channels: "Channels",
          home: "Home",
          inbox: "Inbox",
          media: "Media",
          partner: "Partner",
          platforms: "Platforms",
          posts: "Posts",
          webhooks: "Webhooks",
        },
        days: ["Mon 17", "Tue 18"],
        settings: "Settings",
        workspace: "Maple",
      },
      studio: "Write, schedule, approve and measure posts as a team.",
      title: {
        muted:
          "The same workspaces, channels and posts, whichever side you work from.",
        text: "Two platforms built on the same foundation.",
      },
    },
    sections: {
      api: "PealAPI",
      faq: "FAQ",
      hardParts: "Under the hood",
      open: "In the open",
      platforms: "Products",
      studio: "PealCreative",
    },
    studio: {
      action: "Learn more",
      cards: {
        approvals: {
          label: "Approvals",
          lead: "Your client approves without an account.",
          link: "Review and approval",
          text: "Send them a review link. They read the post, comment and approve it. Until they do, the post doesn't go out.",
        },
        composer: {
          label: "Composer",
          lead: "One post, a preview per platform.",
          link: "Write a post",
          text: "Give any channel its own text and options. Peal counts each platform's limit before you schedule.",
        },
      },
      eyebrow: "PealCreative",
      lead: "Write a post once and adjust it where a platform needs something different. Schedule it on the calendar and send your client a link to approve it. Once it's out, answer the comments from the inbox and see how it did.",
      review: {
        approve: "Approve this post",
        badge: "Reviewer",
        comment: "Could we add the shop's opening hours?",
        name: "Sam Reviewer",
        requestChanges: "Request changes",
      },
      tiles: {
        analytics: {
          label: "Analytics",
          text: "See the numbers for every post and account, find the posts that did best, and export them.",
        },
        assistant: {
          label: "Writing assistant",
          text: "Ask AI to write, rewrite, shorten or translate a post, or to suggest hashtags.",
        },
        calendar: {
          label: "Calendar",
          text: "Schedule in your own time zone, then move or cancel posts on the calendar.",
        },
        inbox: {
          label: "Inbox",
          text: "Comments, Google Business Profile reviews and Mastodon and Bluesky messages in one place.",
        },
      },
      title: { text: "Plan, write and approve posts as a team." },
    },
    description:
      "PealCreative for marketing teams and PealAPI for developers and agents: write a post once, schedule it across platforms and see how it performs. Self-hostable and fair source.",
    faq: {
      groups: [
        {
          questions: [
            {
              answer:
                "Peal is a social media scheduling platform, and it comes as two products. Marketing teams write, schedule, approve and measure posts in PealCreative. Developers and AI agents publish through PealAPI, from their own code or product.",
              question: "What is Peal?",
            },
            {
              answer:
                "Marketing teams, who work in PealCreative, and developers, who build on PealAPI or embed Peal in their own product.",
              question: "Who is it for?",
            },
            {
              answer:
                "They're two ways into the same workspace. PealCreative is the web app where a team writes, schedules and approves posts and reads its analytics. PealAPI is the HTTP API with its MCP server, command line, SDKs, webhooks and embedding kit, for code and AI agents. A post made from one shows up in the other.",
              question:
                "What is the difference between PealCreative and PealAPI?",
            },
            {
              answer:
                "Yes, through PealAPI. An AI assistant connects through the MCP server, signed in to one workspace, and you choose whether it may publish.",
              question: "Can an AI agent use Peal?",
            },
          ],
          title: "General",
        },
        {
          questions: [
            {
              answer:
                "Social networks: {social}. Chats: {chat}. Blogs: {blog}. Ad accounts can be connected too, on a server that turns ads on: {ads}.",
              question: "Which platforms does Peal publish to?",
            },
            {
              answer:
                "Yes. A post has one text, and any channel can have its own text and options. Peal counts each platform's limits and shows a preview for each.",
              question: "Can a post differ from one platform to another?",
            },
            {
              answer:
                "Yes. Your client doesn't need a Peal account to see the post, comment on it and approve it before it goes out.",
              question: "Can a client approve a post first?",
            },
            {
              answer:
                "Peal marks it unconfirmed and asks you to check, instead of posting it again blindly.",
              question: "What if a platform doesn't confirm a post?",
            },
          ],
          title: "Platforms and publishing",
        },
        {
          questions: [
            {
              answer:
                "Yes. A server needs Postgres and an S3-compatible store. Email, billing, captcha, AI and telemetry are optional, and each one has an option you can host yourself.",
              question: "Can I run Peal on my own server?",
            },
            {
              answer:
                "The Functional Source License (FSL-1.1-ALv2). You can use the code, change it and run it for anything except a competing service. Each release becomes Apache 2.0 two years after it ships.",
              question: "Under which licence is the source?",
            },
            {
              answer:
                "The SDKs, in eight languages, are under the Apache License 2.0, as is the API contract they're generated from.",
              question: "Are the SDKs under the same licence?",
            },
            {
              answer:
                "No. If you don't configure a payment provider, your server bills nothing and limits nothing.",
              question: "Does a self-hosted server charge for accounts?",
            },
          ],
          title: "Self-hosting and licence",
        },
        {
          questions: [
            {
              answer:
                "You pay per connected account, counted by the day, in US dollars. Your first {free} accounts are free, and each band after that costs less per account.",
              question: "How is Peal Cloud priced?",
            },
            {
              answer:
                "Members, workspaces and posts are unlimited. Every account has every platform, the calendar and analytics in PealCreative, and the API, the MCP server and the command line in PealAPI.",
              question: "What comes with every account?",
            },
            {
              answer:
                "A few things cost us money each time you use them, such as the writing assistant or X's API, so they come with a monthly allowance. Once you're past it, they pause until the next month, or we bill them if you've added a payment method.",
              question: "Is anything billed by use?",
            },
            {
              answer:
                "Yes, online, at any time. We bill you each month for the month that just ended, and billing stops at the end of the month you cancel in.",
              question: "Can I cancel?",
            },
          ],
          title: "Pricing",
        },
      ],
      label: "FAQ",
      lead: "Short answers here, and the details in the docs.",
      title: {
        muted: "Plain answers, before you start.",
        text: "Frequently asked questions.",
      },
    },
    hero: {
      chips: {
        api: "PealAPI in the docs",
        restApi: "REST API",
        studio: "PealCreative in the docs",
      },
      composer: {
        action: "Schedule",
        author: "Peal Example",
        channels: "Channels",
        preview: "Preview",
        text: "Text",
        time: "Tue 09:00 · Europe/Paris",
      },
      lead: "Your team plans, writes and approves posts in PealCreative. Your code and your AI agents publish through PealAPI.",
      primary: "Get started",
      secondary: "Read the docs",
      stage: "Peal's products",
      title:
        "Full-stack social media scheduling for marketing teams and agents",
    },
    title: "Peal: schedule social media posts across platforms",
  },
  pricing: {
    ...chromeMessages("en").pricing,
    // The calculator at the top of the page (peal-ui's AccountPricer).
    calculator: {
      average: "{price} per account on average",
      cloud: { line: "We run it for you.", title: "Peal Cloud" },
      excluded: "excl. VAT",
      free: "Free",
      label: "Connected accounts",
      last: "{from} and up",
      perAccount: "{price} each a month",
      perMonth: "a month",
      range: "{from} to {to}",
      valueText: "{count} accounts",
      decrease: "Remove an account",
      increase: "Add an account",
    },
    coming: "Coming soon: prices to be announced",
    headline: {
      muted: "Your first {free} are free.",
      text: "One price per connected account.",
    },
    selfHosted: {
      items: [
        "Every feature, nothing limited",
        "Your data stays on your server",
        "The code is public on GitHub",
      ],
      link: "Self-hosting guide",
      price: "Free",
      title: "Self-hosted",
    },
    enterprise: {
      items: [
        "A price for your volume",
        "A higher API rate limit",
        "Terms agreed with us",
      ],
      line: "For large teams, agencies and partners.",
      price: "Custom",
      subject: "Peal Enterprise",
      talk: "Talk to sales",
      title: "Enterprise",
    },
    // The table of features and rates (peal-ui's RateCard).
    rateCard: {
      cloudLine: "Your first {free} accounts free",
      eyebrow: "Features",
      features: {
        ads: {
          name: "Ads",
          note: "Boost posts and follow your campaigns' results.",
        },
        analytics: {
          name: "Analytics",
          note: "Each post's and account's figures, the best times to post, and exports.",
        },
        articles: {
          name: "Articles",
          note: "Publish articles to blogs, with their images.",
        },
        assistant: {
          name: "Writing assistant",
          note: "Write, rewrite, shorten or translate a post.",
        },
        chats: {
          name: "Chats",
          note: "Post to your channels and groups like any other platform.",
        },
        developers: {
          name: "API, MCP server, command line and SDKs",
          note: "Schedule, publish and read your posts from your code and your AI agents.",
        },
        inbox: {
          name: "Inbox",
          note: "Comments, reviews and direct messages, answered in one place.",
        },
        publishing: {
          name: "Scheduling and publishing",
          note: "Posts, threads and first comments, the calendar, queues and approvals.",
        },
        team: {
          name: "Members and workspaces",
          note: "Your team and your clients, each workspace with its own channels.",
        },
        webhooks: {
          name: "Webhooks",
          note: "What happens in a workspace, sent to your server as it happens.",
        },
      },
      groups: {
        limits: "Limits",
        usage: "Usage",
        x: "X's API",
      },
      tags: {
        ads: "Ad networks",
        articles: "Blogs",
        chats: "Chats",
        publishing: "Social platforms",
      },
      title: "Every feature on every account",
      values: {
        custom: "Custom",
        included: "Included",
        unlimited: "Unlimited",
      },
    },
    dayRule:
      "We count accounts by the day. Each UTC day counts the most accounts you had connected at once that day, across every workspace of the billing account. Only days {first} to {days} count (day {after} never does). We add up the month's account-days and divide by {days}, and that number of accounts goes through the ladder, so your first {freeDays} account-days are free. An account you disconnect stops counting the next day. We charge nothing else for accounts.",
    description:
      "Peal Cloud's prices: per connected account, by the day, with your first accounts free, in US dollars.",
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
      lead: "There's one ladder per billing account, which is the person or the partner who pays for its workspaces. We count the month's accounts by the day, as explained below, and price them band by band. The first ones cost nothing, and each band after that costs less per account.",
      perAccount: "{price} per account a month",
      price: "A month, per account",
      range: "Accounts {from} to {to}",
      title: "Connected accounts",
    },
    lead: "You pay for the accounts you connect, counted by the day, and each one costs less the more you connect. Members, workspaces and posts are unlimited, and there's no plan that holds features back.",
    legal: {
      billing:
        "We bill you on the first of each month for the month that just ended. You never pay in advance.",
      cancel:
        "You can cancel online at any time, signed in or not. Click “Cancel your contract” at the foot of any page or on the billing page. We invoice that month's use, billing ends with the month, and we charge nothing after it.",
      legacy:
        "A subscription to one of the earlier plans, priced by channels, keeps its plan and price until it ends.",
      prices:
        "We announce a price change by email 30 days ahead, so you can cancel before it applies.",
      terms: "Read the terms of service",
      title: "Clear terms",
      withdrawal:
        "If you're a consumer, you can withdraw within 14 days of subscribing. Click “Withdraw from contract here” at the foot of any page or on the billing page. Your subscription ends at once, and you pay only for what you used until then.",
    },
    meters: {
      allowance: "{count} a month included",
      xIncluded: "Nothing included",
      lead: "Each billing account gets a monthly allowance. Once you're past it, usage pauses if you have no payment method, and is billed if you have one.",
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
          "Capped at {ceiling} a month by default. Change it on your billing page.",
        lead: "X bills each call to its API. We pass that on at X's published pay-per-use rates and add nothing. These are the rates a scheduler uses. Peal reads a post's counts and an account's followers only in workspaces that turn X's reads on, and reads each one once per UTC day.",
        names: {
          postCreate: "A post sent",
          postCreateWithUrl: "A post sent with a link",
          postRead: "A post's counts read",
          userRead: "An account's followers read",
        },
        readOn: "Rates as of {day}. Your billing page shows the current ones.",
        title: "X's rates",
      },
    },
    partMonth: {
      body: "{allMonth} accounts connected all month, plus {extras}, come to {accountDays} account-days. Divided by {days}, that's {units} accounts through the ladder, or {price} for the month.",
      extra: "one for {days}",
      title: "Part of a month",
    },
    selfHost: "Run Peal on your own server. No fees, no limits.",
    api: {
      body: "{without} requests a minute per key without a payment method, {withPaymentMethod} with one, {onRequest} on request.",
      title: "API rate limit",
    },
    storage: {
      body: "{without} without a payment method. With one, {perAccount} per account, {minimum} minimum.",
      title: "Media storage",
    },
    taxes: {
      currency:
        "At checkout you can pay in your own currency, which our payment provider converts at the day's rate. Otherwise your card is charged in US dollars.",
      excluded: "Prices are in US dollars and exclude tax.",
      reverseCharge:
        "A business with a valid VAT number pays the price excluding VAT, because the VAT is reverse-charged. In France, French VAT applies.",
      shown:
        "All prices are in US dollars and exclude VAT. French VAT of {rate}% applies.",
      vat: "The VAT you pay depends on your country. For customers in the EU, it's added at checkout at their country's rate.",
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
  ...chromeMessages("fr"),
  draft: {
    body: "Ce document n’est pas encore en vigueur. Le texte entre crochets reste à rédiger.",
    title: "Projet en attente de relecture juridique",
  },
  home: {
    api: {
      action: "Explorer la documentation",
      connect: {
        asks: "{host} demande à connecter vos comptes sur ces plateformes, pour y publier pour vous.",
        connect: "Connecter {platform}",
        connected: ":: Connecté",
        heading: "Connecter vos comptes",
        partner: "Example Studio",
      },
      copied: "Copié",
      copy: "Copier",
      demoLabel: "Façons de publier",
      eyebrow: "PealAPI",
      lead: "Utilisez l’API HTTP, fournie avec son document OpenAPI, le serveur MCP pour les agents IA, la ligne de commande ou un SDK dans l’un des huit langages. Dans tous les cas, vous travaillez dans les mêmes espaces de travail que votre équipe ouvre dans PealCreative.",
      rows: {
        cli: {
          link: "La ligne de commande",
          text: "Connectez la commande peal avec votre compte Peal, ou donnez-lui une clé d’API. Elle répond en JSON, que vos scripts et vos agents savent lire.",
          title: "Ligne de commande",
        },
        embedding: {
          link: "Intégrer Peal",
          text: "Donnez un espace de travail à chacun de vos clients et envoyez-leur un lien de connexion. Il ouvre une page hébergée par Peal, où ils se connectent à leurs propres comptes avant de revenir dans votre produit.",
          title: "Kit d’intégration",
        },
        mcp: {
          link: "Connecter un client MCP",
          text: "Connectez un assistant IA à un espace de travail. Si vous décochez la publication sur la page de consentement, il peut toujours écrire des brouillons, et Peal refuse tout appel qui programmerait ou publierait.",
          title: "Serveur MCP",
        },
        publish: {
          link: "Démarrage rapide de l’API",
          text: "Envoyez une publication sur plusieurs canaux en une seule requête. Demandez-lui d’attendre, et la réponse arrive quand chaque canal a son résultat.",
          title: "API de publication",
        },
        sdks: {
          link: "Installer un SDK",
          text: "Des clients TypeScript, Python, Go, Ruby, Java, PHP, .NET et Rust, générés à partir du même contrat d’API.",
          title: "Des SDK dans huit langages",
        },
        webhooks: {
          link: "Webhooks",
          text: "Peal envoie une requête signée à votre adresse quand quelque chose se passe dans un espace de travail, par exemple quand une publication est en ligne sur un canal. Un événement porte des identifiants, des états et des liens, jamais le texte de la publication.",
          title: "Webhooks",
        },
      },
      title: { text: "Ou intégrez Peal à votre propre produit." },
    },
    cta: {
      line: "Vous commencez gratuitement, et tout le code est public sur GitHub.",
      primary: "Commencer",
      secondary: "Lire la documentation",
      title: "Commencez à publier avec Peal",
    },
    hardParts: {
      cells: {
        approvals: {
          label: "Approbations",
          lead: "Votre client dit oui d’abord.",
          text: "Envoyez un lien de relecture à quelqu’un qui n’a pas de compte Peal. Il commente, et la publication attend qu’il l’approuve.",
        },
        inbox: {
          label: "Boîte de réception",
          lead: "Les réponses au même endroit.",
          text: "Répondez aux commentaires sous vos publications, à vos avis Google Business Profile et à vos messages privés Mastodon et Bluesky depuis une seule boîte.",
        },
        limits: {
          label: "Limites des plateformes",
          lead: "Vérifiées avant la programmation.",
          text: "Peal compare votre texte à la limite de chaque plateforme et vérifie vos images et vos vidéos selon ce qu’elle accepte. Si quelque chose dépasse, il vous dit quoi corriger.",
        },
        media: {
          label: "Médias",
          lead: "Envoyés comme chaque plateforme les prend.",
          text: "Quand une plateforme veut un fichier en plusieurs morceaux, Peal l’envoie en morceaux. Il attend ensuite qu’elle ait fini de le traiter avant que votre publication parte.",
        },
        timeZones: {
          label: "Fuseaux horaires",
          lead: "Votre heure, changements d’heure compris.",
          text: "Choisissez un fuseau horaire, et votre publication part quand une horloge de ce fuseau affiche l’heure que vous avez réglée.",
        },
        unconfirmed: {
          label: "Pas de republication à l’aveugle",
          lead: "Quand une plateforme ne répond pas, Peal vous demande.",
          text: "Si une publication a pu partir sans que la plateforme réponde, Peal la marque non confirmée. Il ne la renvoie pas de lui-même, car vous risqueriez de publier deux fois.",
        },
      },
      eyebrow: "Sous le capot",
      lead: "Ce que Peal vérifie et fait entre votre publication et chaque réseau.",
      title: {
        muted:
          "Une publication part une fois, sous la forme que chaque plateforme attend.",
        text: "Nous gérons le plus difficile.",
      },
    },
    mock: {
      approval: ":: À approuver",
      check: ":: Vérifiez sur la plateforme",
      comment: "Commentaire",
      longPost:
        "Notre catalogue de printemps est sorti. Quarante nouvelles affiches cette saison, des planches botaniques aux plans de villes, toutes imprimées sur papier recyclé et expédiées à plat dans un tube réutilisable. Commandez avant dimanche et nous ajoutons un cadre offert pour chaque deuxième affiche. Tout le catalogue sur https://example.com/printemps",
      message: "Message privé",
      post: "Notre catalogue de printemps est sorti : quarante nouvelles affiches, imprimées sur papier recyclé. À lire sur https://example.com/printemps",
      shortPost:
        "Catalogue de printemps : quarante nouvelles affiches. https://example.com/printemps",
      over: ":: Au-delà de la limite",
      processed: ":: Traité",
      published: ":: Publiée",
      publishing: ":: Publication…",
      review: "Avis",
      scheduled: ":: Programmée",
      unconfirmed: ":: Non confirmée",
      uploading: ":: Envoi",
      within: ":: Dans la limite",
    },
    open: {
      cells: {
        platforms: {
          label: "Plateformes",
          lead: "{platforms} plateformes.",
          text: "Réseaux sociaux, messageries et blogs, depuis un seul éditeur et une seule API.",
        },
        repository: {
          label: "Fair source",
          lead: "Apache 2.0 après deux ans.",
          pulls: "fusionnées récemment",
          stars: "étoiles",
          text: "Le code est sous Functional Source License, et chaque version passe sous licence Apache 2.0 deux ans après sa sortie.",
        },
        sdks: {
          label: "SDK",
          lead: "Huit langages.",
          text: "Des clients TypeScript, Python, Go, Ruby, Java, PHP, .NET et Rust, générés à partir du même contrat d’API.",
        },
        selfHosting: {
          label: "Auto-hébergement",
          lead: "Postgres et un stockage compatible S3.",
          link: "Lire le guide d’auto-hébergement",
          text: "C’est tout ce qu’il faut à un serveur. L’e-mail, la facturation, le captcha, l’IA et la télémétrie sont facultatifs.",
        },
      },
      eyebrow: "Construit au grand jour",
      lead: "Le code, le contrat d’API et les SDK sont publics sur GitHub.",
      title: {
        muted: "Vous pouvez lire le code et le faire tourner vous-même.",
        text: "Construit au grand jour.",
      },
    },
    platforms: {
      api: "Publiez depuis votre code, un agent IA ou votre propre produit.",
      eyebrow: "Un même socle",
      lead: "PealCreative et PealAPI sont les deux côtés d’une même application. Vous passez de l’un à l’autre dans la barre latérale.",
      mock: {
        apiKeys: "Clés d’API",
        deliveries: "Envois des webhooks",
        keys: ["Robot de publication", "Export des statistiques"],
        groups: {
          build: "Développer",
          engage: "Échanger",
          partners: "Partenaires",
        },
        pages: {
          ads: "Publicité",
          analytics: "Statistiques",
          apiKeys: "Clés d’API",
          calendar: "Calendrier",
          channels: "Canaux",
          home: "Accueil",
          inbox: "Boîte de réception",
          media: "Médias",
          partner: "Partenaire",
          platforms: "Plateformes",
          posts: "Publications",
          webhooks: "Webhooks",
        },
        days: ["lun. 17", "mar. 18"],
        settings: "Paramètres",
        workspace: "Érable",
      },
      studio:
        "Écrivez, programmez, faites approuver et mesurez vos publications en équipe.",
      title: {
        muted:
          "Les mêmes espaces de travail, canaux et publications, quel que soit le côté où vous travaillez.",
        text: "Deux plateformes bâties sur le même socle.",
      },
    },
    sections: {
      api: "PealAPI",
      faq: "FAQ",
      hardParts: "Sous le capot",
      open: "Au grand jour",
      platforms: "Produits",
      studio: "PealCreative",
    },
    studio: {
      action: "En savoir plus",
      cards: {
        approvals: {
          label: "Approbations",
          lead: "Votre client approuve sans compte.",
          link: "Relecture et approbation",
          text: "Envoyez-lui un lien de relecture. Il lit la publication, la commente et l’approuve. Tant qu’il ne l’a pas fait, la publication ne part pas.",
        },
        composer: {
          label: "Éditeur",
          lead: "Une publication, un aperçu par plateforme.",
          link: "Écrire une publication",
          text: "Donnez à chaque canal son propre texte et ses options. Peal compte la limite de chaque plateforme avant que vous programmiez.",
        },
      },
      eyebrow: "PealCreative",
      lead: "Écrivez une publication une fois et adaptez-la là où une plateforme demande autre chose. Programmez-la sur le calendrier et envoyez à votre client un lien pour l’approuver. Une fois qu’elle est en ligne, répondez aux commentaires depuis la boîte de réception et voyez comment elle a marché.",
      review: {
        approve: "Approuver cette publication",
        badge: "Invité",
        comment: "Peut-on ajouter les horaires de la boutique ?",
        name: "Sam Relecteur",
        requestChanges: "Demander des modifications",
      },
      tiles: {
        analytics: {
          label: "Statistiques",
          text: "Consultez les chiffres de chaque publication et de chaque compte, repérez les publications qui ont le mieux marché, et exportez-les.",
        },
        assistant: {
          label: "Assistant de rédaction",
          text: "Demandez à l’IA d’écrire, de réécrire, de raccourcir ou de traduire une publication, ou de suggérer des hashtags.",
        },
        calendar: {
          label: "Calendrier",
          text: "Programmez dans votre fuseau horaire, puis déplacez ou annulez des publications sur le calendrier.",
        },
        inbox: {
          label: "Boîte de réception",
          text: "Les commentaires, les avis Google Business Profile et les messages Mastodon et Bluesky au même endroit.",
        },
      },
      title: { text: "Planifiez, écrivez et faites approuver en équipe." },
    },
    description:
      "PealCreative pour les équipes marketing et PealAPI pour les développeurs et les agents : écrivez une publication une fois, planifiez-la sur plusieurs plateformes et suivez ses résultats. Auto-hébergeable et fair source.",
    faq: {
      groups: [
        {
          questions: [
            {
              answer:
                "Peal est une plateforme de planification pour les réseaux sociaux, qui se présente en deux produits. Les équipes marketing écrivent, programment, font approuver et mesurent leurs publications dans PealCreative. Les développeurs et les agents IA publient avec PealAPI, depuis leur propre code ou produit.",
              question: "Qu’est-ce que Peal ?",
            },
            {
              answer:
                "Les équipes marketing, qui travaillent dans PealCreative, et les développeurs, qui construisent sur PealAPI ou intègrent Peal à leur propre produit.",
              question: "À qui s’adresse Peal ?",
            },
            {
              answer:
                "Ce sont deux accès au même espace de travail. PealCreative est l’application web où une équipe écrit, programme et fait approuver ses publications et lit ses statistiques. PealAPI est l’API HTTP avec son serveur MCP, sa ligne de commande, ses SDK, ses webhooks et son kit d’intégration, pour le code et les agents IA. Une publication créée d’un côté apparaît de l’autre.",
              question: "Quelle différence entre PealCreative et PealAPI ?",
            },
            {
              answer:
                "Oui, avec PealAPI. Un assistant IA se connecte par le serveur MCP, à un espace de travail, et vous choisissez s’il peut publier.",
              question: "Un agent IA peut-il utiliser Peal ?",
            },
          ],
          title: "Général",
        },
        {
          questions: [
            {
              answer:
                "Réseaux sociaux : {social}. Messageries : {chat}. Blogs : {blog}. Des comptes publicitaires peuvent aussi être connectés, sur un serveur qui active la publicité : {ads}.",
              question: "Sur quelles plateformes Peal publie-t-il ?",
            },
            {
              answer:
                "Oui. Une publication a un texte, et chaque canal peut avoir son propre texte et ses options. Peal compte les limites de chaque plateforme et montre un aperçu pour chacune.",
              question:
                "Une publication peut-elle varier d’une plateforme à l’autre ?",
            },
            {
              answer:
                "Oui. Votre client n’a pas besoin de compte Peal pour voir la publication, la commenter et l’approuver avant qu’elle parte.",
              question: "Un client peut-il approuver une publication d’abord ?",
            },
            {
              answer:
                "Peal la marque comme non confirmée et vous demande de vérifier, au lieu de la republier à l’aveugle.",
              question:
                "Et si une plateforme ne confirme pas une publication ?",
            },
          ],
          title: "Plateformes et publication",
        },
        {
          questions: [
            {
              answer:
                "Oui. Un serveur a besoin de Postgres et d’un stockage compatible S3. L’e-mail, la facturation, le captcha, l’IA et la télémétrie sont facultatifs, et chacun a une option que vous pouvez héberger vous-même.",
              question: "Puis-je faire tourner Peal sur mon propre serveur ?",
            },
            {
              answer:
                "La Functional Source License (FSL-1.1-ALv2). Vous pouvez utiliser le code, le modifier et le faire tourner pour tout usage sauf un service concurrent. Chaque version passe sous licence Apache 2.0 deux ans après sa sortie.",
              question: "Sous quelle licence est le code ?",
            },
            {
              answer:
                "Les SDK, dans huit langages, sont sous licence Apache 2.0, comme le contrat d’API dont ils sont générés.",
              question: "Les SDK sont-ils sous la même licence ?",
            },
            {
              answer:
                "Non. Si vous ne configurez pas de prestataire de paiement, votre serveur ne facture rien et ne limite rien.",
              question: "Un serveur auto-hébergé facture-t-il les comptes ?",
            },
          ],
          title: "Auto-hébergement et licence",
        },
        {
          questions: [
            {
              answer:
                "Vous payez par compte connecté, compté au jour, en dollars américains. Vos {free} premiers comptes sont gratuits, et chaque tranche suivante coûte moins cher par compte.",
              question: "Comment Peal Cloud est-il facturé ?",
            },
            {
              answer:
                "Membres, espaces de travail et publications illimités. Chaque compte a toutes les plateformes, le calendrier et les statistiques dans PealCreative, et l’API, le serveur MCP et la ligne de commande dans PealAPI.",
              question: "Qu’est-ce qui vient avec chaque compte ?",
            },
            {
              answer:
                "Quelques usages nous coûtent de l’argent à chaque fois, comme l’assistant de rédaction ou l’API de X, et ont donc un quota mensuel. Une fois le quota dépassé, ils sont suspendus jusqu’au mois suivant, ou nous les facturons si vous avez ajouté un moyen de paiement.",
              question: "Y a-t-il une facturation à l’usage ?",
            },
            {
              answer:
                "Oui, en ligne, à tout moment. Nous vous facturons chaque mois pour le mois écoulé, et la facturation s’arrête à la fin du mois où vous résiliez.",
              question: "Puis-je résilier ?",
            },
          ],
          title: "Tarifs",
        },
      ],
      label: "FAQ",
      lead: "Des réponses courtes ici, et le détail dans la documentation.",
      title: {
        muted: "Des réponses simples, avant de commencer.",
        text: "Questions fréquentes.",
      },
    },
    hero: {
      chips: {
        api: "PealAPI dans la documentation",
        restApi: "API REST",
        studio: "PealCreative dans la documentation",
      },
      composer: {
        action: "Programmer",
        author: "Peal Example",
        channels: "Canaux",
        preview: "Aperçu",
        text: "Texte",
        time: "mar. 09:00 · Europe/Paris",
      },
      lead: "Votre équipe planifie, écrit et fait approuver ses publications dans PealCreative. Votre code et vos agents IA publient avec PealAPI.",
      primary: "Commencer",
      secondary: "Lire la documentation",
      stage: "Les produits de Peal",
      title:
        "La planification full-stack des réseaux sociaux, pour les équipes marketing et les agents",
    },
    title: "Peal : planifiez vos publications sur les réseaux sociaux",
  },
  pricing: {
    ...chromeMessages("fr").pricing,
    calculator: {
      average: "{price} par compte en moyenne",
      cloud: { line: "Nous le gérons pour vous.", title: "Peal Cloud" },
      excluded: "HT",
      free: "Gratuit",
      label: "Comptes connectés",
      last: "{from} et plus",
      perAccount: "{price} chacun par mois",
      perMonth: "par mois",
      range: "{from} à {to}",
      valueText: "{count} comptes",
      decrease: "Retirer un compte",
      increase: "Ajouter un compte",
    },
    coming: "Bientôt : tarifs à venir",
    headline: {
      muted: "Vos {free} premiers sont gratuits.",
      text: "Un prix par compte connecté.",
    },
    selfHosted: {
      items: [
        "Toutes les fonctionnalités, sans limite",
        "Vos données restent sur votre serveur",
        "Le code est public sur GitHub",
      ],
      link: "Guide d’auto-hébergement",
      price: "Gratuit",
      title: "Auto-hébergé",
    },
    enterprise: {
      items: [
        "Un prix à la mesure de votre volume",
        "Une limite de requêtes à l’API plus haute",
        "Des conditions convenues avec nous",
      ],
      line: "Pour les grandes équipes, les agences et les partenaires.",
      price: "Sur mesure",
      subject: "Peal Enterprise",
      talk: "Parler à l’équipe commerciale",
      title: "Enterprise",
    },
    rateCard: {
      cloudLine: "Vos {free} premiers comptes gratuits",
      eyebrow: "Fonctionnalités",
      features: {
        ads: {
          name: "Publicités",
          note: "Mettez en avant vos publications et suivez les résultats de vos campagnes.",
        },
        analytics: {
          name: "Statistiques",
          note: "Les chiffres de chaque publication et de chaque compte, les meilleurs moments pour publier, et les exports.",
        },
        articles: {
          name: "Articles",
          note: "Publiez des articles sur vos blogs, avec leurs images.",
        },
        assistant: {
          name: "Assistant de rédaction",
          note: "Écrire, réécrire, raccourcir ou traduire une publication.",
        },
        chats: {
          name: "Messageries",
          note: "Publiez dans vos canaux et vos groupes comme sur toute autre plateforme.",
        },
        developers: {
          name: "API, serveur MCP, ligne de commande et SDK",
          note: "Programmez, publiez et lisez vos publications depuis votre code et vos agents IA.",
        },
        inbox: {
          name: "Boîte de réception",
          note: "Commentaires, avis et messages privés, traités au même endroit.",
        },
        publishing: {
          name: "Programmation et publication",
          note: "Publications, fils et premiers commentaires, le calendrier, les files d’attente et les approbations.",
        },
        team: {
          name: "Membres et espaces de travail",
          note: "Votre équipe et vos clients, chaque espace de travail avec ses propres canaux.",
        },
        webhooks: {
          name: "Webhooks",
          note: "Ce qui se passe dans un espace de travail, envoyé à votre serveur au moment où cela arrive.",
        },
      },
      groups: {
        limits: "Limites",
        usage: "Usage",
        x: "L’API de X",
      },
      tags: {
        ads: "Régies publicitaires",
        articles: "Blogs",
        chats: "Messageries",
        publishing: "Réseaux sociaux",
      },
      title: "Toutes les fonctionnalités sur chaque compte",
      values: {
        custom: "Sur mesure",
        included: "Inclus",
        unlimited: "Illimité",
      },
    },
    dayRule:
      "Nous comptons les comptes au jour. Chaque jour UTC compte le plus grand nombre de comptes que vous aviez connectés en même temps ce jour-là, dans tous les espaces de travail du compte de facturation. Seuls les jours {first} à {days} comptent (le jour {after} ne compte jamais). Nous additionnons les jours-comptes du mois et les divisons par {days}, et ce nombre de comptes passe au barème. Vos {freeDays} premiers jours-comptes sont donc gratuits. Un compte que vous déconnectez cesse de compter dès le lendemain. Nous ne facturons rien d’autre pour les comptes.",
    description:
      "Les tarifs de Peal Cloud : au compte connecté, au jour, vos premiers comptes gratuits, en dollars américains.",
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
      lead: "Il y a un barème par compte de facturation, c’est-à-dire la personne ou le partenaire qui paie ses espaces de travail. Nous comptons les comptes du mois au jour, comme expliqué ci-dessous, et les facturons tranche par tranche. Les premiers ne coûtent rien, et chaque tranche suivante coûte moins cher par compte.",
      perAccount: "{price} par compte et par mois",
      price: "Par mois et par compte",
      range: "Comptes {from} à {to}",
      title: "Comptes connectés",
    },
    lead: "Vous payez les comptes que vous connectez, comptés au jour, et chacun coûte moins cher à mesure que vous en connectez. Les membres, les espaces de travail et les publications sont illimités, et aucune offre ne réserve de fonctions.",
    legal: {
      billing:
        "Nous vous facturons le premier de chaque mois pour le mois écoulé. Vous ne payez jamais d’avance.",
      cancel:
        "Vous pouvez résilier en ligne à tout moment, connecté ou non. Cliquez sur « Résilier votre contrat », au pied de chaque page ou sur la page de facturation. Nous facturons l’usage de ce mois, la facturation prend fin avec le mois, et nous ne facturons plus rien ensuite.",
      legacy:
        "Un abonnement à l’une des offres précédentes, au nombre de canaux, garde son offre et son prix jusqu’à sa fin.",
      prices:
        "Nous annonçons un changement de prix par e-mail 30 jours à l’avance, pour que vous puissiez résilier avant qu’il s’applique.",
      terms: "Lire les conditions d’utilisation",
      title: "Des conditions claires",
      withdrawal:
        "Si vous êtes consommateur, vous pouvez vous rétracter dans les 14 jours suivant la souscription. Cliquez sur « Renoncer au contrat ici », au pied de chaque page ou sur la page de facturation. Votre abonnement prend fin immédiatement, et vous ne payez que ce que vous avez utilisé jusque-là.",
    },
    meters: {
      allowance: "{count} inclus par mois",
      xIncluded: "Rien d’inclus",
      lead: "Chaque compte de facturation a une franchise mensuelle. Une fois la franchise dépassée, l’usage s’arrête si vous n’avez pas de moyen de paiement, et il est facturé si vous en avez un.",
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
          "Plafonné à {ceiling} par mois par défaut. Modifiable sur votre page de facturation.",
        lead: "X facture chaque appel à son API. Nous le refacturons aux tarifs à l’usage publiés par X, sans rien ajouter. Voici ceux dont se sert un outil de programmation. Peal ne lit les chiffres d’une publication et les abonnés d’un compte que dans les espaces de travail qui activent la lecture de X, et chacun une fois par jour UTC.",
        names: {
          postCreate: "Une publication envoyée",
          postCreateWithUrl: "Une publication envoyée avec un lien",
          postRead: "Les chiffres d’une publication lus",
          userRead: "Les abonnés d’un compte lus",
        },
        readOn:
          "Tarifs au {day}. Votre page de facturation affiche les tarifs en vigueur.",
        title: "Les tarifs de X",
      },
    },
    partMonth: {
      body: "{allMonth} comptes connectés tout le mois, plus {extras}, font {accountDays} jours-comptes. Divisés par {days}, cela fait {units} comptes passés au barème, soit {price} pour le mois.",
      extra: "un pendant {days}",
      title: "Un mois incomplet",
    },
    selfHost: "Installez Peal sur votre propre serveur. Sans frais ni limites.",
    api: {
      body: "{without} requêtes par minute et par clé sans moyen de paiement, {withPaymentMethod} avec, {onRequest} sur demande.",
      title: "Limite de débit de l’API",
    },
    storage: {
      body: "{without} sans moyen de paiement. Avec, {perAccount} par compte, {minimum} au minimum.",
      title: "Stockage des médias",
    },
    taxes: {
      currency:
        "Au paiement, vous pouvez régler dans votre propre devise, que notre prestataire de paiement convertit au taux du jour. Sinon, votre carte est débitée en dollars américains.",
      excluded: "Les prix sont fixés en dollars américains, hors taxes.",
      reverseCharge:
        "Une entreprise avec un numéro de TVA valide paie le prix HT, car la TVA est autoliquidée. En France, la TVA française s’applique.",
      shown:
        "Tous les prix sont en dollars US, hors TVA. La TVA française de {rate} % s’applique.",
      vat: "La TVA que vous payez dépend de votre pays. Pour les clients de l’UE, elle est ajoutée au paiement, au taux de leur pays.",
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

export { localeNames } from "peal-ui/lib/site/messages";
