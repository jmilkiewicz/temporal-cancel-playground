import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { TASK_QUEUE } from "./shared";

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  });
  try {
    const worker = await Worker.create({
      connection,
      taskQueue: TASK_QUEUE,
      workflowsPath: require.resolve("./greetWorkflow"),
      activities,
    });
    await worker.run();
  } finally {
    await connection.close();
  }
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
