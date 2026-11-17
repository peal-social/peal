import type { Locale } from "./locales.ts";

// Every string the site shows, per locale. Long-form legal text lives in the
// `legal` content collection instead (src/content/legal/<locale>/).

const en = {
  // Above every page's header while Peal is not released.
  announcement: {
    link: "Follow the build on GitHub",
    text: "Peal is in development and not released yet. This site shows what it is being built to do.",
  },
  draft: {
    body: "This document is not in force yet. Text in square brackets is still to be written.",
    title: "Draft pending legal review",
  },
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
      lead: "An HTTP API described in OpenAPI, an MCP server for AI agents, a command line and SDKs in eight languages. They all work on the same workspaces your team opens in PealStudio.",
      rows: {
        cli: {
          link: "The command line",
          text: "The peal command signs in with your Peal account or takes an API key, and answers in JSON, which scripts and agents can read.",
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
      line: "Free to start, with every line of code public on GitHub.",
      primary: "Get started",
      secondary: "Read the docs",
      title: "Start posting with Peal",
    },
    hardParts: {
      cells: {
        approvals: {
          label: "Approvals",
          lead: "A client says yes first.",
          text: "Send a review link to someone without a Peal account. They comment, and the post waits for their approval.",
        },
        inbox: {
          label: "Inbox",
          lead: "Replies in one place.",
          text: "Comments under your posts, Google Business Profile reviews, and Mastodon and Bluesky direct messages, answered from one inbox.",
        },
        limits: {
          label: "Platform limits",
          lead: "Checked before you schedule.",
          text: "Peal counts each platform's text limits, checks images and videos against what it accepts, and names what to fix.",
        },
        media: {
          label: "Media",
          lead: "Sent the way each platform takes it.",
          text: "Files go up in parts where a platform asks for that, and Peal waits while the platform processes them before the post goes out.",
        },
        timeZones: {
          label: "Time zones",
          lead: "Your time, daylight saving included.",
          text: "A post goes out at the wall-clock time of the time zone you pick.",
        },
        unconfirmed: {
          label: "No blind reposts",
          lead: "When a platform does not answer, Peal asks you.",
          text: "A post that may have gone out without a reply is marked unconfirmed, and Peal never sends it again on its own.",
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
          text: "That is all a server needs. Email, billing, captcha, AI and telemetry are optional.",
        },
      },
      eyebrow: "Built in the open",
      lead: "The code, the API contract and the SDKs are public on GitHub.",
      title: {
        muted: "Anyone can read the code and run it.",
        text: "Built in the open.",
      },
    },
    platforms: {
      api: "Publish from your code, an AI agent or your own product.",
      eyebrow: "One foundation",
      lead: "PealStudio and PealAPI are the two sides of the same app, one switch apart in its sidebar.",
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
      studio: "PealStudio",
    },
    studio: {
      action: "Learn more",
      cards: {
        approvals: {
          label: "Approvals",
          lead: "A client approves without an account.",
          link: "Review and approval",
          text: "Send them a review link. They read the post, comment on it and approve it, and the post waits for their decision before it goes out.",
        },
        composer: {
          label: "Composer",
          lead: "One post, a preview per platform.",
          link: "Write a post",
          text: "Any channel can take its own text and options, and Peal counts each platform's limit before you schedule.",
        },
      },
      eyebrow: "PealStudio",
      lead: "Write a post once and adjust it where a platform needs it. Schedule it on the calendar, get the client's approval through a link, answer comments from the inbox and see how each post did.",
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
          text: "Counts for every post and account, the posts that did best, and an export.",
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
      "PealStudio for marketing teams and PealAPI for developers and agents: write a post once, schedule it across platforms and see how it performs. Self-hostable and fair source.",
    faq: {
      groups: [
        {
          questions: [
            {
              answer:
                "A social media scheduling platform in two products. Marketing teams write, schedule, approve and measure posts in PealStudio. Developers and AI agents publish through PealAPI, from their own code or product.",
              question: "What is Peal?",
            },
            {
              answer:
                "Not yet. Peal is in development, and this site describes what it is being built to do.",
              question: "Can I use Peal today?",
            },
            {
              answer:
                "Marketing teams, who work in PealStudio, and developers, who build on PealAPI or embed Peal in their own product.",
              question: "Who is it for?",
            },
            {
              answer:
                "They are two ways into the same workspace. PealStudio is the web app where a team writes, schedules and approves posts and reads its analytics. PealAPI is the HTTP API with its MCP server, command line, SDKs, webhooks and embedding kit, for code and AI agents. A post made from one shows up in the other.",
              question:
                "What is the difference between PealStudio and PealAPI?",
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
                "A client without a Peal account can see the post, comment on it, and approve it before it goes out.",
              question: "Can a client approve a post first?",
            },
            {
              answer:
                "Peal marks it unconfirmed and asks you to check, instead of posting it again blindly.",
              question: "What if a platform does not confirm a post?",
            },
          ],
          title: "Platforms and publishing",
        },
        {
          questions: [
            {
              answer:
                "Yes. A server needs Postgres and an S3-compatible store; email, billing, captcha, AI and telemetry are optional, and each has a self-hostable choice.",
              question: "Can I run Peal on my own server?",
            },
            {
              answer:
                "The Functional Source License (FSL-1.1-ALv2): use, change and run it for anything but a competing service. Each release becomes Apache 2.0 two years after it ships.",
              question: "Under which licence is the source?",
            },
            {
              answer:
                "The SDKs, in eight languages, are under the Apache License 2.0, as is the API contract they are generated from.",
              question: "Are the SDKs under the same licence?",
            },
            {
              answer:
                "No. A server without a payment provider configured bills nothing and limits nothing.",
              question: "Does a self-hosted server charge for accounts?",
            },
          ],
          title: "Self-hosting and licence",
        },
        {
          questions: [
            {
              answer:
                "By connected account, counted by the day, in US dollars. Your first {free} accounts are free, and each further band costs less.",
              question: "How is Peal Cloud priced?",
            },
            {
              answer:
                "Members, workspaces and posts are unlimited. Every account has every platform, the calendar and analytics in PealStudio, and the API, the MCP server and the command line in PealAPI.",
              question: "What comes with every account?",
            },
            {
              answer:
                "Some uses that cost Peal money, such as the writing assistant or X's API, have a monthly allowance. Past it, they pause until the next month, or are billed if you added a payment method.",
              question: "Is anything billed by use?",
            },
            {
              answer:
                "Yes, online at any time. You are billed each month for the month past, and billing ends with the month.",
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
        studio: "PealStudio in the docs",
      },
      composer: {
        action: "Schedule",
        author: "Peal Example",
        channels: "Channels",
        preview: "Preview",
        text: "Text",
        time: "Tue 09:00 · Europe/Paris",
      },
      lead: "Your team plans, writes and approves posts in PealStudio. Your code and your AI agents publish through PealAPI.",
      primary: "Get started",
      secondary: "Read the docs",
      stage: "Peal's products",
      title: "The AI marketing platform",
    },
    title: "Peal: schedule social media posts across platforms",
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
      "Counted by the day: each UTC day of the month counts the most accounts connected at once that day, across every workspace of the billing account, for days {first} to {days} only (day {after} is never counted). The month's account-days are added up and divided by {days}, and that number of accounts goes through the ladder, so the first {freeDays} account-days are free. An account you disconnect stops counting from the next day, and nothing else is charged for accounts: no fee of any kind.",
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
      lead: "One ladder per billing account: the person, or the partner, who pays for its workspaces. The month's accounts, counted by the day as below, are priced band by band: the first ones cost nothing, and each further band costs less.",
      perAccount: "{price} per account a month",
      price: "A month, per account",
      range: "Accounts {from} to {to}",
      title: "Connected accounts",
    },
    lead: "Counted by the day, and each account costs less the more you connect. Members, workspaces and posts are unlimited, and nothing is held back behind a plan.",
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
      lead: "Each billing account gets a monthly allowance. Past it, usage pauses without a payment method, or is billed with one.",
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
        lead: "X bills each call to its API. Peal passes it on at X's published pay-per-use rates, with nothing added: here are those a scheduler uses. A post's counts and an account's followers are read only for the workspaces that turn X's reads on, and each one once a UTC day.",
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
    nav: "Pricing",
    partMonth: {
      body: "{allMonth} accounts connected all month, plus {extras}, come to {accountDays} account-days. Divided by {days}, that is {units} accounts through the ladder: {price} for the month.",
      extra: "one for {days}",
      title: "A month not held in full",
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
        "At checkout you can pay in your own currency, converted by our payment provider at the day's rate; otherwise your card is charged in US dollars.",
      excluded: "Prices are in US dollars and exclude tax.",
      reverseCharge:
        "A business with a valid VAT number pays the price excluding VAT, the VAT being reverse-charged; in France, French VAT applies.",
      shown:
        "All prices are in US dollars and exclude VAT. French VAT of {rate}% applies.",
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
  announcement: {
    link: "Suivre le développement sur GitHub",
    text: "Peal est en cours de développement et pas encore sorti. Ce site montre ce qu’il est conçu pour faire.",
  },
  draft: {
    body: "Ce document n’est pas encore en vigueur. Le texte entre crochets reste à rédiger.",
    title: "Projet en attente de relecture juridique",
  },
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
      lead: "Une API HTTP décrite en OpenAPI, un serveur MCP pour les agents IA, une ligne de commande et des SDK dans huit langages. Tous travaillent sur les mêmes espaces de travail que votre équipe ouvre dans PealStudio.",
      rows: {
        cli: {
          link: "La ligne de commande",
          text: "La commande peal se connecte avec votre compte Peal ou prend une clé d’API, et répond en JSON, que les scripts et les agents savent lire.",
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
      line: "Gratuit pour commencer, et tout le code est public sur GitHub.",
      primary: "Commencer",
      secondary: "Lire la documentation",
      title: "Commencez à publier avec Peal",
    },
    hardParts: {
      cells: {
        approvals: {
          label: "Approbations",
          lead: "Un client dit oui d’abord.",
          text: "Envoyez un lien de relecture à quelqu’un sans compte Peal. Il commente, et la publication attend son accord.",
        },
        inbox: {
          label: "Boîte de réception",
          lead: "Les réponses au même endroit.",
          text: "Les commentaires sous vos publications, les avis Google Business Profile et les messages privés Mastodon et Bluesky, traités depuis une seule boîte.",
        },
        limits: {
          label: "Limites des plateformes",
          lead: "Vérifiées avant la programmation.",
          text: "Peal compte les limites de texte de chaque plateforme, vérifie les images et les vidéos selon ce qu’elle accepte, et dit quoi corriger.",
        },
        media: {
          label: "Médias",
          lead: "Envoyés comme chaque plateforme les prend.",
          text: "Les fichiers partent en morceaux quand une plateforme le demande, et Peal attend qu’elle les traite avant que la publication parte.",
        },
        timeZones: {
          label: "Fuseaux horaires",
          lead: "Votre heure, changements d’heure compris.",
          text: "Une publication part à l’heure locale du fuseau horaire choisi.",
        },
        unconfirmed: {
          label: "Pas de republication à l’aveugle",
          lead: "Quand une plateforme ne répond pas, Peal vous demande.",
          text: "Une publication qui a pu partir sans réponse est marquée non confirmée, et Peal ne la renvoie jamais de lui-même.",
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
        muted: "Chacun peut lire le code et le faire tourner.",
        text: "Construit au grand jour.",
      },
    },
    platforms: {
      api: "Publiez depuis votre code, un agent IA ou votre propre produit.",
      eyebrow: "Un même socle",
      lead: "PealStudio et PealAPI sont les deux côtés de la même application, à un bouton d’écart dans sa barre latérale.",
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
      studio: "PealStudio",
    },
    studio: {
      action: "En savoir plus",
      cards: {
        approvals: {
          label: "Approbations",
          lead: "Un client approuve sans compte.",
          link: "Relecture et approbation",
          text: "Envoyez-lui un lien de relecture. Il lit la publication, la commente et l’approuve, et la publication attend sa décision avant de partir.",
        },
        composer: {
          label: "Éditeur",
          lead: "Une publication, un aperçu par plateforme.",
          link: "Écrire une publication",
          text: "Chaque canal peut avoir son propre texte et ses options, et Peal compte la limite de chaque plateforme avant que vous programmiez.",
        },
      },
      eyebrow: "PealStudio",
      lead: "Écrivez une publication une fois et adaptez-la là où une plateforme le demande. Programmez-la sur le calendrier, obtenez l’accord du client par un lien, répondez aux commentaires depuis la boîte de réception et voyez comment chaque publication s’est passée.",
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
          text: "Les chiffres de chaque publication et de chaque compte, les publications qui ont le mieux marché, et un export.",
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
      "PealStudio pour les équipes marketing et PealAPI pour les développeurs et les agents : écrivez une publication une fois, planifiez-la sur plusieurs plateformes et suivez ses résultats. Auto-hébergeable et fair source.",
    faq: {
      groups: [
        {
          questions: [
            {
              answer:
                "Une plateforme de planification pour les réseaux sociaux, en deux produits. Les équipes marketing écrivent, programment, font approuver et mesurent leurs publications dans PealStudio. Les développeurs et les agents IA publient avec PealAPI, depuis leur propre code ou produit.",
              question: "Qu’est-ce que Peal ?",
            },
            {
              answer:
                "Pas encore. Peal est en cours de développement, et ce site décrit ce qu’il est conçu pour faire.",
              question: "Puis-je utiliser Peal aujourd’hui ?",
            },
            {
              answer:
                "Les équipes marketing, qui travaillent dans PealStudio, et les développeurs, qui construisent sur PealAPI ou intègrent Peal à leur propre produit.",
              question: "À qui s’adresse Peal ?",
            },
            {
              answer:
                "Ce sont deux accès au même espace de travail. PealStudio est l’application web où une équipe écrit, programme et fait approuver ses publications et lit ses statistiques. PealAPI est l’API HTTP avec son serveur MCP, sa ligne de commande, ses SDK, ses webhooks et son kit d’intégration, pour le code et les agents IA. Une publication créée d’un côté apparaît de l’autre.",
              question: "Quelle différence entre PealStudio et PealAPI ?",
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
                "Un client sans compte Peal peut voir la publication, la commenter et l’approuver avant qu’elle parte.",
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
                "Oui. Un serveur a besoin de Postgres et d’un stockage compatible S3 ; l’e-mail, la facturation, le captcha, l’IA et la télémétrie sont facultatifs, et chacun a une option auto-hébergeable.",
              question: "Puis-je faire tourner Peal sur mon propre serveur ?",
            },
            {
              answer:
                "La Functional Source License (FSL-1.1-ALv2) : utilisez-le, modifiez-le et faites-le tourner pour tout usage sauf un service concurrent. Chaque version passe sous licence Apache 2.0 deux ans après sa sortie.",
              question: "Sous quelle licence est le code ?",
            },
            {
              answer:
                "Les SDK, dans huit langages, sont sous licence Apache 2.0, comme le contrat d’API dont ils sont générés.",
              question: "Les SDK sont-ils sous la même licence ?",
            },
            {
              answer:
                "Non. Un serveur sans prestataire de paiement configuré ne facture rien et ne limite rien.",
              question: "Un serveur auto-hébergé facture-t-il les comptes ?",
            },
          ],
          title: "Auto-hébergement et licence",
        },
        {
          questions: [
            {
              answer:
                "Par compte connecté, compté au jour, en dollars américains. Vos {free} premiers comptes sont gratuits, et chaque tranche suivante coûte moins cher.",
              question: "Comment Peal Cloud est-il facturé ?",
            },
            {
              answer:
                "Membres, espaces de travail et publications illimités. Chaque compte a toutes les plateformes, le calendrier et les statistiques dans PealStudio, et l’API, le serveur MCP et la ligne de commande dans PealAPI.",
              question: "Qu’est-ce qui vient avec chaque compte ?",
            },
            {
              answer:
                "Certains usages qui coûtent à Peal, comme l’assistant de rédaction ou l’API de X, ont un quota mensuel. Au-delà, ils sont suspendus jusqu’au mois suivant, ou facturés si vous avez ajouté un moyen de paiement.",
              question: "Y a-t-il une facturation à l’usage ?",
            },
            {
              answer:
                "Oui, en ligne, à tout moment. Vous êtes facturé chaque mois pour le mois écoulé, et la facturation s’arrête avec le mois.",
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
        studio: "PealStudio dans la documentation",
      },
      composer: {
        action: "Programmer",
        author: "Peal Example",
        channels: "Canaux",
        preview: "Aperçu",
        text: "Texte",
        time: "mar. 09:00 · Europe/Paris",
      },
      lead: "Votre équipe planifie, écrit et fait approuver ses publications dans PealStudio. Votre code et vos agents IA publient avec PealAPI.",
      primary: "Commencer",
      secondary: "Lire la documentation",
      stage: "Les produits de Peal",
      title: "La plateforme marketing IA",
    },
    title: "Peal : planifiez vos publications sur les réseaux sociaux",
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
      "Compté au jour : chaque jour UTC du mois compte le plus grand nombre de comptes connectés en même temps ce jour-là, dans tous les espaces de travail du compte de facturation, pour les jours {first} à {days} seulement (le jour {after} n’est jamais compté). Les jours-comptes du mois sont additionnés et divisés par {days}, et ce nombre de comptes passe au barème : les {freeDays} premiers jours-comptes sont donc gratuits. Un compte que vous déconnectez cesse de compter dès le lendemain, et rien d’autre n’est facturé pour les comptes : aucuns frais.",
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
      lead: "Un barème par compte de facturation : la personne, ou le partenaire, qui paie ses espaces de travail. Les comptes du mois, comptés au jour comme ci-dessous, sont facturés tranche par tranche : les premiers ne coûtent rien, et chaque tranche suivante coûte moins.",
      perAccount: "{price} par compte et par mois",
      price: "Par mois et par compte",
      range: "Comptes {from} à {to}",
      title: "Comptes connectés",
    },
    lead: "Compté au jour, et chaque compte coûte moins à mesure que vous en connectez. Membres, espaces de travail et publications sont illimités, et aucune fonction n’est réservée à une offre.",
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
      lead: "Chaque compte de facturation a une franchise mensuelle. Au-delà, l’usage s’arrête sans moyen de paiement, ou il est facturé avec.",
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
        lead: "X facture chaque appel à son API. Peal le refacture aux tarifs à l’usage publiés par X, sans rien ajouter : voici ceux dont se sert un outil de programmation. Les chiffres d’une publication et les abonnés d’un compte ne sont lus que pour les espaces de travail qui activent la lecture de X, et chacun une fois par jour UTC.",
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
    nav: "Tarifs",
    partMonth: {
      body: "{allMonth} comptes connectés tout le mois, plus {extras}, font {accountDays} jours-comptes. Divisés par {days}, cela fait {units} comptes passés au barème : {price} pour le mois.",
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
        "Au paiement, vous pouvez régler dans votre propre devise, convertie par notre prestataire de paiement au taux du jour ; sinon, votre carte est débitée en dollars américains.",
      excluded: "Les prix sont fixés en dollars américains, hors taxes.",
      reverseCharge:
        "Une entreprise avec un numéro de TVA valide paie le prix HT, la TVA étant autoliquidée ; en France, la TVA française s’applique.",
      shown:
        "Tous les prix sont en dollars US, hors TVA. La TVA française de {rate} % s’applique.",
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
