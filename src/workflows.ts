import {
  ActivityCancellationType,
  CancellationScope,
  defineSignal,
  isCancellation,
  proxyActivities,
  setHandler,
} from "@temporalio/workflow";
import type * as activities2 from "./activities2";

export const cancelSignal = defineSignal("cancel");

export type ActivityName = keyof typeof activities2.activities;

const HEARTBEATING_ACTIVITIES: ActivityName[] = ["slowHeartbeating", "heartbeatingWithSleep"];

export type Mode = "WAIT_CANCELLATION_COMPLETED" | "TRY_CANCEL" | "ABANDON";

export async function cancelProbe(
  mode: Mode,
  activityName: ActivityName,
  activityMs: number,
): Promise<string> {
  const acts = proxyActivities<typeof activities2.activities>({
    startToCloseTimeout: "1 minute",
    // Only heartbeating activities get a heartbeat timeout; `slow` never
    // heartbeats and would otherwise time out. A short timeout also makes the
    // SDK flush heartbeats often (~80% of it), so cancellation is delivered quickly.
    heartbeatTimeout: HEARTBEATING_ACTIVITIES.includes(activityName) ? "2 seconds" : undefined,
    retry: { maximumAttempts: 1 },
    cancellationType: ActivityCancellationType[mode],
  });

  const scope = new CancellationScope();
  setHandler(cancelSignal, () => scope.cancel());

  try {
    const result = await scope.run(() =>
      acts[activityName](activityMs),
    );
    return `resolved: ${result}`;
  } catch (err) {
    return isCancellation(err) ? "rejected: cancelled" : `rejected: ${String(err)}`;
  }
}
