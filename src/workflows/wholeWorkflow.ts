import {
  ActivityCancellationType,
  CancelledFailure,
  CancellationScope,
  isCancellation,
  proxyActivities,
} from "@temporalio/workflow";
import type * as activities from "../activities";
import { activityOptions } from "../activityOptions";

export type ActivityName = keyof typeof activityOptions;

export type Mode = "WAIT_CANCELLATION_COMPLETED" | "TRY_CANCEL" | "ABANDON";

const { cleanup } = proxyActivities<Pick<typeof activities, "cleanup">>({
  startToCloseTimeout: "1 minute",
  retry: { maximumAttempts: 1 },
});

function proxyFor(mode: Mode, activityName: ActivityName) {
  return proxyActivities<Pick<typeof activities, ActivityName>>({
    startToCloseTimeout: "1 minute",
    heartbeatTimeout: activityOptions[activityName].heartbeatTimeout,
    retry: { maximumAttempts: 1 },
    cancellationType: ActivityCancellationType[mode],
  })[activityName];
}

export async function cancelWholeWorkflow(
  mode: Mode,
  activityName: ActivityName,
  activityMs: number,
): Promise<string> {
  const result = await proxyFor(mode, activityName)(activityMs);
  const cancelled = CancellationScope.current().consideredCancelled;
  return `completed: ${result} cancelled=${cancelled}`;
}

export async function callTwice(
  mode: Mode,
  activityName: ActivityName,
  activityMs: number,
): Promise<string> {
  const result = await proxyFor(mode, activityName)(activityMs);
  const result2 = await cleanup();
  return `completed: ${result} ${result2}`;
}

export async function cancelWorkflowCleanupThenRethrow(
  mode: Mode,
  activityName: ActivityName,
  activityMs: number,
): Promise<string> {
  try {
    const result = await proxyFor(mode, activityName)(activityMs);
    return `completed: ${result}`;
  } catch (err) {
    if (isCancellation(err)) {
      await CancellationScope.nonCancellable(() => cleanup());
    }
    throw err;
  }
}

export async function cancelWorkflowCheckAfterLastActivity(
  mode: Mode,
  activityName: ActivityName,
  activityMs: number,
): Promise<string> {
  const result = await proxyFor(mode, activityName)(activityMs);
  if (CancellationScope.current().consideredCancelled) {
    throw new CancelledFailure(`cancelled after activity returned: ${result}`);
  }
  return `completed: ${result}`;
}

export async function cancelWorkflowCleanupUnprotected(
  mode: Mode,
  activityName: ActivityName,
  activityMs: number,
): Promise<string> {
  try {
    const result = await proxyFor(mode, activityName)(activityMs);
    return `completed: ${result}`;
  } catch (err) {
    if (isCancellation(err)) {
      await cleanup();
    }
    throw err;
  }
}
