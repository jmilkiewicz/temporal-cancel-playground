import { cancellationSignal, heartbeat } from "@temporalio/activity";
import { probe } from "./probe";

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

/** Heartbeats in the background while a slow HTTP call runs, and never passes the abort signal to it. */
export async function heartbeatingWithIgnoringCancelSignal(ms: number): Promise<string> {
  probe.started.resolve();
  const timer = setInterval(() => heartbeat(), 200);
  try {
    heartbeat();
    const aborted = cancellationSignal().aborted;
    const response = await fetch(`${probe.workUrl}?ms=${ms}`);
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
export async function heartbeatingHonouringCancel(ms: number): Promise<string> {
  probe.started.resolve();
  const timer = setInterval(() => heartbeat(), 200);
  try {
    const response = await fetch(`${probe.workUrl}?ms=${ms}`, {
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
