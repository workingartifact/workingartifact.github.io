import assert from "node:assert/strict";

const origin = process.env.COUNTER_ORIGIN || "http://127.0.0.1:8787";
const countUrl = `${origin}/v1/count/build-the-entity`;
const downloadUrl = `${origin}/download/build-the-entity`;
const releaseUrl = "https://github.com/workingartifact/workingartifact.github.io/releases/latest/download/build-the-entity.html";

async function count() {
  const response = await fetch(countUrl);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
  return (await response.json()).count;
}

const before = await count();

const head = await fetch(downloadUrl, { method: "HEAD", redirect: "manual" });
assert.equal(head.status, 302);
assert.equal(head.headers.get("X-Counter-Status"), "skipped-head");
assert.equal(await count(), before);

const prefetch = await fetch(downloadUrl, { headers: { Purpose: "prefetch" }, redirect: "manual" });
assert.equal(prefetch.status, 302);
assert.equal(prefetch.headers.get("X-Counter-Status"), "skipped-prefetch");
assert.equal(await count(), before);

const download = await fetch(downloadUrl, { redirect: "manual" });
assert.equal(download.status, 302);
assert.equal(download.headers.get("Location"), releaseUrl);
assert.equal(download.headers.get("X-Counter-Status"), "counted");
assert.equal(await count(), before + 1);

console.log(JSON.stringify({
  before,
  after: before + 1,
  redirect: download.headers.get("Location"),
  headCounted: false,
  prefetchCounted: false,
  cors: "*"
}));
