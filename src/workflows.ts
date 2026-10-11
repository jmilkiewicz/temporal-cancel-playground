import {
  ActivityCancellationType,
  CancellationScope,
  defineSignal,
  isCancellation,
  proxyActivities,
  setHandler,
} from "@temporalio/workflow";
import type * as activities2 from "./activities";
import { activityOptions } from "./activityOptions";

export const cancelSignal = defineSignal("cancel");

export type ActivityName = keyof typeof activityOptions;

export type Mode = "WAIT_CANCELLATION_COMPLETED" | "TRY_CANCEL" | "ABANDON";

export async function cancelProbe(
  mode: Mode,
  activityName: ActivityName,
  activityMs: number,
): Promise<string> {
  const activityProxies = proxyActivities<Pick<typeof activities2, ActivityName>>({
    startToCloseTimeout: "1 minute",
    heartbeatTimeout: activityOptions[activityName].heartbeatTimeout,
    retry: { maximumAttempts: 1 },
    cancellationType: ActivityCancellationType[mode],
  });

  const scope = new CancellationScope();
  setHandler(cancelSignal, () => scope.cancel());

  try {
    const result = await scope.run(() =>
      activityProxies[activityName](activityMs),
    );
    return `resolved: ${result}`;
  } catch (err) {
    return isCancellation(err) ? "rejected: cancelled" : `rejected: ${String(err)}`;
  }
}
