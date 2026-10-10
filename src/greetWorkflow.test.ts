import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { greetWorkflow } from "./greetWorkflow";

describe("greetWorkflow", () => {
  const taskQueue = "test";
  let testEnv: TestWorkflowEnvironment;
  let worker: Worker;
  let workerRun: Promise<void>;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
    worker = await Worker.create({
      connection: testEnv.nativeConnection,
      taskQueue,
      workflowsPath: require.resolve("./greetWorkflow"),
      activities,
    });
    workerRun = worker.run();
  });

  afterAll(async () => {
    worker?.shutdown();
    await workerRun;
    await testEnv?.teardown();
  });

  it("greets Alice", async () => {
    const result = await testEnv.client.workflow.execute(greetWorkflow, {
      args: ["Alice"],
      taskQueue,
      workflowId: "greet-alice",
    });

    expect(result).toBe("Hello, Alice!");
  });

  it("greets Bob", async () => {
    const result = await testEnv.client.workflow.execute(greetWorkflow, {
      args: ["Bob"],
      taskQueue,
      workflowId: "greet-bob",
    });

    expect(result).toBe("Hello, Bob!");
  });
});
