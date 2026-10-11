import {
  ActivityCancellationType,
  CancellationScope,
  isCancellation,
  proxyActivities,
} from "@temporalio/workflow";
import type * as activities2 from "./activities";
import { activityOptions } from "./activityOptions";


export type ActivityName = keyof typeof activityOptions;

export type Mode = "WAIT_CANCELLATION_COMPLETED" | "TRY_CANCEL" | "ABANDON";

const { cleanup } = proxyActivities<Pick<typeof activities2, "cleanup">>({
  startToCloseTimeout: "1 minute",
  retry: { maximumAttempts: 1 },
});

function proxyFor(mode: Mode, activityName: ActivityName) {
  return proxyActivities<Pick<typeof activities2, ActivityName>>({
    startToCloseTimeout: "1 minute",
    heartbeatTimeout: activityOptions[activityName].heartbeatTimeout,
    retry: { maximumAttempts: 1 },
    cancellationType: ActivityCancellationType[mode],
  })[activityName];
}

/** Does not catch anything: a workflow cancel request surfaces as CancelledFailure. */
export async function cancelWorkflow(
  mode: Mode,
  activityName: ActivityName,
  activityMs: number,
): Promise<string> {
  const result = await proxyFor(mode, activityName)(activityMs);
  return `completed: ${result}`;
}

/** Catches the cancellation, runs a cleanup activity, then rethrows. */
export async function cancelWorkflowWithCleanup(
  mode: Mode,
  activityName: ActivityName,
  activityMs: number,
  protectCleanup: boolean,
): Promise<string> {
  try {
    const result = await proxyFor(mode, activityName)(activityMs);
    return `completed: ${result}`;
  } catch (err) {
    if (!isCancellation(err)) throw err;
    if (protectCleanup) {
      await CancellationScope.nonCancellable(() => cleanup());
    } else {
      await cleanup();
    }
    throw err;
  }
}
