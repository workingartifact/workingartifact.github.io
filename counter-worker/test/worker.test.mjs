import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";
import { FailingD1, MemoryD1 } from "./mock-d1.mjs";

const RELEASE_URL = "https://github.com/workingartifact/workingartifact.github.io/releases/latest/download/build-the-entity.html";

function request(path, options = {}) {
  return new Request("http://127.0.0.1:8787" + path, options);
}

test("read endpoint returns the aggregate count and public CORS header", async () => {
  const database = new MemoryD1(12);
  const response = await worker.fetch(request("/v1/count/build-the-entity"), { COUNTER_DB: database });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.deepEqual(await response.json(), { artifact: "build-the-entity", count: 12 });
  assert.equal(database.count, 12);
});

test("ordinary GET downloads increment once and redirect", async () => {
  const database = new MemoryD1();
  const response = await worker.fetch(request("/download/build-the-entity"), { COUNTER_DB: database });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), RELEASE_URL);
  assert.equal(response.headers.get("X-Counter-Status"), "counted");
  assert.equal(database.count, 1);
});

test("the single-statement increment remains correct under concurrent requests", async () => {
  const database = new MemoryD1();
  const responses = await Promise.all(
    Array.from({ length: 40 }, () => worker.fetch(request("/download/build-the-entity"), { COUNTER_DB: database }))
  );
  assert.ok(responses.every((response) => response.status === 302));
  assert.equal(database.count, 40);
});

test("HEAD and obvious prefetch requests redirect without counting", async () => {
  const database = new MemoryD1(7);
  const head = await worker.fetch(request("/download/build-the-entity", { method: "HEAD" }), { COUNTER_DB: database });
  const prefetch = await worker.fetch(request("/download/build-the-entity", { headers: { Purpose: "prefetch" } }), { COUNTER_DB: database });
  assert.equal(head.status, 302);
  assert.equal(prefetch.status, 302);
  assert.equal(head.headers.get("X-Counter-Status"), "skipped-head");
  assert.equal(prefetch.headers.get("X-Counter-Status"), "skipped-prefetch");
  assert.equal(database.count, 7);
});

test("database failure never blocks the release download", async () => {
  const response = await worker.fetch(request("/download/build-the-entity"), { COUNTER_DB: new FailingD1() });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("Location"), RELEASE_URL);
  assert.equal(response.headers.get("X-Counter-Status"), "unavailable");
});

test("read failures are explicit and unsupported routes or methods are rejected", async () => {
  const unavailable = await worker.fetch(request("/v1/count/build-the-entity"), { COUNTER_DB: new FailingD1() });
  const missing = await worker.fetch(request("/v1/count/not-an-artifact"), { COUNTER_DB: new MemoryD1() });
  const post = await worker.fetch(request("/download/build-the-entity", { method: "POST" }), { COUNTER_DB: new MemoryD1() });
  assert.equal(unavailable.status, 503);
  assert.equal(missing.status, 404);
  assert.equal(post.status, 405);
});
