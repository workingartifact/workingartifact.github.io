const ARTIFACTS = Object.freeze({
  "build-the-entity": {
    downloadUrl: "https://github.com/workingartifact/workingartifact.github.io/releases/latest/download/build-the-entity.html"
  }
});

function json(payload, status, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=15, stale-while-revalidate=60",
      "Content-Type": "application/json; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

function redirect(downloadUrl, counterStatus) {
  return new Response(null, {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
      "Location": downloadUrl,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Counter-Status": counterStatus
    }
  });
}

function isObviousPrefetch(request) {
  return ["Purpose", "Sec-Purpose", "X-Purpose"].some((name) =>
    (request.headers.get(name) || "").toLowerCase().includes("prefetch")
  );
}

async function readCount(database, artifact) {
  const row = await database
    .prepare("SELECT count FROM artifact_counts WHERE artifact = ?1")
    .bind(artifact)
    .first();
  return Number(row?.count || 0);
}

async function incrementCount(database, artifact) {
  const row = await database
    .prepare("UPDATE artifact_counts SET count = count + 1, updated_at = CURRENT_TIMESTAMP WHERE artifact = ?1 RETURNING count")
    .bind(artifact)
    .first();
  if (!row) throw new Error("Counter row is missing");
  return Number(row.count);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const countMatch = url.pathname.match(/^\/v1\/count\/([a-z0-9-]+)$/);
    const downloadMatch = url.pathname.match(/^\/download\/([a-z0-9-]+)$/);

    if (request.method === "OPTIONS" && countMatch) {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Headers": "Accept",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    if (countMatch) {
      const artifact = countMatch[1];
      if (!ARTIFACTS[artifact]) return json({ error: "not_found" }, 404);
      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({ error: "method_not_allowed" }, 405, { Allow: "GET, HEAD, OPTIONS" });
      }
      try {
        const count = await readCount(env.COUNTER_DB, artifact);
        if (request.method === "HEAD") {
          return new Response(null, { status: 200, headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
        }
        return json({ artifact, count }, 200);
      } catch {
        return json({ error: "counter_unavailable" }, 503, { "Cache-Control": "no-store" });
      }
    }

    if (downloadMatch) {
      const artifact = downloadMatch[1];
      const definition = ARTIFACTS[artifact];
      if (!definition) return json({ error: "not_found" }, 404);
      if (request.method !== "GET" && request.method !== "HEAD") {
        return json({ error: "method_not_allowed" }, 405, { Allow: "GET, HEAD" });
      }
      if (request.method === "HEAD") return redirect(definition.downloadUrl, "skipped-head");
      if (isObviousPrefetch(request)) return redirect(definition.downloadUrl, "skipped-prefetch");

      try {
        await incrementCount(env.COUNTER_DB, artifact);
        return redirect(definition.downloadUrl, "counted");
      } catch {
        return redirect(definition.downloadUrl, "unavailable");
      }
    }

    return json({ error: "not_found" }, 404);
  }
};
