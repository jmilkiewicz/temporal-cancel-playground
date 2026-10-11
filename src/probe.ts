// Shared between the test and the activities (both run in the same Node process).
// Workflows must NOT import this file: they run in an isolated sandbox.

export interface ActivityOutcome {
  /** Did the activity ever see its cancellationSignal aborted? */
  sawCancellation: boolean;
  /** Wall-clock time when the activity actually stopped. */
  finishedAt: number;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

export const probe = {
  started: deferred<void>(),
  finished: deferred<ActivityOutcome>(),
  reset() {
    this.started = deferred<void>();
    this.finished = deferred<ActivityOutcome>();
  },
};
