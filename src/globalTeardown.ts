import type { Server } from "node:http";
import { stopWorkServer } from "./workServer";

export default async function globalTeardown(): Promise<void> {
  const server = (globalThis as { __WORK_SERVER__?: Server }).__WORK_SERVER__;
  if (server) await stopWorkServer(server);
}
