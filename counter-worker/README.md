# Working Artifact download-request counter

Local implementation and deployment scaffold for an aggregate, privacy-conscious request counter. Nothing in this directory has been deployed, and the public site continues to link directly to the existing GitHub release until a counter origin is configured.

## Proposed service

Use one Cloudflare Worker with one D1 database row. D1 is appropriate because `UPDATE ... SET count = count + 1 ... RETURNING count` is a single atomic database statement, while eventually consistent key/value storage is not appropriate for concurrent increments.

Cloudflare Workers and D1 currently have free tiers. The free tier is ample for a small educational download counter, subject to Cloudflare's current daily request and database limits. Confirm current pricing before deployment.

The Worker exposes:

- `GET /v1/count/build-the-entity` — returns `{ "artifact": "build-the-entity", "count": 0 }` with public read-only CORS headers.
- `GET /download/build-the-entity` — atomically increments and responds with `302 Location: https://github.com/workingartifact/workingartifact.github.io/releases/latest/download/build-the-entity.html`.
- `HEAD /download/build-the-entity` — redirects without incrementing.
- Obvious prefetch requests — redirect without incrementing when `Purpose`, `Sec-Purpose`, or `X-Purpose` contains `prefetch`.

An eventual Workers subdomain would look like:

- `https://working-artifact-download-counter.<account-subdomain>.workers.dev/v1/count/build-the-entity`
- `https://working-artifact-download-counter.<account-subdomain>.workers.dev/download/build-the-entity`

The aggregate is keyed by the stable artifact identifier `build-the-entity`, so it continues across future release versions.

## Privacy and counting semantics

The database stores only:

- Artifact identifier
- Aggregate integer count
- Last-update timestamp

It does not store IP addresses, user agents, referrers, locations, cookies, fingerprints, visitor identifiers, teacher identities, institutions, or individual events. The Worker does not set cookies and the frontend sends the read request without credentials or a referrer.

The number means aggregate ordinary GET requests routed through the counter endpoint. Repeat requests may be included. Browser cancellation, network failure after the redirect, automated requests that do not advertise themselves as prefetch, and other client behavior mean it is not a count of unique people or guaranteed completed downloads.

## Local verification

From this directory, using Node.js 18 or newer:

```powershell
npm test
npm run dev
```

The development server uses an in-memory D1 test double and begins at zero whenever it restarts. When the Working Artifact site is served from `localhost` or `127.0.0.1`, its counter frontend automatically uses `http://127.0.0.1:8787`. Production remains unconfigured.

## Deployment boundary — do not run without approval

Deployment requires the site owner to:

1. Create or sign in to a Cloudflare account.
2. Install/authenticate Wrangler locally.
3. Create a D1 database named `working-artifact-counter`.
4. Put the resulting non-secret database ID in `wrangler.jsonc`.
5. Apply `migrations/0001_create_artifact_counts.sql` to the remote database.
6. Deploy the Worker.
7. Replace the empty `data-counter-origin` value on both site pages with the final Worker origin.

No API token, account identifier, secret, or database credential belongs in this repository. The D1 database ID is deployment configuration rather than a secret, but it remains a placeholder until the owner creates and approves the resource.

The public download links deliberately retain the GitHub release URL in their HTML. JavaScript switches them to the counted endpoint only after a successful count read. If JavaScript is disabled, the service is unconfigured, or the read endpoint fails, the direct release link remains usable. A visible direct-release fallback is also always present.
