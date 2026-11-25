import type { CodeGrammar } from "./highlight.ts";

// The code the home page shows. Code is not translated, so it lives here
// and not in messages.ts. Every request is the docs' "Publish now and wait
// for the outcome" (developers/posting#wait): one post sent now to two
// channels, answered once each has its result, with an Idempotency-Key.
// Each SDK's is written from its generated sources and reference.md, the
// names test/snippets.test.ts checks against them. The ids are made up and
// read as such.

export const workspaceId = "0190f3a0-0000-7000-8000-00000000a001";

export const channelIds = [
  "0190f3a0-0000-7000-8000-00000000c001",
  "0190f3a0-0000-7000-8000-00000000c002",
] as const;

export const idempotencyKey = "5f0c2b7e-3d1a-4e58-9a6b-2c4d8e1f7a90";

export const postText =
  "Our spring catalogue is out. Read it at https://example.com/spring";

/** The seconds the API waits for every channel's result. */
export const waitSeconds = 30;

const [first, second] = channelIds;

const wait = String(waitSeconds);

/** The ways in a request is shown in, in the switcher's order. */
export const requestLanguages = [
  "curl",
  "cli",
  "typescript",
  "python",
  "go",
  "ruby",
  "java",
  "php",
  "dotnet",
  "rust",
] as const;

export type RequestLanguage = (typeof requestLanguages)[number];

/** Where an SDK defines the call its snippet makes, for the tests. */
export interface SdkCall {
  /** What the snippet writes to make the call. */
  readonly call: string;
  /** What the SDK's source declares for it. */
  readonly declaration: string;
  /** The SDK's folder under packages/peal-sdk. */
  readonly folder: string;
  /** The names the snippet uses that the SDK must define, with where. */
  readonly names: readonly { readonly file: string; readonly name: string }[];
  /** The file, from the SDK's folder, that declares the call. */
  readonly source: string;
}

export interface Snippet {
  readonly code: string;
  readonly filename: string;
  readonly grammar: CodeGrammar;
  readonly label: string;
  /** Set for an SDK: what its call is, checked against its sources. */
  readonly sdk?: SdkCall | undefined;
}

const curl = `curl -X POST "https://app.peal.social/api/v1/posts?wait=${wait}" \\
  -H "Authorization: Bearer $PEAL_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: ${idempotencyKey}" \\
  -d '{
    "channelIds": [
      "${first}",
      "${second}"
    ],
    "content": {
      "text": "${postText}",
      "media": [],
      "overrides": []
    },
    "when": { "_tag": "now" }
  }'`;

const cli = `export PEAL_API_URL="https://app.peal.social"
export PEAL_API_KEY="peal_…"

peal post "${postText}" \\
  --channels ${channelIds.join(",")} \\
  --now --wait ${wait} \\
  --idempotency-key ${idempotencyKey}`;

const typescript = `import { PealClient } from "peal-sdk";

const peal = new PealClient({ token: process.env.PEAL_API_KEY });

const post = await peal.posts.create({
  wait: "${wait}",
  "idempotency-key": "${idempotencyKey}",
  channelIds: [
    "${first}",
    "${second}",
  ],
  content: {
    text: "${postText}",
    media: [],
    overrides: [],
  },
  when: { _tag: "now" },
});`;

const python = `import os

from peal import Peal, PostContent, PostTiming_Now

peal = Peal(token=os.environ["PEAL_API_KEY"])

post = peal.posts.create(
    wait="${wait}",
    idempotency_key="${idempotencyKey}",
    channel_ids=[
        "${first}",
        "${second}",
    ],
    content=PostContent(
        text="${postText}",
        media=[],
        overrides=[],
    ),
    when=PostTiming_Now(),
)`;

const go = `import (
	"context"
	"os"

	peal "github.com/peal-social/peal/packages/peal-sdk/go"
	"github.com/peal-social/peal/packages/peal-sdk/go/client"
	"github.com/peal-social/peal/packages/peal-sdk/go/option"
)

api := client.NewClient(option.WithToken(os.Getenv("PEAL_API_KEY")))

post, err := api.Posts.Create(context.TODO(), &peal.NewPost{
	Wait:           peal.String("${wait}"),
	IdempotencyKey: peal.String("${idempotencyKey}"),
	ChannelIDs: []string{
		"${first}",
		"${second}",
	},
	Content: &peal.PostContent{
		Text:      "${postText}",
		Media:     []*peal.MediaAttachment{},
		Overrides: []*peal.TextOverride{},
	},
	When: &peal.PostTiming{Now: &peal.PostTimingNow{}},
})`;

const ruby = `require "peal"

peal = Peal::Client.new(token: ENV.fetch("PEAL_API_KEY"))

post = peal.posts.create(
  wait: "${wait}",
  idempotency_key: "${idempotencyKey}",
  channel_ids: [
    "${first}",
    "${second}"
  ],
  content: {
    text: "${postText}",
    media: [],
    overrides: []
  },
  when: { _tag: "now" }
)`;

const java = `import java.util.List;

import social.peal.PealClient;
import social.peal.resources.posts.requests.NewPost;
import social.peal.types.Post;
import social.peal.types.PostContent;
import social.peal.types.PostTiming;
import social.peal.types.PostTimingNow;

PealClient peal = PealClient.builder()
    .token(System.getenv("PEAL_API_KEY"))
    .build();

Post post = peal.posts().create(
    NewPost.builder()
        .content(PostContent.builder()
            .text("${postText}")
            .build())
        .when(PostTiming.now(PostTimingNow.builder().build()))
        .channelIds(List.of(
            "${first}",
            "${second}"))
        .wait("${wait}")
        .idempotencyKey("${idempotencyKey}")
        .build());`;

const php = `<?php
use Peal\\PealClient;
use Peal\\Posts\\Requests\\NewPost;
use Peal\\Types\\PostContent;
use Peal\\Types\\PostTiming;
use Peal\\Types\\PostTimingNow;

$peal = new PealClient(token: getenv('PEAL_API_KEY'));

$post = $peal->posts->create(
    new NewPost([
        'wait' => '${wait}',
        'idempotencyKey' => '${idempotencyKey}',
        'channelIds' => [
            '${first}',
            '${second}',
        ],
        'content' => new PostContent([
            'text' => '${postText}',
            'media' => [],
            'overrides' => [],
        ]),
        'when' => PostTiming::now(new PostTimingNow([])),
    ]),
);`;

// The .NET client gives up after 30 seconds by default, as long as the API
// may wait: a minute leaves the answer time to arrive.
const dotnet = `using Peal;

var peal = new PealClient(
    Environment.GetEnvironmentVariable("PEAL_API_KEY"),
    clientOptions: new ClientOptions { Timeout = TimeSpan.FromSeconds(60) }
);

var post = await peal.Posts.CreateAsync(
    new NewPost
    {
        Wait = "${wait}",
        IdempotencyKey = "${idempotencyKey}",
        ChannelIds = new List<string>
        {
            "${first}",
            "${second}",
        },
        Content = new PostContent { Text = "${postText}" },
        When = new PostTiming(new PostTiming.Now(new PostTimingNow())),
    }
);`;

// Rust's NewPost has no field for the key: the header goes in the
// request's options, as the docs' SDKs page says.
const rust = `use peal_sdk::prelude::*;

let peal = PealClient::new(ClientConfig {
    token: std::env::var("PEAL_API_KEY").ok(),
    ..Default::default()
})?;

let post = peal
    .posts
    .create(
        &NewPost::builder()
            .channel_ids(vec![
                "${first}".to_string(),
                "${second}".to_string(),
            ])
            .content(
                PostContent::builder()
                    .text("${postText}")
                    .media(vec![])
                    .overrides(vec![])
                    .build()?,
            )
            .when(PostTiming::now())
            .wait("${wait}")
            .build()?,
        Some(RequestOptions::new().additional_header(
            "Idempotency-Key",
            "${idempotencyKey}",
        )),
    )
    .await?;`;

/** The publishing request, in every way in. */
export const publishSnippets: Readonly<Record<RequestLanguage, Snippet>> = {
  cli: { code: cli, filename: "publish.sh", grammar: "bash", label: "CLI" },
  curl: { code: curl, filename: "publish.sh", grammar: "bash", label: "curl" },
  dotnet: {
    code: dotnet,
    filename: "Publish.cs",
    grammar: "csharp",
    label: ".NET",
    sdk: {
      call: "peal.Posts.CreateAsync(",
      declaration: "public WithRawResponseTask<Post> CreateAsync(",
      folder: "dotnet",
      names: [
        {
          file: "src/Peal/PealClient.cs",
          name: "public PealClient(string token, string? workspace = null, ClientOptions? clientOptions",
        },
        {
          file: "src/Peal/Core/Public/ClientOptions.cs",
          name: "public TimeSpan Timeout",
        },
        {
          file: "src/Peal/Posts/Requests/NewPost.cs",
          name: "public string? Wait",
        },
        {
          file: "src/Peal/Posts/Requests/NewPost.cs",
          name: "public string? IdempotencyKey",
        },
        {
          file: "src/Peal/Types/PostTiming.cs",
          name: "public PostTiming(PostTiming.Now value)",
        },
      ],
      source: "src/Peal/Posts/PostsClient.cs",
    },
  },
  go: {
    code: go,
    filename: "publish.go",
    grammar: "go",
    label: "Go",
    sdk: {
      call: "api.Posts.Create(",
      declaration: "func (c *Client) Create(",
      folder: "go",
      names: [
        {
          file: "client/client.go",
          name: "func NewClient(opts ...option.RequestOption) *Client",
        },
        {
          file: "option/request_option.go",
          name: "func WithToken(token string)",
        },
        { file: "pointer.go", name: "func String(s string) *string" },
        { file: "posts.go", name: "IdempotencyKey    *string" },
        { file: "posts.go", name: "Wait              *string" },
      ],
      source: "posts/client/client.go",
    },
  },
  java: {
    code: java,
    filename: "Publish.java",
    grammar: "java",
    label: "Java",
    sdk: {
      call: "peal.posts().create(",
      declaration: "public Post create(NewPost request)",
      folder: "java",
      names: [
        {
          file: "src/main/java/social/peal/PealClientBuilder.java",
          name: "public PealClientBuilder token(String token)",
        },
        {
          file: "src/main/java/social/peal/resources/posts/requests/NewPost.java",
          name: "_FinalStage wait(String wait);",
        },
        {
          file: "src/main/java/social/peal/resources/posts/requests/NewPost.java",
          name: "_FinalStage idempotencyKey(String idempotencyKey);",
        },
        {
          file: "src/main/java/social/peal/types/PostTiming.java",
          name: "public static PostTiming now(PostTimingNow value)",
        },
      ],
      source: "src/main/java/social/peal/resources/posts/PostsClient.java",
    },
  },
  php: {
    code: php,
    filename: "publish.php",
    grammar: "php",
    label: "PHP",
    sdk: {
      call: "$peal->posts->create(",
      declaration: "public function create(NewPost $request",
      folder: "php",
      names: [
        {
          file: "src/Posts/Requests/NewPost.php",
          name: "$values['idempotencyKey']",
        },
        { file: "src/Posts/Requests/NewPost.php", name: "$values['wait']" },
        {
          file: "src/Types/PostTiming.php",
          name: "public static function now(PostTimingNow $now)",
        },
      ],
      source: "src/Posts/PostsClient.php",
    },
  },
  python: {
    code: python,
    filename: "publish.py",
    grammar: "python",
    label: "Python",
    sdk: {
      call: "peal.posts.create(",
      declaration: "def create(",
      folder: "python",
      names: [
        {
          file: "src/peal/posts/client.py",
          name: "idempotency_key: typing.Optional[str] = None",
        },
        {
          file: "src/peal/posts/client.py",
          name: "wait: typing.Optional[str] = None",
        },
        { file: "src/peal/__init__.py", name: '"PostTiming_Now"' },
        { file: "src/peal/__init__.py", name: '"PostContent"' },
      ],
      source: "src/peal/posts/client.py",
    },
  },
  ruby: {
    code: ruby,
    filename: "publish.rb",
    grammar: "ruby",
    label: "Ruby",
    sdk: {
      call: "peal.posts.create(",
      declaration: "def create(request_options: {}, **params)",
      folder: "ruby",
      names: [
        {
          file: "lib/peal/posts/types/new_post.rb",
          name: "field :idempotency_key",
        },
        { file: "lib/peal/posts/types/new_post.rb", name: "field :wait" },
        { file: "lib/peal/posts/types/new_post.rb", name: 'api_name: "when"' },
      ],
      source: "lib/peal/posts/client.rb",
    },
  },
  rust: {
    code: rust,
    filename: "main.rs",
    grammar: "rust",
    label: "Rust",
    sdk: {
      call: ".create(",
      declaration: "pub async fn create(",
      folder: "rust",
      names: [
        {
          file: "src/core/request_options.rs",
          name: "pub fn additional_header(",
        },
        {
          file: "src/api/types/new_post.rs",
          name: "pub fn wait(mut self, value: impl Into<String>)",
        },
        { file: "src/api/types/post_timing.rs", name: "pub fn now() -> Self" },
      ],
      source: "src/api/resources/posts/mod.rs",
    },
  },
  typescript: {
    code: typescript,
    filename: "publish.ts",
    grammar: "typescript",
    label: "TypeScript",
    sdk: {
      call: "peal.posts.create(",
      declaration: "public create(request: Peal.NewPost",
      folder: "node",
      names: [
        {
          file: "src/api/resources/posts/client/requests/NewPost.ts",
          name: '"idempotency-key"?: string;',
        },
        {
          file: "src/api/resources/posts/client/requests/NewPost.ts",
          name: "wait?: string;",
        },
      ],
      source: "src/api/resources/posts/client/Client.ts",
    },
  },
};

/** What the API answers once each channel has its result. */
export const publishResponse = JSON.stringify(
  {
    id: "0190f3a0-0000-7000-8000-00000000b001",
    status: "finished",
    outcome: "published",
    targets: channelIds.map((channelId, index) => ({
      id: `0190f3a0-0000-7000-8000-00000000d00${String(index + 1)}`,
      channelId,
      status: "published",
      publishedAt: `2026-11-16T08:00:0${String(index + 2)}.000Z`,
      permalink: `https://social.example/@peal_example/11551234567890${String(index + 1)}`,
      failureReason: null,
    })),
  },
  null,
  2
);

/** The command line's row: the request alone. */
export const cliRequest = cli;

// The MCP row: the configuration most MCP clients take for a remote
// server, as `peal mcp` prints it and the docs' MCP page shows it. The
// client then signs in, in a browser.
export const mcpConfig = JSON.stringify(
  {
    mcpServers: {
      peal: { type: "http", url: "https://app.peal.social/api/mcp" },
    },
  },
  null,
  2
);

/** A post.published delivery, as the docs' webhook events page shows one. */
export const webhookPayload = JSON.stringify(
  {
    data: {
      channelId: first,
      permalink: "https://social.example/@peal_example/115512345678901",
      platform: "mastodon",
      postId: "0190f3a0-0000-7000-8000-00000000b001",
      publishedAt: "2026-11-16T08:00:02.000Z",
      round: 1,
      targetId: "0190f3a0-0000-7000-8000-00000000d001",
      workspaceId,
    },
    id: "0190f3a0-0000-7000-8000-00000000e001",
    timestamp: "2026-11-16T08:00:03.000Z",
    type: "post.published",
    version: 1,
    workspaceExternalId: null,
  },
  null,
  2
);
