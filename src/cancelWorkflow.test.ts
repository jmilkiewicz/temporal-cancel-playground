import { CancelledFailure, WorkflowFailedError } from "@temporalio/client";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { probe } from "./probe";
import {
  ActivityName,
  cancelWorkflow,
  cancelWorkflowWithCleanup,
  Mode,
  sleepBeforeActivityCall,
} from "./workflows2";

jest.setTimeout(60_000);

const ACTIVITY_MS = 5_000;

describe("cancelling the workflow itself", () => {
  const taskQueue = "cancel-workflow";
  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;
  let workerRun: Promise<void>;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("./workflows2"),
      activities,
    });
    workerRun = worker.run();
  });

  afterAll(async () => {
    worker?.shutdown();
    await workerRun;
    await testEnv?.teardown();
  });

  async function cancelWhileActivityRuns(
    handle: Awaited<ReturnType<typeof testEnv.client.workflow.start>>,
  ) {
    await probe.started.promise;
    const cancelledAt = Date.now();
    await handle.cancel();

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

    // Always wait for the activity to stop, so it doesn't leak into the next test.
    const activity = await probe.finished.promise;
    const activityRanAfterCancelMs = activity.finishedAt - cancelledAt;

    return { outcome, status, workflowWaitedMs, activity, activityRanAfterCancelMs };
  }

  async function cancelAndReport(
    handle: Awaited<ReturnType<typeof testEnv.client.workflow.start>>,
  ) {
    await handle.cancel();
    let outcome: string;
    try {
      outcome = await handle.result();
    } catch (err) {
      outcome =
        err instanceof WorkflowFailedError && err.cause instanceof CancelledFailure
          ? "cancelled"
          : `failed: ${String(err)}`;
    }
    const status = (await handle.describe()).status.name;
    return { outcome, status };
  }

  async function run(mode: Mode, activityName: ActivityName) {
    probe.reset();
    const handle = await testEnv.client.workflow.start(cancelWorkflow, {
      args: [mode, activityName, ACTIVITY_MS],
      taskQueue,
      workflowId: `cancel-workflow-${mode}-${activityName}-${Date.now()}`,
    });
    return cancelWhileActivityRuns(handle);
  }

  async function runWithCleanup(mode: Mode, activityName: ActivityName, protectCleanup: boolean) {
    probe.reset();
    const handle = await testEnv.client.workflow.start(cancelWorkflowWithCleanup, {
      args: [mode, activityName, ACTIVITY_MS, protectCleanup],
      taskQueue,
      workflowId: `cancel-workflow-cleanup-${mode}-${activityName}-${protectCleanup}-${Date.now()}`,
    });
    return cancelWhileActivityRuns(handle);
  }

  it("WAIT_CANCELLATION_COMPLETED + non-heartbeating activity: activity finishes, workflow COMPLETES", async () => {
    const r = await run("WAIT_CANCELLATION_COMPLETED", "slow");

    expect(r.outcome).toBe("completed: done cancelled=true");
    expect(r.status).toBe("COMPLETED");
    expect(r.workflowWaitedMs).toBeGreaterThanOrEqual(ACTIVITY_MS);
    expect(r.activity.sawCancellation).toBe(false);
  });

  it("WAIT_CANCELLATION_COMPLETED + heartbeating activity: activity stops, workflow is CANCELLED", async () => {
    const r = await run("WAIT_CANCELLATION_COMPLETED", "heartbeatingWithSleep");

    expect(r.outcome).toBe("cancelled");
    expect(r.status).toBe("CANCELLED");
    expect(r.workflowWaitedMs).toBeLessThan(ACTIVITY_MS - 2_000);
    expect(r.activity.sawCancellation).toBe(true);
  });

  it("TRY_CANCEL + non-heartbeating activity: workflow is CANCELLED right away, activity keeps running", async () => {
    const r = await run("TRY_CANCEL", "slow");

    expect(r.outcome).toBe("cancelled");
    expect(r.status).toBe("CANCELLED");
    expect(r.workflowWaitedMs).toBeLessThan(1_000);
    expect(r.activityRanAfterCancelMs).toBeGreaterThanOrEqual(ACTIVITY_MS);
    expect(r.activity.sawCancellation).toBe(false);
  });

  it("TRY_CANCEL + heartbeating activity: workflow is CANCELLED right away, activity learns about it later", async () => {
    const r = await run("TRY_CANCEL", "heartbeatingWithSleep");

    expect(r.outcome).toBe("cancelled");
    expect(r.status).toBe("CANCELLED");
    expect(r.workflowWaitedMs).toBeLessThan(1_000);
    expect(r.activityRanAfterCancelMs).toBeLessThan(ACTIVITY_MS - 3_000);
    expect(r.activity.sawCancellation).toBe(true);
  });

  it("ABANDON + non-heartbeating activity: same as TRY_CANCEL from the workflow's side", async () => {
    const r = await run("ABANDON", "slow");

    expect(r.outcome).toBe("cancelled");
    expect(r.status).toBe("CANCELLED");
    expect(r.workflowWaitedMs).toBeLessThan(1_000);
    expect(r.activity.sawCancellation).toBe(false);
  });

  it("BEFORE the activity starts: workflow is CANCELLED and the activity is never started", async () => {
    probe.reset();
    const handle = await testEnv.client.workflow.start(sleepBeforeActivityCall, {
      args: ["WAIT_CANCELLATION_COMPLETED", "slow", ACTIVITY_MS, 1000],
      taskQueue,
      workflowId: `cancel-before-activity-${Date.now()}`,
    });
    await new Promise((r) => setTimeout(r, 500)); // let the workflow reach its timer

    const r = await cancelAndReport(handle);

    expect(r.outcome).toBe("cancelled");
    expect(r.status).toBe("CANCELLED");
    const activityStarted = await Promise.race([
      probe.started.promise.then(() => true),
      new Promise<boolean>((res) => setTimeout(() => res(false), 500)),
    ]);
    expect(activityStarted).toBe(false);
  });

  it("AFTER the activity started, activity ignores cancellation: workflow COMPLETES", async () => {
    const r = await run("WAIT_CANCELLATION_COMPLETED", "heartbeatingWithIgnoringCancelSignal");

    expect(r.outcome).toMatch("OK true cancelled=true");
    expect(r.status).toBe("COMPLETED");
    expect(r.activity.sawCancellation).toBe(true);
  });

  describe("workflow catches the cancellation and runs a cleanup activity", () => {
    it("cleanup inside CancellationScope.nonCancellable: cleanup runs, workflow ends CANCELLED", async () => {
      const r = await runWithCleanup("WAIT_CANCELLATION_COMPLETED", "heartbeatingWithSleep", true);

      expect(probe.cleanupCalls).toBe(1);
      expect(r.outcome).toBe("completed: cleanup");
      expect(r.status).toBe("COMPLETED");
    });

    it("cleanup in the cancelled scope: cleanup activity never runs, workflow ends CANCELLED", async () => {
      const r = await runWithCleanup("WAIT_CANCELLATION_COMPLETED", "heartbeatingWithSleep", false);

      expect(probe.cleanupCalls).toBe(0);
      expect(r.outcome).toBe("cancelled");
      expect(r.status).toBe("CANCELLED");
    });
  });
});
