import { Client, Connection } from "@temporalio/client";
import { randomUUID } from "node:crypto";
import { TASK_QUEUE } from "./shared";
import { greetWorkflow } from "./greetWorkflow";

async function run(): Promise<void> {
  const name = process.argv[2] ?? "Temporal";
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  });
  try {
    const client = new Client({ connection });
    const result = await client.workflow.execute(greetWorkflow, {
      args: [name],
      taskQueue: TASK_QUEUE,
      workflowId: `greet-${randomUUID()}`,
    });
    console.log(result);
  } finally {
    await connection.close();
  }
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
