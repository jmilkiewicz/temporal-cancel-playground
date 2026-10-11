import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import * as activities2 from "./activities2";
import { probe } from "./probe";
import { ActivityName, cancelProbe, cancelSignal, Mode } from "./workflows";

// Real-time local dev server, not time skipping: the activities sleep in real
// time, and time skipping could fast-forward the workflow's timeouts while
// they are still running, which would muddy the results.
jest.setTimeout(60_000);

const ACTIVITY_MS = 5_000;

describe("activity cancellation types", () => {
  const taskQueue = "cancel-probe";
  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;
  let workerRun: Promise<void>;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("./workflows"),
      activities: activities2,
    });
    workerRun = worker.run();
  });

  afterAll(async () => {
    worker?.shutdown();
    await workerRun;
    await testEnv?.teardown();
  });

  async function run(mode: Mode, activityName: ActivityName) {
    probe.reset();
    const handle = await testEnv.client.workflow.start(cancelProbe, {
      args: [mode, activityName, ACTIVITY_MS],
      taskQueue,
      workflowId: `cancel-probe-${mode}-${activityName}-${Date.now()}`,
    });

    // Cancel only once the activity is really running on the worker.
    // (If it were still waiting in the task queue, the server would cancel it
    // directly and every cancellation type would behave the same.)
    await probe.started.promise;
    const cancelledAt = Date.now();
    await handle.signal(cancelSignal);

    const result = await handle.result();
    const workflowWaitedMs = Date.now() - cancelledAt;

    // Always wait for the activity to stop, so it doesn't leak into the next test.
    const activity = await probe.finished.promise;
    const activityRanAfterCancelMs = activity.finishedAt - cancelledAt;

    return { result, workflowWaitedMs, activity, activityRanAfterCancelMs };
  }

  it("WAIT_CANCELLATION_COMPLETED for non-heartbeating activity: waits for the activity and returns its result", async () => {
    const r = await run("WAIT_CANCELLATION_COMPLETED", "slow");

    expect(r.result).toBe("resolved: done");
    expect(r.workflowWaitedMs).toBeGreaterThan(ACTIVITY_MS);
    expect(r.activity.sawCancellation).toBe(false);
  });

  it("TRY_CANCEL for non-heartbeating activity: throws right away, the activity keeps running", async () => {
    const r = await run("TRY_CANCEL", "slow");

    expect(r.result).toBe("rejected: cancelled");
    expect(r.workflowWaitedMs).toBeLessThan(1_000); // did not wait
    expect(r.activityRanAfterCancelMs).toBeGreaterThanOrEqual(ACTIVITY_MS); // ran on in the background
    expect(r.activity.sawCancellation).toBe(false);
  });

  it("ABANDON for non-heartbeating activity: same as TRY_CANCEL from the workflow's side", async () => {
    const r = await run("ABANDON", "slow");

    expect(r.result).toBe("rejected: cancelled");
    expect(r.workflowWaitedMs).toBeLessThan(1_000);
    expect(r.activityRanAfterCancelMs).toBeGreaterThanOrEqual(ACTIVITY_MS);
    expect(r.activity.sawCancellation).toBe(false);
  });

  it("WAIT_CANCELLATION_COMPLETED for heartbeating honouring activity: the activity learns about it and the workflow gets a cancellation", async () => {
    const r = await run("WAIT_CANCELLATION_COMPLETED", "heartbeatingWithSleep");

    expect(r.result).toBe("rejected: cancelled");
    expect(r.workflowWaitedMs).toBeLessThan(ACTIVITY_MS - 2_000); // stopped early
    expect(r.activity.sawCancellation).toBe(true);
  });

  it("WAIT_CANCELLATION_COMPLETED for heartbeating ignoring activity: the activity sees cancellation signal but ignores it", async () => {
    const r = await run("WAIT_CANCELLATION_COMPLETED", "heartbeatingWithIgnoringCancelSignal");

    expect(r.result).toBe("resolved: OK true");
    expect(r.activity.sawCancellation).toBe(true);
  });


  it("TRY_CANCEL for heartbeating activity: throws right away, the activity terminates earlier", async () => {
    const r = await run("TRY_CANCEL", "heartbeatingWithSleep");

    expect(r.result).toBe("rejected: cancelled");
    expect(r.workflowWaitedMs).toBeLessThan(1_000);
    expect(r.activity.sawCancellation).toBe(true);
  });
});
