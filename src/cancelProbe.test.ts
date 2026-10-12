import { ACTIVITY_MS, setupCancelHarness } from "./cancelHarness";
import { ActivityName, cancelProbe, cancelSignal, Mode } from "./workflows";

describe("activity cancellation types", () => {
  const harness = setupCancelHarness("cancel-probe", require.resolve("./workflows"));

  function run(mode: Mode, activityName: ActivityName) {
    return harness.startAndCancel(cancelProbe, [mode, activityName, ACTIVITY_MS], (handle) =>
      handle.signal(cancelSignal),
    );
  }

  it("WAIT_CANCELLATION_COMPLETED for non-heartbeating activity: waits for the activity and returns its result", async () => {
    const r = await run("WAIT_CANCELLATION_COMPLETED", "slow");

    expect(r.outcome).toBe("resolved: done");
    expect(r.workflowWaitedMs).toBeGreaterThan(ACTIVITY_MS);
    expect(r.activity.sawCancellation).toBe(false);
  });

  it("TRY_CANCEL for non-heartbeating activity: throws right away, the activity keeps running", async () => {
    const r = await run("TRY_CANCEL", "slow");

    expect(r.outcome).toBe("rejected: cancelled");
    expect(r.workflowWaitedMs).toBeLessThan(1_000); // did not wait
    expect(r.activityRanAfterCancelMs).toBeGreaterThanOrEqual(ACTIVITY_MS - 500); // ran on in the background
    expect(r.activity.sawCancellation).toBe(false);
  });

  it("ABANDON for non-heartbeating activity: same as TRY_CANCEL from the workflow's side", async () => {
    const r = await run("ABANDON", "slow");

    expect(r.outcome).toBe("rejected: cancelled");
    expect(r.workflowWaitedMs).toBeLessThan(1_000);
    expect(r.activityRanAfterCancelMs).toBeGreaterThanOrEqual(ACTIVITY_MS - 500);
    expect(r.activity.sawCancellation).toBe(false);
  });

  it("WAIT_CANCELLATION_COMPLETED for heartbeating honouring activity: the activity learns about it and the workflow gets a cancellation", async () => {
    const r = await run("WAIT_CANCELLATION_COMPLETED", "heartBeatingHonouringCancel");

    expect(r.outcome).toBe("rejected: cancelled");
    expect(r.workflowWaitedMs).toBeLessThan(ACTIVITY_MS - 2_000);
    expect(r.activityRanAfterCancelMs).toBeLessThan(ACTIVITY_MS - 2_000);
    expect(r.activity.sawCancellation).toBe(true);
  });

  it("WAIT_CANCELLATION_COMPLETED for heartbeating ignoring activity: the activity sees cancellation signal but ignores it", async () => {
    const r = await run("WAIT_CANCELLATION_COMPLETED", "heartBeatingWithIgnoringCancelSignal");

    expect(r.outcome).toBe("resolved: OK true");
    expect(r.activity.sawCancellation).toBe(true);
  });


  it("TRY_CANCEL for heartbeating activity: throws right away, the activity terminates earlier", async () => {
    const r = await run("TRY_CANCEL", "heartBeatingHonouringCancel");

    expect(r.outcome).toBe("rejected: cancelled");
    expect(r.workflowWaitedMs).toBeLessThan(1_000);
    expect(r.activity.sawCancellation).toBe(true);
  });
});
