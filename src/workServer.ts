import { createServer, Server } from "node:http";
import { AddressInfo } from "node:net";
import { probe } from "./probe";

/**
 * Local stand-in for a slow downstream service: `GET /?ms=N` answers "OK" after N ms.
 * Records in the probe when the client hangs up before the answer was sent.
 */
export async function startWorkServer(): Promise<Server> {
  const server = createServer((req, res) => {
    const ms = Number(new URL(req.url ?? "/", "http://localhost").searchParams.get("ms") ?? 0);
    const timer = setTimeout(() => {
      res.statusMessage = "OK";
      res.end("done");
    }, ms);
    res.on("close", () => {
      if (!res.writableEnded) {
        clearTimeout(timer);
        probe.requestAborted = true;
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  probe.workUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  return server;
}

export async function stopWorkServer(server: Server | undefined): Promise<void> {
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
