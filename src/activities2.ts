import { cancellationSignal, heartbeat, sleep } from "@temporalio/activity";
import { probe } from "./probe";



export const activities = {
  slow: slow,
  slowHeartbeating: slowHeartbeating,
  heartbeatingWithSleep: heartbeatingWithSleep,
};


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

/** Heartbeats every 200 ms and stops as soon as it is told to cancel. */
export async function slowHeartbeating(ms: number): Promise<string> {
  probe.started.resolve();
  const end = Date.now() + 2000;
  try {
    while (Date.now() < end) {
      heartbeat();
      //await sleep(200); // activity sleep: rejects with CancelledFailure on cancellation
    }

    const res = await fetch("https://www.google.com/");

    console.log(res.statusText + " " + cancellationSignal().aborted);

    return res.statusText
  } finally {
    probe.finished.resolve({
      sawCancellation: cancellationSignal().aborted,
      finishedAt: Date.now(),
    });
  }
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
