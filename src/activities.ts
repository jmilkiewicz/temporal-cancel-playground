import { cancellationSignal, heartbeat, sleep } from "@temporalio/activity";
import { probe } from "./probe";



/** Never heartbeats, so it can never learn about a cancellation request. */
export async function slow(ms: number): Promise<string> {
  probe.started.resolve();
  await new Promise((r) => setTimeout(r, ms)); // plain timer: ignores cancellation
  probe.finished.resolve({
    sawCancellation: cancellationSignal().aborted,
    finishedAt: Date.now(),
  });
  return "done";
}

export async function heartbeatingWithIgnoringCancelSignal(ms: number): Promise<string> {
  probe.started.resolve();
  const end = Date.now() + ms - 2000;
  try {
    while (Date.now() < end) {
      heartbeat();
      await new Promise((r) => setTimeout(r, 200));
    }
    heartbeat();
    const sawCancellation = cancellationSignal().aborted;
    const someFetch = await fetch("https://www.google.com/");
    return someFetch.statusText + " " + sawCancellation;
  } finally {
    probe.finished.resolve({
      sawCancellation: cancellationSignal().aborted,
      finishedAt: Date.now(),
    });
  }
}


export async function cleanup(): Promise<string> {
  probe.cleanupCalls++;
  return "cleaned";
}

export async function heartbeatingWithSleep(ms: number): Promise<string> {
  probe.started.resolve();
  const end = Date.now() + ms;
  try {
    while (Date.now() < end) {
      heartbeat();
      await sleep(200); // activity sleep: rejects with CancelledFailure on cancellation
    }
    return "done";
  } finally {
    probe.finished.resolve({
      sawCancellation: cancellationSignal().aborted,
      finishedAt: Date.now(),
    });
  }
}
