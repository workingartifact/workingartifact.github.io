import { createServer } from "node:http";
import worker from "../src/index.js";
import { MemoryD1 } from "./mock-d1.mjs";

const port = Number(process.env.PORT || 8787);
const database = new MemoryD1();

const server = createServer(async (incoming, outgoing) => {
  const body = [];
  for await (const chunk of incoming) body.push(chunk);
  const request = new Request(`http://127.0.0.1:${port}${incoming.url}`, {
    method: incoming.method,
    headers: incoming.headers,
    body: body.length && incoming.method !== "GET" && incoming.method !== "HEAD" ? Buffer.concat(body) : undefined,
    redirect: "manual"
  });
  const response = await worker.fetch(request, { COUNTER_DB: database });
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Counter preview: http://127.0.0.1:${port}/v1/count/build-the-entity`);
  console.log(`Counted redirect: http://127.0.0.1:${port}/download/build-the-entity`);
});
