import { Console, Effect, Option, Redacted } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  AiCapabilityModelSchema,
  AiCapabilityModelsSchema,
  AiProviderConnectionSchema,
  AiProviderConnectionsSchema,
  anthropicApiAddress,
  ImageProviderSchema,
  ImageProviderSettingSchema,
  maxImageProviderModelLength,
  ownTextRequestsPerDay,
  TextProviderKindSchema,
  TextProviderSchema,
  TextProviderSettingSchema,
} from "peal-contract";
import type {
  AiCapabilityModel,
  AiProviderConnection,
  ImageProvider,
  TextProvider,
} from "peal-contract";
import {
  AiCapabilitySchema,
  AiImageProviderIdSchema,
  AiProviderIdSchema,
  aiProviders,
} from "peal-contract/ai-providers";

import { confirmed, neverAsksInJson, yesFlagName } from "#confirm.ts";
import { explain } from "#explain.ts";
import { jsonFlag, printJson, printNothing } from "#json.ts";
import { instant } from "#print.ts";
import { Refused } from "#refused.ts";
import { readSecret } from "#secret-input.ts";
import { inWorkspace, workspaceFlag } from "#workspace.ts";

// The provider as the user reads it: never its key, which the server does
// not send.
const lines = (provider: ImageProvider) => [
  `  Provider: ${aiProviders[provider.provider].name} (${provider.provider})`,
  `  Address: ${provider.baseUrl}`,
  `  Model:   ${provider.model}`,
  `  Key:     ${provider.keyUnreadable ? "saved, but it can no longer be read: give it again with set" : "saved (never shown)"}`,
  `  Saved:   ${instant(provider.updatedAt)}`,
];

const show = Command.make(
  "show",
  { json: jsonFlag, workspace: workspaceFlag },
  Effect.fn("assistant.imageProvider.show")(function* show(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const setting = yield* client.assistant
      .imageProvider({ params: { workspaceId: workspace.id } })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      yield* printJson(ImageProviderSettingSchema, setting);

      return;
    }

    if (setting.provider === null) {
      yield* Console.log(
        `${workspace.name} has no image provider of its own: images are made by the server's image model, if it has one.`
      );

      return;
    }

    yield* Console.log(`The image provider of ${workspace.name}:`);

    for (const line of lines(setting.provider)) {
      yield* Console.log(line);
    }
  })
).pipe(
  Command.withDescription(
    "Show the workspace's own image provider: the provider, its address and its model, never its key. Needs assistant:configure."
  )
);

const set = Command.make(
  "set",
  {
    baseUrl: Flag.String("base-url").pipe(
      Flag.withMetavar("<url>"),
      Flag.withDescription(
        "The API's base address: for openai-compatible, the address /images/generations follows, such as https://images.example.com/v1. A provider named with --provider is reached at its own address unless this names another (a proxy); openai-compatible has none, and needs it. HTTPS on the default port, on a public host."
      ),
      Flag.optional
    ),
    json: jsonFlag,
    keepKey: Flag.Boolean("keep-key").pipe(
      Flag.withDescription(
        "Keep the key already saved, which works only while --base-url stays exactly the address it was given for (to change the model alone): nothing is read for it."
      ),
      Flag.withDefault(false)
    ),
    model: Flag.String("model").pipe(
      Flag.withMetavar("<model>"),
      Flag.withDescription(
        `Your provider's model, as its documentation names it, one line of 1 to ${String(maxImageProviderModelLength)} characters.`
      )
    ),
    provider: Flag.Literals("provider", AiImageProviderIdSchema.literals).pipe(
      Flag.withDescription(
        `The provider by name, which sets the API it speaks and its address: ${AiImageProviderIdSchema.literals.join(", ")} (any other endpoint that serves /images/generations, with --base-url). Left out, openai-compatible.`
      ),
      Flag.optional
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("assistant.imageProvider.set")(function* set(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    // Never an argument: typed without echo, or piped in.
    const apiKey = input.keepKey
      ? Option.none<Redacted.Redacted>()
      : Option.some(yield* readSecret("The provider's key:"));

    const saved = yield* client.assistant
      .setImageProvider({
        params: { workspaceId: workspace.id },
        payload: {
          // Each left out when not given: the server reads the provider's
          // own address, and `openai-compatible`.
          ...Option.match(input.baseUrl, {
            onNone: () => ({}),
            onSome: (baseUrl) => ({ baseUrl }),
          }),
          ...Option.match(input.provider, {
            onNone: () => ({}),
            onSome: (provider) => ({ provider }),
          }),
          model: input.model,
          ...Option.match(apiKey, {
            onNone: () => ({}),
            onSome: (key) => ({ apiKey: Redacted.value(key) }),
          }),
        },
      })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      yield* printJson(ImageProviderSchema, saved);

      return;
    }

    yield* Console.log(
      `Saved the image provider of ${workspace.name}. Its image prompts now go to ${saved.baseUrl}, with the key, kept encrypted and never shown again; the images cost none of the workspace's assistant requests, and still take room in its storage. The first image tells whether the settings work.`
    );
  })
).pipe(
  Command.withDescription(
    "Set the workspace's own image provider: a provider by name (--provider), or an endpoint that speaks the OpenAI images API (--base-url). The key is never an argument: the command asks for it at a terminal, without echo, or reads it from standard input (peal assistant image-provider set --provider openai --model … < key.txt). Needs assistant:configure."
  )
);

const clear = Command.make(
  "clear",
  {
    json: jsonFlag,
    workspace: workspaceFlag,
    yes: Flag.Boolean(yesFlagName).pipe(
      Flag.withDescription(
        "The person who decides agreed to remove the provider and delete its key: do not ask again."
      ),
      Flag.withDefault(false)
    ),
  },
  Effect.fn("assistant.imageProvider.clear")(function* clear(input) {
    yield* neverAsksInJson({
      json: input.json,
      why: "it deletes the workspace's image provider key, which must then be given again",
      yes: input.yes,
    });

    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    if (!input.json) {
      yield* Console.log(
        `This removes the image provider of ${workspace.name} and deletes its key. Images are then made by the server's image model, if it has one, and cost the workspace's assistant requests.`
      );
    }

    yield* confirmed({ question: "Remove it?", yes: input.yes });

    yield* client.assistant
      .removeImageProvider({ params: { workspaceId: workspace.id } })
      .pipe(Effect.mapError(explain(url)));

    yield* input.json
      ? printNothing
      : Console.log(`Removed the image provider of ${workspace.name}.`);
  })
).pipe(
  Command.withDescription(
    "Remove the workspace's own image provider and its key. Asks first; --yes otherwise. Needs assistant:configure."
  )
);

const imageProvider = Command.make("image-provider").pipe(
  Command.withDescription(
    "Deprecated: use peal assistant providers and peal assistant models. The image provider the workspace brings: its images then go there, with its key, and cost none of Peal's assistant requests."
  ),
  Command.withSubcommands([show, set, clear])
);

// What each API is called when the user reads it.
const kindNames = {
  anthropic: "Anthropic's Messages API",
  "openai-compatible": "an OpenAI-compatible endpoint (chat completions)",
} as const;

// The text provider as the user reads it: never its key, which the server
// does not send.
const textLines = (provider: TextProvider) => [
  `  Provider: ${aiProviders[provider.provider].name} (${provider.provider})`,
  `  API:     ${kindNames[provider.kind]}`,
  `  Address: ${provider.baseUrl}`,
  `  Model:   ${provider.model}`,
  `  Key:     ${provider.keyUnreadable ? "saved, but it can no longer be read: give it again with set" : "saved (never shown)"}`,
  `  Saved:   ${instant(provider.updatedAt)}`,
];

const showText = Command.make(
  "show",
  { json: jsonFlag, workspace: workspaceFlag },
  Effect.fn("assistant.textProvider.show")(function* showText(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const setting = yield* client.assistant
      .textProvider({ params: { workspaceId: workspace.id } })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      yield* printJson(TextProviderSettingSchema, setting);

      return;
    }

    if (setting.provider === null) {
      yield* Console.log(
        `${workspace.name} has no text provider of its own: the writing assistant uses the server's language model, if it has one.`
      );

      return;
    }

    yield* Console.log(`The text provider of ${workspace.name}:`);

    for (const line of textLines(setting.provider)) {
      yield* Console.log(line);
    }
  })
).pipe(
  Command.withDescription(
    "Show the workspace's own text provider: the provider, the API it speaks, its address and its model, never its key. Needs assistant:configure."
  )
);

const setText = Command.make(
  "set",
  {
    baseUrl: Flag.String("base-url").pipe(
      Flag.withMetavar("<url>"),
      Flag.withDescription(
        `The API's base address: for anthropic, ${anthropicApiAddress}, which /v1/messages follows; for the others, the address /chat/completions follows, such as https://text.example.com/v1. A provider named with --provider is reached at its own address unless this names another (a proxy); openai-compatible has none, and needs it. HTTPS on the default port, on a public host.`
      ),
      Flag.optional
    ),
    json: jsonFlag,
    keepKey: Flag.Boolean("keep-key").pipe(
      Flag.withDescription(
        "Keep the key already saved, which works only while the address stays exactly the one it was given for (to change the model alone): nothing is read for it."
      ),
      Flag.withDefault(false)
    ),
    kind: Flag.Literals("kind", TextProviderKindSchema.literals).pipe(
      Flag.withDescription(
        "The API the provider speaks, when --provider does not name it: anthropic (Anthropic's Messages API) or openai-compatible (any endpoint that serves chat completions)."
      ),
      Flag.optional
    ),
    model: Flag.String("model").pipe(
      Flag.withMetavar("<model>"),
      Flag.withDescription(
        `Your provider's model, as its documentation names it, one line of 1 to ${String(maxImageProviderModelLength)} characters. It must answer in structured output (a JSON schema).`
      )
    ),
    provider: Flag.Literals("provider", AiProviderIdSchema.literals).pipe(
      Flag.withDescription(
        `The provider by name, which sets the API it speaks and its address: ${AiProviderIdSchema.literals.join(", ")} (any other endpoint that serves chat completions, with --base-url). Left out, --kind says the API.`
      ),
      Flag.optional
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("assistant.textProvider.set")(function* setText(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    // Never an argument: typed without echo, or piped in.
    const apiKey = input.keepKey
      ? Option.none<Redacted.Redacted>()
      : Option.some(yield* readSecret("The provider's key:"));

    const saved = yield* client.assistant
      .setTextProvider({
        params: { workspaceId: workspace.id },
        payload: {
          // Each left out when not given: the server reads the provider's
          // own address, and the provider from the kind.
          ...Option.match(input.baseUrl, {
            onNone: () => ({}),
            onSome: (baseUrl) => ({ baseUrl }),
          }),
          ...Option.match(input.kind, {
            onNone: () => ({}),
            onSome: (kind) => ({ kind }),
          }),
          ...Option.match(input.provider, {
            onNone: () => ({}),
            onSome: (provider) => ({ provider }),
          }),
          model: input.model,
          ...Option.match(apiKey, {
            onNone: () => ({}),
            onSome: (key) => ({ apiKey: Redacted.value(key) }),
          }),
        },
      })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      yield* printJson(TextProviderSchema, saved);

      return;
    }

    yield* Console.log(
      `Saved the text provider of ${workspace.name}. The drafts its members ask the assistant about now go to ${saved.baseUrl}, with the key, kept encrypted and never shown again; they cost none of the workspace's assistant requests, within ${String(ownTextRequestsPerDay)} a day. Check it works with peal assistant text-provider test.`
    );
  })
).pipe(
  Command.withDescription(
    "Set the workspace's own text provider, for the writing assistant: a provider by name (--provider), or Anthropic's Messages API or an OpenAI-compatible endpoint (--kind). The key is never an argument: the command asks for it at a terminal, without echo, or reads it from standard input (peal assistant text-provider set --provider anthropic --model … < key.txt). Needs assistant:configure."
  )
);

const testText = Command.make(
  "test",
  { json: jsonFlag, workspace: workspaceFlag },
  Effect.fn("assistant.textProvider.test")(function* testText(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    yield* client.assistant
      .testTextProvider({ params: { workspaceId: workspace.id } })
      .pipe(Effect.mapError(explain(url)));

    yield* input.json
      ? printNothing
      : Console.log(
          `The text provider of ${workspace.name} answered with a suggestion the assistant can use. The test counted as one of its requests today.`
        );
  })
).pipe(
  Command.withDescription(
    "Send the workspace's own text provider one short request, as a member's would go, and say whether it answered with a suggestion the assistant can use. It counts as one of that provider's requests today, and none of Peal's. Needs assistant:configure."
  )
);

const clearText = Command.make(
  "clear",
  {
    json: jsonFlag,
    workspace: workspaceFlag,
    yes: Flag.Boolean(yesFlagName).pipe(
      Flag.withDescription(
        "The person who decides agreed to remove the provider and delete its key: do not ask again."
      ),
      Flag.withDefault(false)
    ),
  },
  Effect.fn("assistant.textProvider.clear")(function* clearText(input) {
    yield* neverAsksInJson({
      json: input.json,
      why: "it deletes the workspace's text provider key, which must then be given again",
      yes: input.yes,
    });

    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    if (!input.json) {
      yield* Console.log(
        `This removes the text provider of ${workspace.name} and deletes its key. The writing assistant then uses the server's language model, if it has one, and its requests count against the workspace's daily allowance.`
      );
    }

    yield* confirmed({ question: "Remove it?", yes: input.yes });

    yield* client.assistant
      .removeTextProvider({ params: { workspaceId: workspace.id } })
      .pipe(Effect.mapError(explain(url)));

    yield* input.json
      ? printNothing
      : Console.log(`Removed the text provider of ${workspace.name}.`);
  })
).pipe(
  Command.withDescription(
    "Remove the workspace's own text provider and its key. Asks first; --yes otherwise. Needs assistant:configure."
  )
);

const textProvider = Command.make("text-provider").pipe(
  Command.withDescription(
    "Deprecated: use peal assistant providers and peal assistant models. The text provider the workspace brings: the drafts its members ask the writing assistant about then go there, with its key, and cost none of Peal's assistant requests."
  ),
  Command.withSubcommands([showText, setText, testText, clearText])
);

// A connected provider as the user reads it: never its key, which the
// server does not send.
const connectionLines = (connection: AiProviderConnection) => [
  `  ${aiProviders[connection.provider].name} (${connection.provider})`,
  `    Address: ${connection.baseUrl}`,
  `    Key:     ${connection.keyUnreadable ? "saved, but it can no longer be read: give it again with connect" : "saved (never shown)"}`,
  `    Saved:   ${instant(connection.updatedAt)}`,
];

const providerArgument = Argument.Literals(
  "provider",
  AiProviderIdSchema.literals
).pipe(
  Argument.withDescription(
    `The provider by name: ${AiProviderIdSchema.literals.join(", ")} (openai-compatible: any other endpoint of the OpenAI chat completions and images APIs, with --base-url).`
  )
);

const listProviders = Command.make(
  "list",
  { json: jsonFlag, workspace: workspaceFlag },
  Effect.fn("assistant.providers.list")(function* listProviders(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const connected = yield* client.assistant
      .providers({ params: { workspaceId: workspace.id } })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      yield* printJson(AiProviderConnectionsSchema, connected);

      return;
    }

    if (connected.providers.length === 0) {
      yield* Console.log(
        `${workspace.name} has connected no AI provider: the assistant uses the server's models, if it has them.`
      );

      return;
    }

    yield* Console.log(`The AI providers of ${workspace.name}:`);

    for (const connection of connected.providers) {
      for (const line of connectionLines(connection)) {
        yield* Console.log(line);
      }
    }
  })
).pipe(
  Command.withDescription(
    "List the AI providers the workspace connected: where each is reached, never its key. Needs assistant:configure."
  )
);

const connectProvider = Command.make(
  "connect",
  {
    baseUrl: Flag.String("base-url").pipe(
      Flag.withMetavar("<url>"),
      Flag.withDescription(
        "Where the provider is reached, when not at its own address (a proxy); openai-compatible has none, and needs it: the address /chat/completions and /images/generations follow, such as https://ai.example.com/v1. HTTPS on the default port, on a public host."
      ),
      Flag.optional
    ),
    json: jsonFlag,
    keepKey: Flag.Boolean("keep-key").pipe(
      Flag.withDescription(
        "Keep the key already saved, which works only while the address stays exactly the one it was given for: nothing is read for it."
      ),
      Flag.withDefault(false)
    ),
    provider: providerArgument,
    sandbox: Flag.Boolean("sandbox").pipe(
      Flag.withDescription(
        "Connect the provider's sandbox instead of its production API, for a provider that has one (Shotstack: free, every video watermarked, with the account's sandbox key)."
      ),
      Flag.withDefault(false)
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("assistant.providers.connect")(function* connectProvider(input) {
    const sandboxUrl = aiProviders[input.provider].composition?.sandboxUrl;

    // Refused before anything is read or sent.
    yield* input.sandbox &&
    (sandboxUrl === undefined || Option.isSome(input.baseUrl))
      ? Effect.fail(
          new Refused({
            reason:
              sandboxUrl === undefined
                ? `${aiProviders[input.provider].name} has no sandbox.`
                : "Give --sandbox or --base-url, not both.",
          })
        )
      : Effect.void;

    const baseUrl =
      input.sandbox && sandboxUrl !== undefined
        ? Option.some(sandboxUrl)
        : input.baseUrl;

    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    // Never an argument: typed without echo, or piped in.
    const apiKey = input.keepKey
      ? Option.none<Redacted.Redacted>()
      : Option.some(yield* readSecret("The provider's key:"));

    const saved = yield* client.assistant
      .connectProvider({
        params: { provider: input.provider, workspaceId: workspace.id },
        payload: {
          // Left out when not given: the server takes the provider's own.
          ...Option.match(baseUrl, {
            onNone: () => ({}),
            onSome: (address) => ({ baseUrl: address }),
          }),
          ...Option.match(apiKey, {
            onNone: () => ({}),
            onSome: (key) => ({ apiKey: Redacted.value(key) }),
          }),
        },
      })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      yield* printJson(AiProviderConnectionSchema, saved);

      return;
    }

    yield* Console.log(
      `Connected ${aiProviders[saved.provider].name} to ${workspace.name}, at ${saved.baseUrl}, with the key, kept encrypted and never shown again. Choose what it does with peal assistant models set, and check it works with peal assistant providers test ${saved.provider}.`
    );
  })
).pipe(
  Command.withDescription(
    "Connect an AI provider with the workspace's own key, or change its address or key. The key is never an argument: the command asks for it at a terminal, without echo, or reads it from standard input (peal assistant providers connect anthropic < key.txt). Needs assistant:configure."
  )
);

const testProvider = Command.make(
  "test",
  {
    json: jsonFlag,
    model: Flag.String("model").pipe(
      Flag.withMetavar("<model>"),
      Flag.withDescription(
        "The model to ask. Left out, the one the workspace's text is written with when this provider writes it, else the first Peal suggests."
      ),
      Flag.optional
    ),
    provider: providerArgument,
    workspace: workspaceFlag,
  },
  Effect.fn("assistant.providers.test")(function* testProvider(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    yield* client.assistant
      .testProvider({
        params: { provider: input.provider, workspaceId: workspace.id },
        payload: Option.match(input.model, {
          onNone: () => ({}),
          onSome: (model) => ({ model }),
        }),
      })
      .pipe(Effect.mapError(explain(url)));

    yield* input.json
      ? printNothing
      : Console.log(
          `${aiProviders[input.provider].name} answered with a suggestion the assistant can use. The test counted as one of the workspace's own requests today.`
        );
  })
).pipe(
  Command.withDescription(
    "Send a connected provider one short request for text, as a member's would go, and say whether it answered with a suggestion the assistant can use. It counts as one of the workspace's own requests today, and none of Peal's. Needs assistant:configure."
  )
);

const disconnectProvider = Command.make(
  "disconnect",
  {
    json: jsonFlag,
    provider: providerArgument,
    workspace: workspaceFlag,
    yes: Flag.Boolean(yesFlagName).pipe(
      Flag.withDescription(
        "The person who decides agreed to remove the provider and delete its key: do not ask again."
      ),
      Flag.withDefault(false)
    ),
  },
  Effect.fn("assistant.providers.disconnect")(
    function* disconnectProvider(input) {
      yield* neverAsksInJson({
        json: input.json,
        why: "it deletes the provider's key, which must then be given again",
        yes: input.yes,
      });

      const { client, url, workspace } = yield* inWorkspace(input.workspace);

      if (!input.json) {
        yield* Console.log(
          `This removes ${aiProviders[input.provider].name} from ${workspace.name}, deletes its key and unsets what it was used for: the server's models work for them again, if it has them.`
        );
      }

      yield* confirmed({ question: "Remove it?", yes: input.yes });

      yield* client.assistant
        .disconnectProvider({
          params: { provider: input.provider, workspaceId: workspace.id },
        })
        .pipe(Effect.mapError(explain(url)));

      yield* input.json
        ? printNothing
        : Console.log(
            `Removed ${aiProviders[input.provider].name} from ${workspace.name}.`
          );
    }
  )
).pipe(
  Command.withDescription(
    "Remove a connected provider, its key and the uses it served. Asks first; --yes otherwise. Needs assistant:configure."
  )
);

const providers = Command.make("providers").pipe(
  Command.withDescription(
    "The AI providers the workspace connects with its own key: what they do is peal assistant models's to set."
  ),
  Command.withSubcommands([
    listProviders,
    connectProvider,
    testProvider,
    disconnectProvider,
  ])
);

// What each use is called when the user reads it.
const capabilityNames = {
  composition: "Slide videos",
  image: "Images",
  speech: "Voice-overs",
  text: "Text",
  transcription: "Transcripts",
  video: "Videos",
} as const;

const modelLine = (chosen: AiCapabilityModel) => {
  if (chosen.provider === null || chosen.model === null) {
    return `  ${capabilityNames[chosen.capability]}: ${chosen.serverModel ? "the server's model" : "off"}`;
  }

  return `  ${capabilityNames[chosen.capability]}: ${aiProviders[chosen.provider].name} (${chosen.provider}), ${chosen.model}`;
};

const capabilityArgument = Argument.Literals(
  "capability",
  AiCapabilitySchema.literals
).pipe(
  Argument.withDescription(
    `The use: ${AiCapabilitySchema.literals.join(", ")}.`
  )
);

const listModels = Command.make(
  "list",
  { json: jsonFlag, workspace: workspaceFlag },
  Effect.fn("assistant.models.list")(function* listModels(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const chosen = yield* client.assistant
      .models({ params: { workspaceId: workspace.id } })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      yield* printJson(AiCapabilityModelsSchema, chosen);

      return;
    }

    yield* Console.log(`What ${workspace.name} uses for each use:`);

    for (const each of chosen.models) {
      yield* Console.log(modelLine(each));
    }
  })
).pipe(
  Command.withDescription(
    "Show, for each use (text, images, videos, voice-overs, transcripts, slide videos), the connected provider and the model the workspace chose, or the server's model, or off. Needs assistant:configure."
  )
);

const setModel = Command.make(
  "set",
  {
    capability: capabilityArgument,
    json: jsonFlag,
    model: Flag.String("model").pipe(
      Flag.withMetavar("<model>"),
      Flag.withDescription(
        `The provider's model, as its documentation names it, one line of 1 to ${String(maxImageProviderModelLength)} characters. Every use needs one but composition, which takes none.`
      ),
      Flag.optional
    ),
    provider: Flag.Literals("provider", AiProviderIdSchema.literals).pipe(
      Flag.withDescription(
        "A provider the workspace connected that offers this use."
      )
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("assistant.models.set")(function* setModel(input) {
    // Only composition goes without a model: refused before a request.
    yield* Option.isNone(input.model) && input.capability !== "composition"
      ? Effect.fail(
          new Refused({
            reason: `--model is required for ${capabilityNames[input.capability].toLowerCase()}.`,
          })
        )
      : Effect.void;

    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const chosen = yield* client.assistant
      .setModel({
        params: { capability: input.capability, workspaceId: workspace.id },
        payload: {
          provider: input.provider,
          ...Option.match(input.model, {
            onNone: () => ({}),
            onSome: (model) => ({ model }),
          }),
        },
      })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      yield* printJson(AiCapabilityModelSchema, chosen);

      return;
    }

    yield* Console.log(
      input.capability === "composition"
        ? `${workspace.name} now composes slide videos with ${aiProviders[input.provider].name}, with its own key: its account pays for each render, and Peal bills nothing for it.`
        : `${workspace.name} now uses ${aiProviders[input.provider].name}'s ${chosen.model ?? ""} for ${capabilityNames[input.capability].toLowerCase()}, with its own key: it costs none of Peal's assistant requests.`
    );
  })
).pipe(
  Command.withDescription(
    "Choose the connected provider and the model for one use (text, image, video, speech, transcription), or the service for slide videos (composition, no model). Needs assistant:configure."
  )
);

const unsetModel = Command.make(
  "unset",
  { capability: capabilityArgument, json: jsonFlag, workspace: workspaceFlag },
  Effect.fn("assistant.models.unset")(function* unsetModel(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    yield* client.assistant
      .unsetModel({
        params: { capability: input.capability, workspaceId: workspace.id },
      })
      .pipe(Effect.mapError(explain(url)));

    yield* input.json
      ? printNothing
      : Console.log(
          `${workspace.name} no longer uses a provider of its own for ${capabilityNames[input.capability].toLowerCase()}: the server's model works for it, if it has one. The provider stays connected.`
        );
  })
).pipe(
  Command.withDescription(
    "Leave one use to the server's model, if it has one, or off. The provider stays connected. Needs assistant:configure."
  )
);

const models = Command.make("models").pipe(
  Command.withDescription(
    "The model the workspace uses for each use (text, images), on a provider it connected."
  ),
  Command.withSubcommands([listModels, setModel, unsetModel])
);

export const assistant = Command.make("assistant").pipe(
  Command.withDescription(
    "The workspace's writing assistant settings: the AI providers it connects with its own keys, and the model it uses for each use."
  ),
  Command.withSubcommands([providers, models, imageProvider, textProvider])
);
