import { Context, Effect, Option, Ref } from "effect";

/**
 * Whether the request being handled turned out to change nothing, though
 * its method says it might: a dry run reads, checks and answers. Its
 * handler says so here, first thing, and what keeps a record of changes
 * (the activity log, the journal of connections that changed content)
 * leaves it out. A handler may also say the request changed no content
 * (a transcript read and not saved as a description): the journal of
 * connections leaves it out, and the activity log still keeps what was
 * asked. The authentication middleware provides it; a request that says
 * nothing is taken to change something.
 */
export class ChangeMark extends Context.Service<
  ChangeMark,
  {
    /** Whether the handler said the request changes nothing. */
    readonly changedNothing: Effect.Effect<boolean>;
    /** Whether the handler said the request changes no content, or nothing. */
    readonly changedNoContent: Effect.Effect<boolean>;
    /** Says the request changes nothing. */
    readonly changesNothing: Effect.Effect<void>;
    /** Says the request changes no content. */
    readonly changesNoContent: Effect.Effect<void>;
  }
>()("peal-server/shared/api/ChangeMark") {}

// What a handler said of its request, from the least it changed.
type Said = "content" | "nothing" | "something";

/** A mark for one request, which nothing has said anything of yet. */
export const makeChangeMark = Ref.make<Said>("something").pipe(
  Effect.map((said) =>
    ChangeMark.of({
      changedNoContent: Ref.get(said).pipe(
        Effect.map((was) => was !== "something")
      ),
      changedNothing: Ref.get(said).pipe(
        Effect.map((was) => was === "nothing")
      ),
      changesNoContent: Ref.update(said, (was) =>
        was === "nothing" ? was : "content"
      ),
      changesNothing: Ref.set(said, "nothing"),
    })
  )
);

/**
 * Says the request being handled changes nothing. Nothing happens in a
 * test that serves handlers alone.
 */
export const changesNothing = Effect.serviceOption(ChangeMark).pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.void,
      onSome: (mark) => mark.changesNothing,
    })
  )
);

/**
 * Says the request being handled changes no content, though it may change
 * something else. Nothing happens in a test that serves handlers alone.
 */
export const changesNoContent = Effect.serviceOption(ChangeMark).pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.void,
      onSome: (mark) => mark.changesNoContent,
    })
  )
);

/** Whether the request's handler said it changes nothing. */
export const changedNothing = Effect.serviceOption(ChangeMark).pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.succeed(false),
      onSome: (mark) => mark.changedNothing,
    })
  )
);

/** Whether the request's handler said it changes no content, or nothing. */
export const changedNoContent = Effect.serviceOption(ChangeMark).pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.succeed(false),
      onSome: (mark) => mark.changedNoContent,
    })
  )
);
