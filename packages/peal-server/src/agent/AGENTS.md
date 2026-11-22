# Agent

- The agent is the web app's chat in which a person asks about their
  workspace and has it do things, with the MCP endpoint's tools. Its
  endpoints are `AgentApi` (`peal-contract/agent`), apart from `Api`:
  never in the OpenAPI document, the SDKs, the command line or an MCP
  tool. `src/app/agent/live.ts` serves it beside `Api`, under
  `/api/workspaces/:workspaceId/agent`, behind the same Authentication and
  WorkspaceAccess, with its handlers in `src/app/agent/handlers.ts` (the
  composition root, as only it may import `peal-contract/agent`).
- Every use case (`AgentDesk`) needs `assistant:use` and a person in their
  own session (`inPerson`): an API key, an OAuth client and staff acting
  as someone get `PersonRequired` (403 `personRequired`). Chats are their
  author's alone: another person's id reads as none (`ChatNotFound`, 404),
  whatever is asked of it.
- Chats and messages are in the `agent` schema. A chat keeps what the
  model reads of it (`history`: effect/ai's `Prompt` as JSON, the person's
  messages, the answers' text and tool calls, and the tools' answers cut
  to `maxToolResultLength` with a note, `tool-result.ts`); never an
  approval's request. Messages are ordered by their ids (UUIDv7): the
  person's is issued before its answer's.
- One run at a time a chat, across servers: `claim` is one conditional
  update (`run_id`, `run_until`), refused while another's claim holds
  (`ChatBusy`, 409); a server that crashed lets go after `runLease`. A
  run's stream lets go of the chat and of what it holds (the own
  provider's slot) when it ends, however it ends, and a watchdog after
  the lease when the stream is never read.
- The model is the writing assistant's (`AgentModelAccess`, assistant
  application): the workspace's own text provider when it brought one
  (never the server's model then; one of the `ownTextAtOnce` slots for
  the run; each round one of its day's requests, whatever it ends with),
  else the server's (`PEAL_AI_PROVIDER`), each round claimed before it is
  sent: one `assistantRequests` on a server that bills (none without a
  payment method), one of the day's quota elsewhere; given back when the
  provider never ran it, forgiven when it failed once it had it. The
  first round's claim is made before any event, so its refusal is the
  request's error; a later one ends the run `failed` `allowanceReached`.
  The title's request counts nothing.
- A run (`language-model-agent-runs.ts`) streams up to `maxRounds` (8)
  rounds, each bounded by `roundTimeout` (90 s), the whole run by
  `runTimeout` (110 s), below the web app's `/api` proxy (120 s) and the
  self-hosters' Caddy (150 s), so neither ever cuts one; the contract's
  15-second keepalive keeps a quiet answer open meanwhile. Closing the
  stream (Stop) interrupts the run: what was written is kept, `stopped`.
- Tools (`agent-toolset.ts`): what a marketing team needs, never
  webhooks, keys, members, connections, ads, feeds, automations or direct
  messages (the registry promises no assistant reads a workspace's
  messages). Reads and drafts (`create_draft`, `update_draft`,
  `duplicate_post`, and `tag_post` on a draft) run as the model calls
  them; every other change waits for the person (`needsApproval`), and
  runs only once they approve it, with their permissions then. The tools
  are the MCP endpoint's (same names, its handlers through `PealTools`),
  returning their refusals to the model. Each is a `Tool.dynamic`, not
  strict, advertised with the JSON Schema the MCP tool's own writes,
  without an `allOf` member's key its object sets too
  (`advertised-schema.ts`: Effect writes an id's two checks as `pattern`
  beside `allOf: [{pattern}]`, which Anthropic refuses); the call's
  parameters go to the MCP tool's codec as the model sent them, and one
  it refuses is refused to the model (`test/app/agent-toolbox.test.ts`
  checks what each adapter would send). Each call that
  changes something is kept as `agent.<tool>` in the activity log
  through the session, and a content tool's connection in the
  ConnectionJournal (`src/app/agent/toolbox.ts`).
- A step says where it falls in the answer (`at`: the answer's length
  when the tool was called), set when it starts and kept however it
  ends (`stepOf`, and `applied` in `answer-draft.ts`); steps saved
  before `at` existed read as 0.
- Cards and approvals come from the tools' answers and the calls'
  parameters (`agent-cards.ts`, `agent-approvals.ts`, read leniently with
  `tool-items.ts`), and a call that names a post reads it for its
  approval, one that names a comment or a review reads it too
  (`AgentToolbox.subjectOf`, through the engagement context's
  `EngagementInbox.comment` and `EngagementReviews.review`, as the person
  may read it) for the approval's `threadId` and `inReplyTo` (its author's
  shown name, else handle, and the first 500 characters): never from the
  model's words.
- Each round's system message carries Anthropic's cache breakpoint
  (`cachedPrefix`), so the tools and the rules, the same every round,
  are read from its cache after the first; other providers ignore it.
- Every run writes an answer of its own, after the chat's earlier
  messages, so what the agent says after an approval reads below the card
  the person answered: a run after an approval too (`started` with the
  new answer's id and a null `userMessageId`), holding the approved
  call's step and card. The answered change stays on the answer that
  asked it, its state updated there and sent again first under its
  `callId`; a message sent while changes wait makes them `expired` there,
  and the model reads that they were not made. A run's changes are read
  from the latest answer that holds a pending one (`ChatRun.asking`), not
  only the last answer: an answer to one of several changes is an answer
  after it. The model's history is one conversation, whatever the
  messages.
- The system message is fixed (`agent-instructions.ts`) but for today's
  date on the person's clock and their zone (an IANA zone, else UTC):
  never the person's message nor a tool's answer. The title's request
  sends the first message as JSON data; on any failure the chat takes the
  first 60 characters of it, as does a chat still untitled when a run
  from a message ends however it ends (failed, stopped), with no model
  request (`namedAnyway`, its `title` event sent while the stream is open).
- A chat nobody wrote in yet (made, then its first message refused) is in
  no history (`page` lists chats with a message) and the retention
  deletes it a day after it was made.
- Never log or trace a message, a prompt, a tool's parameters or answer,
  an answer or a provider's error: effect/ai's spans are off around every
  round and tool call; the run's span and its one log line say the
  source, the rounds, the tools' names, the outcome and the kind of
  failure (`test/agent/application/agent-chats.test.ts` checks it).
- Retention: a chat 90 days after its last message (`agent.retention`,
  04:31 UTC), at once when its author deletes it, leaves the workspace or
  is removed from it (Better Auth's `afterRemoveMember` and
  `/organization/leave`, and `WorkspacePeople.removeMembers`), closes
  their account, or the workspace is deleted (`ContextRecords`). The
  account's export holds the person's chats, never what the tools read.
  The registry's `agent` category and the privacy policy's table say so.
