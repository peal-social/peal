# Agent

- The agent is the web app's chat in which a person asks about their
  workspace and has it do things, with the MCP endpoint's tools. Its
  endpoints are `AgentApi` (`peal-contract/agent`), apart from `Api`:
  never in the OpenAPI document, the SDKs, the command line or an MCP
  tool. `src/app/agent/live.ts` serves it beside `Api`, under
  `/api/workspaces/:workspaceId/agent`, behind the same Authentication and
  WorkspaceAccess, with its handlers in `src/app/agent/handlers.ts` (the
  composition root, as only it may import `peal-contract/agent`).
- Every use case (`AgentDesk`, `AgentSkillDesk`) needs `assistant:use`
  and a person in their own session (`ownerOf`, `inPerson`): an API key,
  an OAuth client and staff acting as someone get `PersonRequired` (403
  `personRequired`). Chats are their author's alone: another person's id
  reads as none (`ChatNotFound`, 404), whatever is asked of it.
- Skills (`agent.skills`, `agent-skill.ts`) are a name and instructions a
  person saves for a task they repeat: their own (`personal`), or the
  workspace's (`workspace`), which every member with `assistant:use`
  there uses, and the agent is offered beside every message: what one
  member writes there steers every other member's agent. A person sees
  their own and the workspace's, listed by name whatever its case; any
  other (another person's own, another workspace's, a deleted one) reads
  as none (`SkillNotFound`, 404). They change or delete their own personal
  ones; a workspace skill is made (`scopeAllowed`), shared from one's own
  and changed or deleted only with `assistant:configure` (`editable`),
  its author's included: `MissingPermission` (403) for making or sharing
  one, `notEditable` for a change. A workspace skill goes back to
  personal for its author only, while they manage them. A name another skill the person sees has,
  whatever its case, is `nameTaken`; past `maxSkills` (100) they see,
  `tooMany` (both checked before the write, not by the database). When
  its author leaves the workspace, is removed or closes their account, a
  workspace skill stays with no author (`author_id` null: editable through
  `assistant:configure` only) and their own go, through `AgentRecords`
  on the chats' paths; the workspace's deletion takes them all. The
  account's export holds their own and the workspace's they wrote.
- A message picks up to 3 skills (`skillIds`): each one the person may
  use, else `SkillNotFound` before any event, nothing kept. The person's
  message keeps each `{id, name}` as named then (`messages.skills`, `[]`
  on older rows). The model gets each picked skill's name and
  instructions beside the message, as JSON (`skills`), and the ids and
  names of the others the person may use (`otherSkills`, up to
  `maxSkills`, only when there are any), as the attached files come
  (`withUserMessage`): never in the system message. `read_skill`
  (`read-skill.ts`) is the agent's own tool, merged into the run's
  toolkit beside the toolbox's, never an MCP tool: it runs without
  approval, answers a skill the person may use now, refuses any other to
  the model, is a step like any call and is never recorded. The rules
  make a skill's instructions the one answer of a tool the model follows,
  and let it lift no other rule.
- Chats and messages are in the `agent` schema. A chat keeps what the
  model reads of it (`history`: effect/ai's `Prompt` as JSON, the person's
  messages, the answers' text and tool calls, and the tools' answers cut
  to `maxToolResultLength` with a note, `tool-result.ts`); never an
  approval's request. Messages are ordered by their ids (UUIDv7): the
  person's is issued before its answer's. Each round is one metered
  request whatever it holds, so a round sends the history within
  `maxHistoryLength` (`withinBudget`, `run-history.ts`): the latest turns,
  each whole from a person's message, the oldest dropped first; when the
  last turn alone passes it, its earliest rounds go, each call with its
  answer, never its message nor its last round, whose calls may wait for
  the person. The chat keeps the whole history.
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
  The title's request counts nothing. Both are effect/ai models on the AI
  SDK's (the assistant's guide, `infrastructure/ai-sdk/`), built by
  `src/app/agent/language-models.ts`: the server's on plain fetch, a
  workspace's for each round on the guarded fetch (`publicFetchWith`,
  2 MiB a round), after the guard checked its address.
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
- Cards come from the tools' answers (`agent-cards.ts`, read leniently
  with `tool-items.ts`). An approval shows all of what the call does,
  never the model's words (`approvalOf`, `agent-approvals.ts`): every
  parameter the tool takes (`shownParameters`, one list per tool that
  waits, which `test/app/agent-toolbox.test.ts` keeps equal to the MCP
  tool's: a tool missing there, a parameter not in it or one that reads
  otherwise is never asked), and what the call names, read as the
  person may read it when it is asked (`requested`, in the run): the post
  whole through `get_post` (`PublishablePostSchema`: text, media, poll,
  each channel's own text and media, the parts after it with their
  waits, each channel's options, shortened links; a channel set's
  channels and a signature are already the post's, a channel taken off it
  is left out; on the call's channels only), the queue (`list_queues`)
  and the tags (`list_tags`) by name, a moderation's action, a request's
  comment, an edit's part and channel, and the comment or review
  (`AgentToolbox.subjectOf`, through the engagement context's
  `EngagementInbox.comment` and `EngagementReviews.review`) for its
  `threadId` and `inReplyTo` (its author's shown name, else handle, and
  the first 500 characters). What cannot be shown whole (a post, queue,
  tag or channel that does not read) is not asked: the call answers the
  model a refusal (`approvalRefusals`), a `refused` step, recorded
  nowhere. `create_post` is no agent tool: what it makes takes channel
  sets, signatures and default options only the server resolves, so the
  agent drafts, and the person approves the draft as the workspace holds
  it.
- An approval keeps the SHA-256 of what the person is shown (`digest`,
  of `shownOf`: the approval but its call and state; never answered).
  Approved, the call is read again (`requested`) and runs only when it
  shows the same: a post edited since, by a teammate or by a call of the
  same answer, or gone, leaves it `changed`, the model told nothing was
  done. The reading and the run share one transaction that locks the
  post first (`AgentToolbox.holdingPost`, publishing's
  `PostScheduling.holding`, which the post's use cases join, locking it
  again): no edit lands between them. For `queue_post` the hold takes the
  asked queue's lock first (its id read from `list_queues` before the
  hold, `queuePlacing`), then the post's: the order placing a post on a
  queue, a reshuffle and deleting a queue take them, so no two such
  transactions deadlock. `queue_post` shows the channels the
  scheduling uses (a post not a draft moves on all its own, whatever the
  call names) and is not asked for a draft with none, which would take
  the queue's channels and their default options; its card says the
  queue's next free slot (`queueAt`, from `preview_queue`) as an
  indication, kept out of the digest. A pending approval lapses `approvalLifetimeHours` (24) after the
  answer that asked it was written (`lapsed`, `openOf`): it reads as
  `expired` (`shownAt`, on reading a chat) and its answer is
  `ApprovalNotPending`.
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
- Never log or trace a message, a skill's name or instructions, a
  prompt, a tool's parameters or answer, an answer or a provider's error: effect/ai's spans are off around every
  round and tool call; the run's span and its one log line say the
  source, the rounds, the tools' names, the outcome and the kind of
  failure (`test/agent/application/agent-chats.test.ts` checks it).
- Retention: a chat 90 days after its last message (`agent.retention`,
  04:31 UTC), at once when its author deletes it, leaves the workspace or
  is removed from it (Better Auth's `afterRemoveMember` and
  `/organization/leave`, and `WorkspacePeople.removeMembers`), closes
  their account, or the workspace is deleted (`ContextRecords`). The
  account's export holds the person's chats and skills, never what the
  tools read.
  The registry's `agent` category and the privacy policy's table say so.
