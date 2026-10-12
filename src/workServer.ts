import { createServer, Server } from "node:http";

export const WORK_SERVER_PORT = Number(process.env.WORK_SERVER_PORT ?? 18080);
export const WORK_URL = `http://127.0.0.1:${WORK_SERVER_PORT}/`;

/**
 * Local stand-in for a slow downstream service: `GET /?ms=N` answers "OK" after N ms.
 * Started once for the whole Jest run (see globalSetup.ts).
 */
export async function startWorkServer(): Promise<Server> {
  const server = createServer((req, res) => {
    const ms = Number(new URL(req.url ?? "/", "http://localhost").searchParams.get("ms") ?? 0);
    const timer = setTimeout(() => res.end("done"), ms);
    res.on("close", () => clearTimeout(timer));
  });
  await new Promise<void>((resolve) => server.listen(WORK_SERVER_PORT, "127.0.0.1", resolve));
  return server;
}

export async function stopWorkServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
