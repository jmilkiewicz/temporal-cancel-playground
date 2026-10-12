import { CancelledFailure, WorkflowFailedError, WorkflowHandle } from "@temporalio/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { probe } from "./probe";

export const ACTIVITY_MS = 5_000;

/**
 * Registers beforeAll/afterAll that start a local Temporal dev server and a worker for the given
 * workflows module, and returns `startAndCancel` to run one scenario.
 * Call it inside a `describe`.
 */
export function setupCancelHarness(taskQueue: string, workflowsPath: string) {
  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;
  let workerRun: Promise<void>;

  beforeAll(async () => {
    // Real-time dev server, not time skipping: time skipping could fast-forward the workflow's
    // timeouts while activities are still running, which would muddy the results.
    testEnv = await TestWorkflowEnvironment.createLocal();
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath,
      activities,
    });
    workerRun = worker.run();
  });

  afterAll(async () => {
    worker?.shutdown();
    await workerRun;
    await testEnv?.teardown();
  });

  /**
   * Starts the workflow, cancels it (using `cancel`) once the activity is really running on the
   * worker, and waits for both the workflow and the activity to stop.
   */
  async function startAndCancel<A extends unknown[]>(
    workflow: (...args: A) => Promise<string>,
    args: A,
    cancel: (handle: WorkflowHandle) => Promise<unknown>,
  ) {
    probe.reset();
    const handle = await testEnv.client.workflow.start(workflow, {
      args,
      taskQueue,
      workflowId: `${workflow.name}-${Date.now()}`,
    });

    await probe.started.promise;
    const cancelledAt = Date.now();
    await cancel(handle);

    let outcome: string;
    try {
      outcome = await handle.result();
    } catch (err) {
      outcome =
        err instanceof WorkflowFailedError && err.cause instanceof CancelledFailure
          ? "cancelled"
          : `failed: ${String(err)}`;
    }
    const workflowWaitedMs = Date.now() - cancelledAt;
    const status = (await handle.describe()).status.name;

    const activity = await probe.finished.promise;
    const activityRanAfterCancelMs = activity.finishedAt - cancelledAt;

    return { outcome, status, workflowWaitedMs, activity, activityRanAfterCancelMs };
  }

  return { startAndCancel };
}
