import { ACTIVITY_MS, setupCancelHarness } from "./cancelHarness";
import { probe } from "./probe";
import {
  ActivityName,
  callTwice,
  cancelWholeWorkflow,
  cancelWorkflowWithCleanup,
  Mode,
} from "./workflows/wholeWorkflow";

describe("cancelling the workflow itself", () => {
  const harness = setupCancelHarness(
    "cancel-whole-workflow",
    require.resolve("./workflows/wholeWorkflow"),
  );

  function startAndCancel<A extends unknown[]>(workflow: (...args: A) => Promise<string>, args: A) {
    return harness.startAndCancel(workflow, args, (handle) => handle.cancel());
  }

  function run(mode: Mode, activityName: ActivityName) {
    return startAndCancel(cancelWholeWorkflow, [mode, activityName, ACTIVITY_MS]);
  }

  function runWithCleanup(mode: Mode, activityName: ActivityName, protectCleanup: boolean) {
    return startAndCancel(cancelWorkflowWithCleanup, [
      mode,
      activityName,
      ACTIVITY_MS,
      protectCleanup,
    ]);
  }

  it("WAIT_CANCELLATION_COMPLETED + non-heartbeating activity: activity finishes, workflow COMPLETES", async () => {
    const r = await run("WAIT_CANCELLATION_COMPLETED", "slow");

    expect(r.outcome).toBe("completed: done cancelled=true");
    expect(r.status).toBe("COMPLETED");
    expect(r.workflowWaitedMs).toBeGreaterThanOrEqual(ACTIVITY_MS - 500);
    expect(r.activity.sawCancellation).toBe(false);
  });

  it("WAIT_CANCELLATION_COMPLETED + heartbeating activity: activity stops, workflow is CANCELLED", async () => {
    const r = await run("WAIT_CANCELLATION_COMPLETED", "heartBeatingHonouringCancel");

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
    expect(r.activityRanAfterCancelMs).toBeGreaterThanOrEqual(ACTIVITY_MS - 500);
    expect(r.activity.sawCancellation).toBe(false);
  });

  it("TRY_CANCEL + heartbeating ignoring activity: workflow is CANCELLED right away, activity keeps running", async () => {
    const r = await run("TRY_CANCEL", "heartBeatingWithIgnoringCancelSignal");

    expect(r.outcome).toBe("cancelled");
    expect(r.status).toBe("CANCELLED");
    expect(r.workflowWaitedMs).toBeLessThan(1_000);
    expect(r.activityRanAfterCancelMs).toBeGreaterThanOrEqual(ACTIVITY_MS - 500);
    expect(r.activity.sawCancellation).toBe(true);
  });

  it("TRY_CANCEL + heartbeating activity: workflow is CANCELLED right away, activity learns about it later", async () => {
    const r = await run("TRY_CANCEL", "heartBeatingHonouringCancel");

    expect(r.outcome).toBe("cancelled");
    expect(r.status).toBe("CANCELLED");
    expect(r.workflowWaitedMs).toBeLessThan(1_000);
    expect(r.activityRanAfterCancelMs).toBeLessThan(ACTIVITY_MS - 2_000);
    expect(r.activity.sawCancellation).toBe(true);
  });

  it("ABANDON + non-heartbeating activity: same as TRY_CANCEL from the workflow's side", async () => {
    const r = await run("ABANDON", "slow");

    expect(r.outcome).toBe("cancelled");
    expect(r.status).toBe("CANCELLED");
    expect(r.workflowWaitedMs).toBeLessThan(1_000);
    expect(r.activity.sawCancellation).toBe(false);
  });

  it("during 1st activity execution: workflow is CANCELLED and the 2nd activity is never started", async () => {
    const r = await startAndCancel(callTwice, [
      "WAIT_CANCELLATION_COMPLETED",
      "heartBeatingWithIgnoringCancelSignal",
      ACTIVITY_MS,
    ]);

    expect(r.outcome).toBe("cancelled");
    expect(r.status).toBe("CANCELLED");
    expect(r.activity.sawCancellation).toBe(true);
    expect(probe.cleanupCalls).toBe(0);
  });

  it("AFTER the activity started, activity ignores cancellation: workflow COMPLETES", async () => {
    const r = await run("WAIT_CANCELLATION_COMPLETED", "heartBeatingWithIgnoringCancelSignal");

    expect(r.outcome).toContain("OK true cancelled=true");
    expect(r.status).toBe("COMPLETED");
    expect(r.activity.sawCancellation).toBe(true);
  });

  describe("workflow catches the cancellation and runs a cleanup activity", () => {
    it("cleanup inside CancellationScope.nonCancellable: cleanup runs, workflow swallows the cancel and COMPLETES", async () => {
      const r = await runWithCleanup(
        "WAIT_CANCELLATION_COMPLETED",
        "heartBeatingHonouringCancel",
        true,
      );

      expect(probe.cleanupCalls).toBe(1);
      expect(r.outcome).toBe("completed: cleanup");
      expect(r.status).toBe("COMPLETED");
    });

    it("cleanup in the cancelled scope: cleanup activity never runs, workflow ends CANCELLED", async () => {
      const r = await runWithCleanup(
        "WAIT_CANCELLATION_COMPLETED",
        "heartBeatingHonouringCancel",
        false,
      );

      expect(probe.cleanupCalls).toBe(0);
      expect(r.outcome).toBe("cancelled");
      expect(r.status).toBe("CANCELLED");
    });
  });
});
