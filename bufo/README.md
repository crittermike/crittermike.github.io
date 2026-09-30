# Bufo Finder

A single-page emoji picker: type a message, pause for 700 ms, and Jev scores **every bufo filename** for semantic relevance to the entire message. Click a result to copy its `:slack-code:`.

## Shared internal service

The app uses **one server-managed model credential**. Viewers open the internal URL, type a message, and click an emoji. There are no viewer API keys, provider settings, account-connection dialogs, or AI toggles. The interface is light-only.

Deployment needs an approved private host, a company-authenticated reverse proxy, an approved model account with credits, and narrow service access to the source repo. The public GitHub Pages site cannot run this backend. No live internal deployment or model account is included in this repo.

Configure these once in the host's secret/config store:

| Variable | Value |
| --- | --- |
| `BUFO_MODE` | `shared` |
| `BUFO_PUBLIC_ORIGIN` | Exact HTTPS origin, e.g. `https://bufo.internal.example`, with no path |
| `BUFO_PROXY_SECRET` | Random secret of at least 32 characters, shared only with the authentication proxy |
| `BUFO_GITHUB_TOKEN` | Approved service credential with read access to `github/slack-emoji`; never a viewer's token |
| `JEV_PROVIDER` | `typesafe` (default) or `vercel` |
| `TYPESAFE_API_KEY` | Central TypeSafe key; alternatively use `AI_GATEWAY_API_KEY` with `vercel` |
| `BUFO_DATA_DIR` | Private writable cache directory; the container uses `/data` |
| `PORT` | Internal listening port, default `4318` |

The reverse proxy is part of the required deployment, not implemented by this app. It must authenticate and authorize company users, **strip incoming `X-Bufo-Proxy-Secret` and `X-Bufo-User` headers**, then inject its own secret and a stable, canonical user ID after authentication. IDs may contain ASCII letters, digits, `@._+-`. Preserve the public Host and browser Origin. Terminate HTTPS at the proxy and keep the backend reachable only on the proxy's private network. Never expose the proxy secret in browser code or share a bypass URL. Every route, including images and HTML, requires the proxy assertion.

The server refuses incomplete shared configuration. Startup checks Jev access with a synthetic question and syncs the private catalog before opening the port. Invalid model access or source access prevents startup rather than producing a broken shared site. Secret renewal, source access, provider budgets, and identity/proxy configuration are operator responsibilities.

Build the source-only container from the repo root:

```sh
docker build -t bufo-internal ./bufo
docker run --rm --name bufo-internal \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --env-file bufo/.env \
  --mount type=volume,source=bufo-private-data,target=/data \
  --publish 127.0.0.1:4318:4318 bufo-internal
```

This example assumes the approved proxy runs on the same host. Adapt private networking and secret injection to the actual platform. The build-context allowlist excludes all local credentials, private images, catalog files, and test output. The image runs as a non-root user; mounted storage must be writable by that user (UID 1000). The service has no runtime npm dependencies.

Start with one instance: the four-active-ranking limit and three-upstream-evaluation pool are per process. Each authenticated viewer has a separate active-request/cooldown state, and cancelling one viewer's work cannot cancel another's. Additional replicas multiply these limits; set an account-level spend cap before scaling. CSRF tokens are user-scoped and remain valid across replicas using the same proxy secret.

**Why not a normal Vercel share link?** Standard [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication) grants access to authorized Vercel users, not automatically to every member of a GitHub company org. It would add an account/access requirement for viewers. A company-approved SSO host avoids that. The model provider can still be Vercel Gateway regardless of where this Node service runs.

## Local preview

Requires Node 22.13+ and the GitHub CLI, authenticated with read access to [the emoji source repo](https://github.com/github/slack-emoji/tree/main/emojis/_bufo). The runtime has no npm dependencies; no build, Slack token, or new hosting account is needed.

```sh
cd bufo
cp .env.example .env
# Set one approved model provider's key in .env.
npm run sync
npm start
```

Open **http://127.0.0.1:4318**. Suggestions run automatically after typing pauses. `.env` is ignored by Git; restart after changing it. Leave `BUFO_MODE` unset for safe loopback-only operation. `BUFO_GITHUB_TOKEN` can replace CLI authentication when needed. Both startup and sync load `.env`.

Without a server key, the page explicitly says the app owner must finish setup and disables input. It never asks viewers for credentials or pretends it ran Jev. There is no keyword-matching fallback: phrases such as "payments are broken" and "oops" are sent to Jev in full, and every filename is scored even when it shares no words with the message.

## Provider research

Verified against official docs on September 30, 2026:

| | TypeSafe directly | Vercel AI Gateway |
| --- | --- | --- |
| Model | `jev-latest` (currently `jev-1.13.0`) | `typesafe-ai/jev` |
| Endpoint | `https://api.typesafe.ai/v1/systemone` | `https://ai-gateway.vercel.sh/v1/evaluate` |
| Authentication | TypeSafe API key | AI Gateway API key, not a Vercel personal access token |
| Published Jev price | $0.042 / million input tokens; output is free | $0.042 / million input tokens |
| Recommendation | Simplest for a small app using only Jev | Good if you already use Gateway credits, billing, logs, or budgets |

Both are implemented using their documented HTTP APIs, without an SDK dependency. Jev is a text-only **decision model**, not a chat model; an OpenAI `/chat/completions` endpoint is not appropriate. TypeSafe returns `noul` for a yes/no probability; Vercel's native evaluation API calls it `boolean`. This app uses those probabilities as independent relevance scores.

Create a key at [TypeSafe](https://console.typesafe.ai/keys) or [Vercel AI Gateway](https://vercel.com/d?to=%2F%5Bteam%5D%2F~%2Fai-gateway%2Fapi-keys). Use an account/provider approved for the data you submit. Account creation, billing, and any credit purchase must be done by the account owner. Do not assume Jev is free: Vercel's current free tier is limited to a subset of models, and account-specific credit eligibility must be checked in its dashboard. The app never purchases credits or enables automatic top-ups.

Pricing example, not a measured cost: 300,000 total input tokens across all scoring batches would cost $0.0126, or about $12.60 per 1,000 suggestions at the listed token price. Exhaustive scoring repeats a question for every filename, so it processes substantially more than just the message and filename list. Actual token counts depend on filenames and message length. The response includes aggregate token usage. This excludes any account/payment fees and assumes current prices.

Sources: [TypeSafe models, pricing, context and data handling](https://docs.typesafe.ai/models), [TypeSafe API](https://docs.typesafe.ai/api), [TypeSafe ranking pattern](https://docs.typesafe.ai/cookbooks/semantic_find), [Vercel Jev listing](https://vercel.com/ai-gateway/models/jev), [Vercel evaluation HTTP API](https://vercel.com/docs/ai-gateway/modalities/evaluation), [Gateway pricing and credits](https://vercel.com/docs/ai-gateway/pricing), [Gateway authentication](https://vercel.com/docs/ai-gateway/authentication-and-byok).

## How filename ranking works

1. Startup in shared mode, or the local sync command, reads the source's Git trees and canonical emoji mapping. Hosted access uses the GitHub REST API with the server credential; local previews can use `gh`. It pins the child trees and image blobs to the same snapshot, resolves duplicate PNG/GIF versions using the canonical mapping, and writes a private index.
2. **Every filename gets its own Jev relevance question.** Each question asks whether that emoji would be a natural reaction to the meaning and feeling of the entire message. There is no keyword filter, local mood taxonomy, `Choice` competition, or shortlist. The 255-option `Choice` limit does not apply to these independent yes/no questions.
3. Questions are packed into conservative 24 KB JSON requests with up to three evaluations in flight across viewers. Each batch receives the complete message as shared state. Every result must be valid and every batch must finish; a failed batch never produces a partial success.
4. The app sorts Jev's independent relevance estimates, deduplicates identical image assets, and shows up to twelve suggestions. Even an all-low-scoring result is shown with an explicit weak-match warning, not an unexplained "zero results." Scores are model judgments, not guarantees or image analysis; they are kept out of the minimal UI.

Exhaustive scoring can take several seconds and cost more than shortlisting. The UI explicitly says Jev is scoring the whole catalog while it runs. Changing or clearing the message cancels pending work, aborts obsolete requests, and rejects stale results. Up to twenty rankings are cached in each browser's memory until reload; nothing is saved to localStorage or shared between viewers. The server allows one ranking per viewer and four viewers at once, and surfaces timeouts, invalid answers, rate limits, and account/credit errors. There are no automatic paid retries. Aborting a request cannot guarantee the provider stops work already accepted or refunds it.

## Private assets and data flow

The source emoji repo is private. This app's code lives in a public site repo, so **no source images or catalog are committed or publicly deployed**. The sync output and downloaded images live in private server storage (`BUFO_DATA_DIR`, default `bufo/.local/`). Images are fetched on demand, verified against Git blob hashes, and cached with restricted file permissions. The MIME type comes from the verified image bytes because some source filenames have misleading extensions. Private deployment is mandatory even though the app code is public.

**Typing sends the message and emoji filenames to the selected model provider after a pause. Image bytes, GitHub credentials, image URLs, and blob hashes are not sent.** A short disclosure stays below the textarea. The operator must approve this data flow before enabling the shared service. Do not submit confidential messages or filenames to a provider that is not approved to receive them. TypeSafe says it does not train on requests; that is not a promise of zero retention. Vercel routes only to TypeSafe in this app, and no account-specific zero-retention entitlement is assumed.

Local mode binds only to `127.0.0.1`, checks Host/Origin, and requires a per-process CSRF token on writes. Shared mode requires the trusted proxy assertion and per-user CSRF token. Both serve an explicit static-file allowlist and do not log request bodies, filenames, identities, or credentials. There are no browser endpoints for changing or disconnecting the central model key.

Do not tunnel local mode, put a shared API key in client JavaScript, add private files to a container image, or expose the source collection on an anonymous URL. Authenticated private deployment is a requirement, not an optional improvement.

## Verify and maintain

```sh
npm test
npm run check
npm run sync
```

Tests use synthetic filenames, images, and mocked provider responses. They cover exhaustive scoring, context limits, semantic results without keyword overlap, both provider protocols, debounce timing, stale responses, cancellation, private assets, canonical duplicates, server credentials, shared-user isolation, global upstream concurrency, proxy authentication, and light-only no-setup browser behavior. They do not prove live model quality, latency, or account access. Shared startup checks the configured account; assess real suggestions before rolling out to colleagues.

Optional browser checks use Playwright with an installed Google Chrome and isolated test servers. They never use the private source catalog, call a real model, or overwrite the host clipboard:

```sh
npm ci
npm run test:browser
```

Re-run `npm run sync` to refresh the snapshot, then reload the app; shared startup also refreshes it. Old content-addressed image cache files remain private and can be removed from the cache's `images/` directory if no longer wanted. Rotate expiring service/model credentials in the host's secret store and restart the service. Never add `.local/` or `.env` to a commit.
