import { cancellationSignal, heartbeat } from "@temporalio/activity";
import { probe } from "./probe";
import { WORK_URL } from "./workServer";

/** Never heartbeats, so it can never learn about a cancellation request. */
export async function slow(ms: number): Promise<string> {
  probe.started.resolve();
  try {
    await new Promise((r) => setTimeout(r, ms));
    return "done";
  } finally {
    probe.finished.resolve({
      sawCancellation: cancellationSignal().aborted,
      finishedAt: Date.now(),
    });
  }
}

/**
 * Heartbeats in the background and waits (at most `ms`) until the cancellation request is delivered
 * (heartbeats are how an activity learns about it), then calls the HTTP endpoint anyway, knowing
 * the signal is aborted and without passing it to `fetch`.
 */
export async function heartBeatingWithIgnoringCancelSignal(ms: number): Promise<string> {
  probe.started.resolve();
  const timer = setInterval(() => heartbeat(), 200);
  try {
    const deadline = Date.now() + ms;
    while (!cancellationSignal().aborted && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const aborted = cancellationSignal().aborted;
    const response = await fetch(WORK_URL);
    await response.text();
    return response.statusText + " " + aborted;
  } finally {
    clearInterval(timer);
    probe.finished.resolve({
      sawCancellation: cancellationSignal().aborted,
      finishedAt: Date.now(),
    });
  }
}

/** Heartbeats in the background while a slow HTTP call runs, and aborts that call on cancellation. */
export async function heartBeatingHonouringCancel(ms: number): Promise<string> {
  probe.started.resolve();
  const timer = setInterval(() => heartbeat(), 200);
  try {
    const response = await fetch(`${WORK_URL}?ms=${ms}`, {
      signal: cancellationSignal(),
    });
    await response.text();
    return "done";
  } finally {
    clearInterval(timer);
    probe.finished.resolve({
      sawCancellation: cancellationSignal().aborted,
      finishedAt: Date.now(),
    });
  }
}

/** Records that it ran, so tests can tell whether the workflow managed to schedule it. */
export async function cleanup(): Promise<string> {
  probe.cleanupCalls++;
  return "cleaned";
}
