import type { Server } from "node:http";
import { startWorkServer } from "./workServer";

export default async function globalSetup(): Promise<void> {
  (globalThis as { __WORK_SERVER__?: Server }).__WORK_SERVER__ = await startWorkServer();
}
