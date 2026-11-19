/**
 * Runs the tasks it is given one after the other, each once the one before
 * it settled, and answers each with its own result. A mutation atom runs
 * one call at a time: a second call interrupts the first, and its promise
 * may settle with the second's result, so decisions on a list's posts,
 * from its rows and from the choice, wait their turn here.
 */
export const oneAfterAnother = () => {
  // Settles once the last task given settled, whichever way.
  let last = Promise.resolve();

  return async <A>(task: () => Promise<A>): Promise<A> => {
    const before = last;
    const done = Promise.withResolvers<undefined>();

    last = done.promise;

    try {
      await before;

      return await task();
    } finally {
      done.resolve(undefined);
    }
  };
};
