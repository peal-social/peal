# Writing assistant

- The assistant suggests a change to a post's text (rewrite in a tone,
  shorten to fit a platform, translate, suggest hashtags), or writes a
  first post from a subject (`write`, optionally in a tone, a language and
  a platform's limits), through the
  `WritingModel` port, on the provider `PEAL_AI_PROVIDER` names: one of
  the catalogue's (`peal-contract/ai-providers`, copied in the domain as
  `TextProviderIdSchema` and `providerAddresses`, kept equal by
  `test/assistant/api/contract.test.ts`), reached at its own address
  unless `PEAL_AI_BASE_URL` names a proxy, or `openai-compatible`, any
  endpoint that serves `/chat/completions`, at the address given. It calls
  the provider with plain fetch, not through the outbound guard: the
  operator, not a member, names it. Unset,
  `UnavailableWritingModelLive` turns it off, and the status answers
  `available: false`.
- Every model is the AI SDK's (`ai`, `@ai-sdk/*`) under effect/ai: the
  run loop, tools, approvals and structured output stay effect/ai's, and
  only the model underneath is the SDK's. Only
  `infrastructure/ai-sdk/` imports the SDK (the lint rules refuse it
  elsewhere, and its hosted gateway everywhere): `models.ts` builds a
  provider's package from its settings and a fetch (an exhaustive record
  by provider: a catalogue id without an adapter does not compile; each
  factory given its key and address, never its environment variables;
  Anthropic at `{address}/v1`; DeepSeek's package, which answers
  `json_object` only; OpenRouter with `provider.require_parameters`;
  every other on chat completions with a strict JSON schema), built for
  each call and never cached, `Redacted.value` there alone. Loading it
  turns the SDK's console warnings off and replaces its default provider
  with one that has no model, so a model named by a string alone throws
  instead of reaching the vendor's gateway. `language-model.ts` is the
  adapter (`LanguageModel.make`): the SDK's `generateText` or
  `streamText` once (`maxRetries: 0`), its telemetry off, the fiber's
  abort signal; tools without `execute`; the JSON schema effect/ai writes
  (Anthropic's strict codec and its native format, else OpenAI's), decoded
  by effect/ai; only Anthropic's cache breakpoint passes as a provider
  option. Its failures are AiError by the SDK error's name and status
  alone (as effect/ai's own adapters read statuses; a finish by content
  filter in a whole answer is `ContentPolicyError`): the SDK's error,
  which carries the request's body and the provider's words, is never a
  cause or a log. A 400 whose answer names the key (xAI's and Google's
  answer to a wrong key) reads as a 401 (`providerStatusOf`,
  `ai-sdk/provider-status.ts`, in every adapter): the answer is searched
  for those words, never kept. Token counts come back in the `finish` part, so the
  span gets `gen_ai.usage.*`; nothing else of the SDK is traced.
- Drafts are data, never instructions. The system message depends on the
  action alone (`assistant/domain/writing-prompt.ts`); the draft goes in the
  user message as the single field of a JSON document (`draft`, or
  `subject` for `write`, the plan's `field`). Never put a draft's
  text, or anything a member typed, in the instructions.
- The model answers in a shape Schema decodes, and the domain checks it
  (`suggestion.ts`) before anyone sees it. Answers are returned whole, never
  streamed, so nobody reads unchecked text.
- Never log or trace a prompt, a draft or an answer, nor a provider's error,
  which can quote them. The adapter turns effect/ai's and the HTTP client's
  spans off around the call, sends the provider no trace context, and
  records only the provider, the model, token counts and the kind of
  failure; `WritingFailed` carries no cause. `assistant.daily_usage` holds
  counts only.
- Every use case checks `assistant:use` (owners, admins, editors and
  contributors; not viewers, nor read-only OAuth clients) and works in the
  actor's workspace only.
- The quota is per UTC day, across the billing account's workspaces on a
  server that bills and per workspace elsewhere: `AssistantAllowance` gives
  the limit (the plan's on a server that bills, otherwise
  `PEAL_AI_DAILY_REQUESTS`, 100), whether a day is shared (`pooled`, on a
  server that bills) and the pool (`sharedWith`, billing's `PlanPools`,
  held; `sharingWith` for reports, holding nothing). `AssistantUsage.claim`
  counts a request before the call: alone (`pooled` false), in one
  conditional upsert, as before per-account pricing; in a pool, in a
  transaction holding the pool, whose claims so take turns, the pool's day
  counted with it in one count, the ids as one parameter (`anyUuid`).
  Never lock each workspace of a pool: a partner's holds thousands, and
  Postgres's lock table would run out. Each workspace keeps its own count;
  the status and billing's usage show the pool's (`pooledUsed`, with
  `sharingWith`). A partner's customers share the partner's day, as one
  payer. Requests sent together never pass it. Give a
  request back only when the provider never ran it (`unreachable`); a
  timeout, a refusal or an unusable answer counts.
- On a server that bills the server's models are metered by billing
  account and calendar month instead, for the free tier and per-account
  pricing (`AssistantAllowance.metered(workspaceId)`; a legacy plan keeps
  its plan's day): `suggest` claims one `assistantRequests`,
  `generateImage` one `assistantImages` after its checks and slot, through
  `MeteredUsage`, before the provider is asked; none without a payment
  method (`AllowanceReached`, answered `UsageAllowanceReached`). Either is
  given back when the provider never ran it (or the library kept
  nothing), and forgiven when it failed once the provider had it (a
  timeout, a refusal, an unusable answer, the caller gone): free up to the
  meter's allowance a month, then counted (`MeteredUsage.forgive`).
  `suggest` claims, counts the day and installs the finalizer that takes
  them back in one uninterruptible region (`Effect.uninterruptibleMask`,
  the model alone restored), so an interruption never leaves a unit
  claimed. A text request still counts in `assistant.daily_usage`, unbounded, for the
  usage ledger's snapshot; images no longer take the day's requests. The
  status answers `month` and `images.month` (included, used, the most,
  price, ceiling, `priceConfirmed`), the daily fields from the month, and
  `available: false` with `reason: paymentMethod` without one. A
  workspace's own providers claim nothing, on any standing: they are the
  free tier's assistant. Elsewhere, nothing of this applies.
- The agent (`src/agent/`) asks the same model, chosen the same way,
  through `AgentModelAccess`: the workspace's own provider with its slot
  and day's count, else the server's model claimed as `suggest` claims
  it, one request a model round.
- The model has 90 seconds to answer (`answerTimeout`). Anything between the
  browser and the server must wait longer: the web app's `/api` proxy waits
  120 seconds (`experimental.proxyTimeout` in `next.config.ts`).
- The assistant reads platforms' text limits through its `PlatformLimits`
  port, from `publishing/application/platform-text-limits.ts`. Its tones and
  languages are listed in its domain and copied in the contract, kept equal
  by `test/assistant/api/contract.test.ts`.
- Images go through an `ImageModel` port of their own, apart from the
  writing model, which may make none: `PEAL_AI_IMAGE_PROVIDER` (an image
  provider of the catalogue, `aiImageProviders`, copied in the domain as
  `ImageProviderIdSchema`, `imageProviderAddresses` and `imageDimensionsByProvider`,
  kept equal by `test/assistant/api/contract.test.ts`: `openai`,
  `google`, `xai`, `togetherai`, reached at its own address unless
  `PEAL_AI_IMAGE_BASE_URL` names a proxy, its key required; or
  `openai-compatible`, at the address given, its key optional; unset for
  off: `UnavailableImageModelLive`), `PEAL_AI_IMAGE_MODEL`. Every image
  is the AI SDK's `generateImage` (`ai-sdk/image-model.ts`,
  `generateImageWith`): the provider's package from `imageModelOf`
  (`ai-sdk/models.ts`, an exhaustive record by image provider, key and
  address always given, built per call; `openai-compatible` sends
  `POST {base}/images/generations` with `{ model, n, prompt, size }` and
  no `response_format`, as Peal's own adapter did), one image, the
  shape as the provider takes it (`imageDimensionsOf`: a size for OpenAI,
  Together AI and the generic endpoint, a ratio for Gemini and xAI), the
  SDK's retries off and the fiber's abort signal. Its failures are
  `ImageCallFailed` by the SDK error's name and status alone, never kept
  or logged. The call's fetch sends the API's request through `api` until
  a success, then every later request (an image given by address) through
  `download`, the guarded fetch bounded at `maxImageBytes`
  (`imageDownloadFetch`), which follows no redirect; a failure once the
  API answered is the answer's (`unusable`). The server's adapter
  (`sdk-image-model.ts`) calls the API with plain fetch cut off past
  `maxAnswerBytes` (`boundedFetchWith`), at the operator's host; the call
  waits `imageAnswerTimeout` (90 seconds). 401, 402, 403 and 404 say the
  operator's settings are wrong: logged by status alone, answered
  `AssistantUnavailable`, and images stay off (`available` false) until
  the server restarts. Another 4xx is `refused`, 429 and 5xx
  `unreachable`, a request never sent `unreachable`, an answer without an
  image the library takes `unusableAnswer`, anything else the package
  refused `refused`. Each provider was tested on a fake fetch or a
  loopback fake only: none has called a real provider.
- `generateImage` needs `assistant:use` and `media:upload`. Before anything
  is spent: the model on, the prompt checked (1 to 1,000), the plan's
  storage room for the largest image (`GeneratedImages.roomFor`), one of
  the `imagesAtOnce` slots (two a workspace, eight a server, `ImageSlots`,
  past them `ImagesBusy`, 429), then `imageRequestCost` (5) claimed of the
  same daily requests a suggestion takes one of (`AssistantUsage.claim`'s
  cost), within `AssistantAllowance.imageRequests`: the day's limit, but
  `imageRequestsOnTrial` (0) while the plan is on trial. The cost is given
  back whenever no image came of it (`unreachable`, `refused`, the
  settings refused, or `PlanLimitReached` when the library counts again);
  a timeout or an unusable answer counts. No plan or price changes, and
  the free plan's 3 make none.
- The image is kept through the `GeneratedImages` port, whose adapter
  (`library-generated-images.ts`) calls the media context's
  `storeGenerated`: stored untouched, marked `aiGenerated`, no alt text.
  Bytes the library does not take are `ImageFailed` `unusableAnswer`, and
  count. Never log or trace a prompt, an image or a provider's error;
  `ImageFailed` carries no cause.
- A workspace connects its own providers (`ProviderConnections`,
  `assistant.provider_connections`, one row a workspace and provider: its
  address and its key) and chooses, for each use, one of them and a model
  (`CapabilityModels`, `assistant.capability_models`, one row a workspace
  and use, its foreign key on the connection with `ON DELETE CASCADE`, so
  removing a connection unsets what it served). The uses are
  `AiCapabilitySchema` (`domain/ai-capability.ts`, `text`, `image`,
  `video`, `speech`, `transcription` and `composition`, copied from the contract's
  `AiCapability` and kept equal by `test/assistant/api/contract.test.ts`):
  a later use joins the list, its adapter and its row in the page. A
  connected provider is any of the catalogue's
  (`ConnectedProviderIdSchema`: the text providers, then `elevenlabs`,
  `fal` and `shotstack`, which write no text); `offersCapability` reads each use's own
  list, so a provider without text is refused a text model, the test
  (`CapabilityNotOffered`) and the deprecated text endpoint
  (`AiCapabilityNotOffered`). ElevenLabs and fal are reached at their own
  addresses alone (`fixedAddressProviders`: their packages send to their
  own hosts whatever the address), so a connection with another address
  is `ProviderAddressRejected` `fixedAddress`.
  Which uses a provider offers is the catalogue's (`offersCapability`),
  never a row's; a row naming a provider or a use this release does not
  know is left out as if absent, so a roll-back from a later release
  reads the rest. A connection keeps the provider's own address
  (`connectionAddresses`, the catalogue's `baseUrl`) or a proxy's; a use's
  address is it followed by what the use's own address adds to the
  provider's (`capabilityAddressOf`: `/openai` for Gemini's text, nothing
  elsewhere; Together AI's text and images both at `api.together.xyz/v1`).
  Its key is sealed through `ProviderSecrets` for the connection
  (`assistant:provider:<workspace>:<provider>:<address>`): a row copied to
  another workspace or provider, or whose address changed, opens without
  it. `ProviderConnections.save`, `.remove`, `CapabilityModels.set` and
  `.unset` (`drizzle-provider-connections.ts`) each delete, in their
  transaction, the workspace's rows of the two tables the release before
  kept, so a roll-back never brings back a key replaced or removed since;
  `set` keeps a choice only while its provider is connected (false
  otherwise, `ProviderNotConnected`). The use cases
  (`provider-connection-settings.ts`, `capability-model-settings.ts`) and
  their endpoints (`GET …/assistant/providers`, `PUT` and `DELETE
  …/providers/{provider}`, `POST …/providers/{provider}/test`, `GET
  …/models`, `PUT` and `DELETE …/models/{capability}`) follow the rules
  below: `assistant:configure`, the address checked once by the guard,
  the key kept only for the same address (`ProviderKeyRequired`), the
  provider never called on save, no MCP tool; a choice needs a connected
  provider that offers the use (`CapabilityNotOffered`). The test asks
  for text with the model given, else the text's when on that provider,
  else the catalogue's first (`firstTextModels`), else
  `TestModelRequired`; it counts as one of `ownTextRequestsPerDay`. The
  models list says, for each use, whether the server has a model of its
  own (`serverModel`: `WritingModel.available`, `ImageModel.available`).
- The text and image provider ports (`TextProviders`, `ImageProviders`)
  and their deprecated endpoints are views of a use and its connection
  (`drizzle-text-providers.ts`, `drizzle-image-providers.ts`, on
  `capability-uses.ts`): reading opens the use's connection at the use's
  address; saving connects the provider at that address less what the
  use adds (`connectionAddressOf`), then chooses the use; removing unsets
  the use, and removes the connection when no other use is on it. Every
  use case that asks a workspace's own model (`suggest`, the agent,
  `generateImage`, the tests) reads them, so their rules below hold
  unchanged. Saving a text provider at another address of a provider the
  images are on moves the images there too: one address a provider.
- The release before kept one text and one image provider a workspace
  (`assistant.text_providers`, `assistant.image_providers`). When the
  assistant starts (`MoveEarlierProvidersLive`, before anything reads a
  use), `moveEarlierProviders` moves each row of a use the workspace has
  not chosen: its key opened for its earlier binding and sealed again for
  the connection's (one that no longer opens is copied as it is, and
  stays unreadable), text first, so where both rows name a provider the
  text's address and key make the connection; an image row of another
  address rides the text's connection, but for `openai-compatible`, where
  another address is another endpoint: it stays unchosen, its row in
  place. Inserts take `ON CONFLICT DO NOTHING`, so servers starting
  together move nothing twice, and a later start finds nothing to move.
  Each row moves in a transaction that locks it first (`FOR UPDATE`) and
  skips it once gone: an erasure deletes the earlier rows before the
  connections, so a start during one never leaves a key behind.
  The earlier tables are read-only otherwise and stay for a roll-back
  (`packages/peal-infra/ansible/runbooks/roll-back.md`); a later release
  drops them. Exports give the connections without their keys and the
  choices (`exportProviders`, `exportModels`, beside the text and image
  providers read on them); erasing a workspace deletes its connections,
  its choices and the earlier rows.
- The image provider's rules (`ImageProviders`, its deprecated
  endpoints): a `provider` of the
  catalogue's image providers (`openai-compatible` when a change names
  none, and for a row without one or with one this release does not
  know), an address, the catalogue's unless one is given
  (`openai-compatible` has none)
  (`checkProviderAddress`: HTTPS on the default port, as the outbound guard
  takes, no credentials, query or fragment, 2,048 characters, stored
  without its final slashes),
  a model (one line, `providerModelPattern`) and a key, sealed through the
  `ProviderSecrets` port on the channels context's `TokenCipher`
  (`CipherProviderSecrets`), bound to the connection's context (above;
  `assistant:<workspace>:<address>` for the release before's rows), the
  whole address: a row whose address changed in any way, or moved to
  another workspace, opens without its key (`keyUnreadable`), so a key
  never reaches an address it was not typed for. No crypto here. Saving checks the address with the outbound
  guard once (`ProviderAddressCheck`), never calls the provider, and keeps
  the stored key only while the address stays exactly the same
  (`ImageProviderKeyRequired` otherwise); without a keyring nothing is stored
  (`ProviderSecretsNotConfigured`, 503). `assistant:configure` (owners,
  admins, keys and partner keys given it; withheld from staff
  impersonating, and from every OAuth client but Peal's command line:
  `commandLineOnlyPermissions`) reads, sets and removes it; no MCP tool
  does. Staff
  impersonating a member make no image with it either: the workspace's
  account pays.
- With a provider, `generateImage` asks `OwnImageModel` only
  (`own-image-model.ts`, the same SDK call as the server's adapter): the
  address checked by the guard before the call, then the guarded fetch
  (`publicFetchWith`) for the API too (the guard on every request, no
  redirect, the answer bounded at `maxAnswerBytes`; a 3xx is
  `redirected`), with slots of its own (`ImageSlots.take(…, "workspace")`, as
  many as the server model's, so a silent endpoint starves nobody else),
  the storage check, and `ownImagesPerDay` (50) a workspace and UTC day,
  counted whatever each ends with (`OwnImageCounts`,
  `assistant.own_image_days`; `OwnImagesExhausted`, 429). It reads and
  counts nothing of `AssistantAllowance` or `AssistantUsage`, on any plan. Never
  the server's `ImageModel`, not even when it fails, nor with a key that no
  longer opens (`ImageProviderRefused` `keyUnreadable`). 401 to 404 and an
  address the guard refuses are `ImageProviderRefused`, with no state: the
  next call tries again. Its logs and span say `workspace`, the status and
  the kind of failure: never the host, the model, the prompt or the key.
  The status answers `images.source` (`workspace`, `server` or null), and
  `requestCost` 0 for the workspace's own. Exports give the provider, the
  address, the model and the date (`UsageRecords.exportImageProvider`),
  never the key;
  erasing a workspace deletes the row. The row names no member: the
  activity log keeps who saved it.
- The text provider's rules (`TextProviders`, its deprecated endpoints):
  a `provider` from the
  catalogue (a change names it, or its `kind` alone: `anthropic`, else
  `openai-compatible`), its address the catalogue's unless one is given
  (`openai-compatible` has none), its `kind` read from it (`anthropic`,
  else `openai-compatible`). The image provider's address, model and key rules,
  its key the connection's (the release before's text rows were sealed
  for `assistant:text:<workspace>:<address>`). Same permission (`assistant:configure`), same keeping of
  the key on save (`TextProviderKeyRequired`), no MCP tool.
- With one, `suggest` asks `OwnWritingModel` only (`own-writing-model.ts`):
  the server's own adapters (`languageModelOf`) on the guarded fetch
  (`publicFetchWith`), the address checked by the guard before
  the call (a refusal is `TextProviderRefused` `addressRefused`) and on
  every request as it is sent; 401 to 404 `settingsRefused`, 3xx
  `redirected`, the rest `WritingFailed` as for the server's model. Never
  the server's `WritingModel`, not even when it fails, nor with a key that
  no longer opens (`keyUnreadable`); staff impersonating are refused.
  Each takes one of the `ownTextAtOnce` slots first (four a workspace,
  32 a server, `TextSlots`, apart from the server's model; past them
  `OwnTextBusy`, 429 `TextProviderBusy`, counted nothing), and answers are
  read up to 256 KiB (`maxAnswerBytes`).
  Every request counts in `ownTextRequestsPerDay` (500) a workspace and
  UTC day, whatever it ends with (`OwnTextCounts`,
  `assistant.own_text_days`; `OwnTextExhausted`, 429), and nothing of
  `AssistantAllowance` or `AssistantUsage` is read or counted, on any plan:
  that is how a workspace without Peal-paid AI uses the assistant. Its logs
  and span say `workspace` and the provider, never the host, the model,
  the draft or the key. The status answers `source` (`workspace`, `server`
  or null), and `available` is true whenever someone writes.
- `testTextProvider` sends the saved provider one fixed rewrite, read as a
  member's would be, and counts as one of its day's requests;
  `TextProviderNotSet` (404) without one. Exports give the kind, provider, address,
  model and date (`exportTextProvider`) and the day's counts
  (`exportOwnText`), never the key; erasing a workspace deletes both.
- Videos are the workspace's own provider's alone (the use `video`; the
  operator has no video model, and nothing is metered or billed: the rate
  card has no video meter): Gemini's Veo and xAI's Grok Imagine
  (`domain/video-provider.ts`, `videoOffers`, copied from the catalogue's
  `aiVideoProviders` and kept equal by `test/assistant/api/contract.test.ts`:
  the ratio of each aspect, null where it makes none, the lengths it
  takes, null where it takes none, and whether a first frame may start it).
  `AssistantVideos.request` (the `videoGenerations` endpoints, `POST
  …/media/videos/generations`) needs `assistant:use` and `media:upload`
  (reads `assistant:use`), refuses staff acting as a member, checks the
  prompt (1 to 1,000), the choice (`VideoUnavailable` `notSet` or
  `keyUnreadable`), what the provider takes (`checkVideoAsk`,
  `VideoRejected`), a first frame that is a ready image of the workspace
  and the plan's room for `maxVideoBytes` (200 MiB, `GeneratedVideos`),
  then records the job and starts `GenerateVideoV1` in one transaction
  (`VideoGenerationStore.start`, `assistant.video_generations`): jobs
  queued or running since `staleVideoAfter` (30 minutes) fail
  `interrupted` and are told; one still on its way is `VideoBusy` (the
  partial unique index `video_generations_one_at_a_time` decides); past
  `videosPerDay` (20) since midnight UTC, whatever each ended with,
  `VideosExhausted`. The prompt is kept on the row only while the job is
  on its way, and erased when it ends.
- `GenerateVideoV1` (`infrastructure/workflows/generate-video.ts`, persisted
  contract: its tag, payload `generationId`, activity `generate`, result
  `succeeded | failed | superseded`) runs `RunVideoGeneration.run` in one
  activity, never retried. The row is the journal: a run takes one of
  `videosAtOnce` (4) of the server (`VideoSlots`, waiting, still queued),
  then makes the job `running` (`claim`, only from `queued`) before it asks
  anything; a run that finds it `running` already (its server stopped
  while the provider made it, and the workflow ran the activity again)
  fails it `interrupted` without asking, as the provider may have made
  and billed it; one that finds it ended is `superseded`. It reads the
  choice for videos as it stands then (`unavailable`, `keyUnreadable`, a
  request the provider no longer takes `refused`), the first frame
  (`imageUnavailable`), the room again (`storageFull`), asks
  `OwnVideoModel`, and keeps the video through `GeneratedVideos`
  (`library-generated-videos.ts`, on the media context's `GeneratedMedia`
  and `MediaForPlatforms`: stored as it came, `aiGenerated`, probed;
  `unusableAnswer`, `notStored`, `storageFull`). The job ends in one
  transaction with its notice (`VideoNotices`, on Notify:
  `VideoGenerationEnded`, keyed `video-generation:<id>`, to the member who
  asked alone, in the app, never emailed; a key's job tells nobody). A
  defect fails the job `interrupted`, logged without what it held.
  `test/assistant/infrastructure/generate-video-workflow.test.ts` restarts
  a server while the provider makes a video.
- `OwnVideoModel` (`own-video-model.ts`) is the AI SDK's
  `experimental_generateVideo` (`ai-sdk/video-model.ts`,
  `generateVideoWith`, the provider's package from `videoModelOf`): one
  video, `maxRetries: 0` (the start is never sent twice, nor a poll
  tried again), its polling every `videoPollInterval` (10 s) and bounded
  past the call's own `videoTimeout` (15 minutes, `timedOut`), the
  fiber's abort signal. The address is checked by the guard before the
  call; the start and each poll go through the guarded fetch, answers cut
  at 1 MiB; the video through another guarded fetch, `createDownload`
  bounded at `maxVideoBytes`, whose redirects the SDK follows, each
  checked by the guard (Gemini's package adds the key to the video's
  address only on its own API's origin). Failures are `VideoCallFailed` by
  the SDK error's name and status alone, then the job's reason
  (`reasonOfVideoStatus`: 401 to 404 `settingsRefused`, 3xx `redirected`,
  429 and 5xx `unreachable`, another `refused`; a request never sent
  `unreachable`, an operation the provider failed `refused`, no video
  `unusableAnswer`; a guard refusal `addressRefused`). Its logs and span
  say `workspace`, the provider and the kind of failure, never the host,
  the model, the prompt, the video's address or the key. Each provider
  was tested on a fake fetch only: none has called a real provider.
  Exports give the jobs without prompts (`exportVideos`); erasing a
  workspace deletes them, and a job still on its way then ends
  `superseded`. No MCP tool makes a video: it spends the member's money
  at their provider.
- Voice-overs (`speech`) and transcripts (`transcription`) are the
  workspace's own providers' alone, as videos are (the operator has
  none; nothing metered or billed): `domain/audio-provider.ts`
  (`speechOffers`, `transcriptionAddresses`, from the catalogue's
  `aiSpeechProviders` and `aiTranscriptionProviders`, kept equal by the
  contract test). `AssistantAudio` (the `mediaAudio` endpoints, `POST
  …/media/voiceovers` and `POST …/media/{mediaId}/transcription`) runs
  in the request, Peal sending the request, waiting and keeping the
  result, no job and nothing rendered on the server. A voice-over needs
  `assistant:use` and `media:upload`, refuses staff acting as a member,
  checks the text (1 to `maxVoiceoverTextLength`, 4,000), the choice
  (`AudioUnavailable`), a voice only for a provider that takes one
  (`VoiceNotOffered`), the plan's room for `maxVoiceoverBytes` (48 MiB,
  `AudioLibrary.roomFor`), then counts one of `voiceoversPerDay` (50,
  `OwnAudioCounts`, `assistant.own_audio_days`, by workspace, UTC day and
  use, whatever each ends with; `AudioExhausted`) before the provider is
  asked, and keeps the audio through `AudioLibrary` (`library-audio.ts`,
  on the media context's `MediaLibrary.storeGeneratedAudio`: stored as it
  came, `aiGenerated`, probed). A transcript needs `assistant:use` and
  `media:read` (and `media:upload` with `saveAsDescription`), reads a
  ready audio or video file of at most `maxTranscriptionBytes` (25 MB,
  `MediaLibrary.readMedia`; `AudioNotTranscribable` otherwise), counts one
  of `transcriptionsPerDay` (50), sends the bytes, and saves the text as
  the file's description only when asked and when it fits one (an
  `AltTextTooLong` answers `descriptionSaved: false`).
- `OwnAudioModel` (`own-audio-model.ts`) is the AI SDK's `generateSpeech`
  and `transcribe` (`ai-sdk/audio-model.ts`, the packages from
  `speechModelOf` and `transcriptionModelOf` in `models.ts`: OpenAI,
  Gemini, Mistral, xAI, Groq, ElevenLabs, fal), `maxRetries: 0`, telemetry
  off, the fiber's abort signal, the provider's default format (MP3, WAV
  for Gemini), a voice only when named. The address is checked by the
  guard before the call; every request (and the audio fal's answer links
  to, which carries no key) goes through the guarded fetch, answers cut
  at `maxVoiceoverBytes` or 2 MiB for a transcript; the call waits
  `audioTimeout` (90 s, `timedOut`). Failures are `AudioCallFailed` by the
  SDK error's name and status alone, then `AudioFailed`
  (`reasonOfAudioStatus`, as videos'); logs and span say `workspace`, the
  use, the provider and the kind of failure, never the host, the model,
  the text, the audio or the key. Each provider was tested on a fake
  fetch or a loopback fake only. Erasing a workspace deletes its counts.
  No MCP tool makes either.
- Slide videos (the use `composition`: no AI, but connected and chosen
  as the others are, its model stored as `edit`, `compositionModel`, and
  `setModel` taking none for it, `ModelRequired` for every other use) are
  composed by the workspace's own Shotstack account, never on Peal's
  server: `domain/composition-provider.ts` (`compositionOffers`, the
  catalogue's `aiCompositionProviders`, kept equal by the contract test).
  Shotstack is reached at its production API (`…/edit/v1`, the default:
  the account's credits, no watermark) or its sandbox (`…/edit/stage`:
  free, every video watermarked, its own key) alone
  (`fixedAddressesOf`, `ProviderAddressRejected` `fixedAddress`
  otherwise). `AssistantSlideshows.request` (the `slideshows` endpoints,
  `POST …/media/slideshows`) needs `assistant:use` and `media:upload`,
  refuses staff acting as a member, checks the choice
  (`CompositionUnavailable`), then, on a server that bills, a payment
  method on the billing account (`MeteredUsage.paymentMethod`: an active
  or past due subscription, a trial needing none; `CompositionNeedsPayment`,
  answered with the workspace's billing page from `UpgradePaths.paid`; a
  server that does not bill allows it), each image a ready JPEG or PNG of
  the workspace and the voice-over a ready audio file whose length is
  known (`SlideshowMedia.describe`, `SlideshowRejected`), the length
  (`slideshowLengthOf`: 2 to 10 seconds a slide, 4 unless asked or fitted
  to the voice-over, 90 in all) and the room for `maxSlideshowBytes`
  (200 MiB), then records the job with its plan (the slides, captions
  included) and starts `ComposeSlideshowV1` in one transaction
  (`SlideshowStore.start`, `assistant.slideshows`, the partial unique
  index `slideshows_one_at_a_time`; `staleSlideshowAfter` 40 minutes;
  `slideshowsPerDay` 20, `SlideshowsExhausted`). Nothing of Peal's is
  metered or billed. The plan is erased when the job ends.
- `AssistantSlideshows.requestEdit` (`POST …/media/slideshows/edits`, the
  web app editor's document) starts the same job from a whole Shotstack
  Edit, after the same checks in the same order (permissions, staff, the
  choice, the payment method; the room last): the edit, its output
  defaulted first (`withOutputDefaults`: MP4, 1080p, 16:9), is one
  Shotstack's own schema accepts (`EditChecker`, whose adapter
  `shotstack/edit-checker.ts` is the one file that imports zod, through
  `@shotstack/schemas` 1.27.0, the version the editor's engine pins; it
  answers the edit as the schema reads it, its coercions and defaults
  applied, its errors never kept), then the pure rules of
  `domain/edit-render.ts`, whose comment lists every place an Edit names
  a file: each `src` (and every text of a generation's `options`) is
  `peal:media/<mediaId>`, a ready file of the workspace whose kind its
  asset takes (`SlideshowMedia.describe`; `mediaNotFound`,
  `mediaNotSupported`), a font on `https://fonts.gstatic.com/`, a
  caption's `alias://` or, in `options`, no address at all; anything else,
  and merge fields (whose placeholders could name any address), are
  `editInvalid`. The output is an MP4 at `preview` to `1080`, in 16:9, 9:16
  or 1:1 (the job's aspect), 30 fps at most, without `size`, `range`,
  `scaleTo`, `repeat`, `poster` or `thumbnail` (`outputNotSupported`);
  `maxEditTracks` 20 and `maxEditClips` 200 (`editTooLarge`); every clip
  whose start and length are numbers ends by `maxEditSeconds` 300
  (`editTooLong`, the latest such end the job's `durationSeconds`; `auto`,
  `end` and aliases Shotstack's render bounds). `imageMediaIds` lists every
  file it names, once each in order, of any kind. The stored plan is a
  union (`SlideshowPlanSchema`): the slide plan as before, untagged and
  decoded first, or `{ edit }`, the checked edit with its `peal:media/`
  names kept.
- `ComposeSlideshowV1` (`infrastructure/workflows/compose-slideshow.ts`,
  persisted contract: its tag, payload `slideshowId`, activity `compose`,
  result `succeeded | failed | superseded`) runs `RunSlideshow.run` in one
  activity, never retried, on the video job's journal rules (`claim` from
  `queued` only; a run that finds it `running` fails it `interrupted`
  without sending anything; `slideshowsAtOnce` 4 a server,
  `SlideshowSlots`). It reads the choice again, the room, then presigned
  GETs of this request's files alone (`SlideshowMedia.linkTo`, on the media
  context's `GeneratedMedia.sourceLink`: `MediaStorage.downloadUrl` for
  `sourceLinkLifetime`, an hour, whether or not the bucket is public;
  `mediaUnavailable` when one is gone; for an edit, one link a file it
  names, swapped in by `editWithLinks`), asks `OwnComposer`, and keeps the
  video through `GeneratedMedia.storeVideo` with `aiGenerated: false` (the
  workspace's own files, put together), probed. Its notice is
  `SlideshowEnded`, keyed `slideshow:<id>`, to the member who asked alone,
  in the app.
- `OwnComposer` (`own-composer.ts`, on `shotstack/client.ts`, outside
  `ai-sdk/`: the AI SDK composes nothing) is Shotstack's Edit API, read in
  its definition (`api.edit.json`) and guide, November 2026: `POST
  {base}/render` with the Edit `slideTimelineOf` builds
  (`shotstack/timeline.ts`, pure: images cropped to fill, `zoomIn`,
  `zoomOut`, `slideLeft`, `fade` in and out; captions as `rich-text` in
  Roboto, a font Shotstack has, white on a translucent black band at the
  bottom, on the top track; the voice-over an `audio` clip from 0 to the
  end; MP4, `resolution` `1080`, the aspect's `aspectRatio`, 25 fps;
  `timeline.cache` false and the `shotstack` destination excluded, so
  Shotstack hosts no copy and keeps no cached file), or, for an edit
  (`CompositionRequest` is a slide request or `{ edit }`), the edit with
  its links as `editRenderOf` forces it (`output.destinations` the
  excluded `shotstack` one alone, `timeline.cache` false, `output.format`
  `mp4`, no `callback` or `disk`), the key in
  `x-api-key`, sent once; then `GET {base}/render/{id}` every
  `slideshowPollInterval` (5 s; 3 polls in a row failing for now are
  borne) until `done` (its temporary `url`, downloaded without the key
  through another guarded fetch bounded at `maxSlideshowBytes`, a few
  redirects followed, each guarded) or `failed` (`refused`), within
  `slideshowTimeout` (20 minutes, `timedOut`). Every request goes through
  the guarded fetch (no redirect for the API, answers cut at 1 MiB, no
  trace context). Statuses read as videos' (`reasonOfComposerStatus`: 401
  to 404 `settingsRefused`, a 402 being an account without credits).
  Logs and span say `workspace`, the service and the kind of failure,
  never an address, a caption, an edit or the key. Tested on fake fetches only:
  nothing has called Shotstack. Exports give the jobs without plans
  (`exportSlideshows`); erasing a workspace deletes them. No MCP tool
  composes one.
