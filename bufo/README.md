# Bufo Finder

A single-page emoji picker: type a message, pause for 700 ms, and Jev scores **every bufo filename** for semantic relevance to the entire message. Click a result to copy its `:slack-code:`.

## Public deployment on Fly

Public URL: **https://bufo-picker.fly.dev**. No sign-in, viewer API key, or account setup is required. The owner has authorized public sharing of this emoji collection. The app still calls TypeSafe directly; using Fly for hosting does not require changing model providers.

`fly.toml` provisions one 512 MB `shared-cpu-1x` Machine in `iad`, with HTTPS, streaming responses, and a 1 GB encrypted volume. The Machine stays running to avoid cold starts. The runtime runs as the non-root `node` user. This is a small single-instance deployment, not a highly available service: deploys or hardware failure can cause downtime.

The model key is a **Fly runtime secret**, never part of the image or browser code. The public image contains a pre-exported, verified emoji snapshot, so it needs **no GitHub credential** and makes no runtime GitHub requests. Local source access can still require GitHub authentication; that is separate from permission to publish the exported emoji artwork.

Anonymous inference is deliberately bounded:

- Ten searches per minute per client IP, one active search per client, four active searches overall, and twelve upstream evaluations in flight.
- A persistent **25,000,000-input-token budget per UTC day**, about **$1.05 at the current TypeSafe price**, excluding startup connection checks and hosting. This normally covers about ninety short-message rankings, with fewer possible after failures or cancellations.
- Before paid inference, reserve 65,536 tokens for every planned provider request, conservatively covering Jev's documented 64k request ceiling. Successful requests release the difference from reported usage. Failures, cancellations, and missing usage retain the full reservation. Searches are charged to the UTC day on which they start.
- The aggregate ledger lives at `/data/usage.json`, is serialized and synced to disk before paid work, and survives restarts. Invalid or unavailable storage fails closed. No messages or client IPs are written to this ledger.

These are app-level limits, not a provider billing guarantee. Other apps using the same key, changing model prices/limits, or adding replicas can change total spending. Keep this deployment at **one Machine**, preserve its volume, and use account-level spending controls where available. Do not delete the ledger to recover from a quota error; it resets at midnight UTC. Changing `BUFO_DAILY_TOKEN_LIMIT` in `fly.toml` changes the allowance after redeploy.

To refresh the snapshot and redeploy from a checkout with Fly and source access:

```sh
cd bufo
npm run sync
npm run export
flyctl deploy --remote-only --depot=false --ha=false
```

`export` verifies every image's bytes, size, and Git blob hash, then writes only `catalog.json` and `images/` under ignored `public-assets/`. It paces requests to avoid hammering the source. The `public` Docker target includes that directory; `.env`, `.local`, screenshots, and benchmark data remain excluded. A failed export must not be deployed. Exported images are read-only at runtime: a damaged or missing image fails explicitly rather than trying to fetch GitHub with an operator credential.

For a new Fly app, change both `app` and `BUFO_PUBLIC_ORIGIN` in `fly.toml`, allocate shared public IPv4 and public IPv6 addresses with `flyctl ips allocate-v4 --shared` and `flyctl ips allocate-v6`, and create an encrypted `bufo_data` volume in the chosen region. Initialize that volume's mount point with owner UID/GID 1000 before starting the non-root app. Stage only `TYPESAFE_API_KEY` with `flyctl secrets import --stage` through standard input; do not put its value in command arguments or import unrelated local secrets. The existing `bufo-picker` app and volume are already provisioned. `/healthz` checks service readiness without running paid inference.

Public mode uses Fly Proxy's `Fly-Client-IP` when running on Fly, and the socket address elsewhere. Client-supplied `X-Forwarded-For` is not trusted. CSRF tokens are scoped to the network client; Host and Origin checks still apply. IP sharing and NAT can make several visitors share a rate limit. These checks do not identify people or make a public endpoint bot-proof; the persistent global quota is the spending safeguard.

## Optional authenticated internal service

The app uses **one server-managed model credential**. Viewers open the internal URL, type a message, and click an emoji. There are no viewer API keys, provider settings, account-connection dialogs, or AI toggles. The interface is light-only.

Shared mode is an alternative for collections that need restricted access; it is not used by the public Fly deployment. It needs an approved private host, a company-authenticated reverse proxy, an approved model account with credits, and narrow service access to the source repo. The public GitHub Pages site cannot run this backend.

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

Forward `/api/suggest` response chunks promptly without buffering so live progress and best-so-far suggestions work. The server sends `X-Accel-Buffering: no` and `Cache-Control: no-store, no-transform`; the proxy must honor the streaming behavior.

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

This example assumes the approved proxy runs on the same host. Adapt private networking and secret injection to the actual platform. The default `shared` image target contains source code only; the separate `public` target explicitly includes `public-assets/`. The build-context allowlist excludes local credentials, `.local/`, and test output. The image runs as a non-root user; mounted storage must be writable by that user (UID 1000). The service has no runtime npm dependencies.

Start with one instance: the four-active-ranking limit and twelve-upstream-evaluation pool are per process. Each authenticated viewer has a separate active-request/cooldown state, and cancelling one viewer's work cannot cancel another's. Additional replicas multiply these limits; set an account-level spend cap before scaling. CSRF tokens are user-scoped and remain valid across replicas using the same proxy secret.

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

A live check on September 30, 2026 with TypeSafe `jev-1.13.0` and 1,867 emojis used 45 requests and 272,080-272,170 aggregate input tokens per ranking for two short messages. Server ranking time was 2.9-3.0 seconds, excluding the 700 ms pause and image loading. At the published rate, that is about $0.0114 per ranking ($11.43 per 1,000), not an invoice-confirmed charge. Exhaustive scoring repeats a question for every filename, so it processes substantially more than just the message and filename list. Longer messages, catalog changes, provider load, and plan limits can change cost and latency. The response includes aggregate token usage. These estimates exclude account/payment fees.

Sources: [TypeSafe models, pricing, context and data handling](https://docs.typesafe.ai/models), [TypeSafe API](https://docs.typesafe.ai/api), [TypeSafe ranking pattern](https://docs.typesafe.ai/cookbooks/semantic_find), [Vercel Jev listing](https://vercel.com/ai-gateway/models/jev), [Vercel evaluation HTTP API](https://vercel.com/docs/ai-gateway/modalities/evaluation), [Gateway pricing and credits](https://vercel.com/docs/ai-gateway/pricing), [Gateway authentication](https://vercel.com/docs/ai-gateway/authentication-and-byok).

### Batch-size and concurrency experiment

The [Pydantic Evals article](https://pydantic.dev/articles/jev-evals) groups independent questions into one request and records the actual model version and token usage. The important point for this app is that **Jev evaluates questions within a request in parallel**; HTTP concurrency is a separate setting. Its example's two concurrent cases are not a recommended service limit, and its Logfire integration is not needed here.

[TypeSafe's model docs](https://docs.typesafe.ai/models) currently specify 64k tokens for state plus all questions and 32k for state plus the longest question, not a fixed number of yes/no questions. Published rate limits are 100k tokens/second and 40 requests/second, explicitly subject to change. [TypeSafe's batching cookbook](https://docs.typesafe.ai/cookbooks/parallel_questions) compares batched questions with sequential requests over a long document; its reported 10x speedup is not a comparison against concurrent requests, and its large cost saving does not transfer to our short messages.

Live experiments on September 30, 2026 used the same 1,884-file snapshot, unchanged relevance questions, pinned `jev-1.13.0`, and three synthetic messages. There were 30 successful full-catalog runs across batch sizes around 40, 100, 200, and 400, plus isolated capacity probes. Selected results:

| Questions per request | HTTP concurrency ceiling (observed maximum) | Requests per ranking | Successful runs | Median completion | Median first batch |
| --- | --- | --- | --- | --- | --- |
| About 40, old 24 KB cap | 3 (3) | 46 | 5 | 2.855 s | 0.173 s |
| 100 | 6 (6) | 19 | 4 | 0.917 s | 0.221 s |
| **100** | **12 (12)** | **19** | **4** | **0.503 s** | **0.229 s** |
| 100 | 24 (19) | 19 | 4 | 0.460 s | 0.226 s |
| About 40, old 24 KB cap | 100 (46) | 46 | 2 | 0.715 s | 0.378 s |
| 200 | 6 (6) | 10 | 1 | 0.891 s | 0.417 s |
| 400 | 6 (5) | 5 | 1 | 0.838 s | 0.641 s |

These are small, interleaved samples on one account, not a load test or latency guarantee. Times include HTTP response parsing but exclude the browser's 700 ms debounce, image loading, and production rendering. A separate old-setting run timed out, and a 100-question/12-worker run failed with HTTP 520; neither is included in successful-run medians. The latter supplied a 60-second cooldown, which the app now honors for gateway errors too. No 429/529 occurred; accepted bursts do not establish sustained throughput or override the published limits. Shared-user throughput and Vercel latency were not benchmarked.

**Selected setting: up to 100 questions and 12 requests in flight**, with a conservative 60,000-byte serialized-body cap that can reduce batch size for longer input. This cuts the observed median by about 5.7x while retaining frequent early updates. Raising the ceiling to 24 saved only 43 ms at the median and doubled the potential shared pool. A 100-worker ceiling launched only 46 requests with the old batch size; with the new packing there are only 19. A 1,000-worker setting was not exercised: it cannot parallelize more work without unnecessarily fragmenting those batches.

A single 400-question request succeeded with 56,764 input tokens; 500 questions failed with `max_tokens_exceeded`. These counts depend on prompt and filename lengths, not an API question-count limit. The selected 100-question requests used about 14k tokens at most in the short-message experiments. Across a full ranking, they used 268,266-268,456 input tokens, about $0.0113 at the published rate, versus about $0.0116 for the old packing.

All scores were still validated and every filename evaluated. Comparing old and new packing gave mean absolute score differences of 0.013-0.018 and 10-11 common top-twelve results; repeated runs of the same configuration varied by about 0.018 too. This is consistent with normal run-to-run variation, not proof of equal quality. The full experiment's returned usage totaled about 8.63 million tokens, or $0.36 at the published rate; failed/aborted work may add unreported charges. Raw responses remain in ignored private storage and are not sent to telemetry services.

## How filename ranking works

1. Startup in shared mode, or the local sync command, reads the source's Git trees and canonical emoji mapping. Shared-mode source access uses the GitHub REST API with the server credential; local previews can use `gh`. It pins the child trees and image blobs to the same snapshot, resolves duplicate PNG/GIF versions using the canonical mapping, and writes a local index. Public mode serves the pre-exported snapshot instead. Canonically mapped multipart bufo sets outside `_bufo/` are included too, so large sets stored in other source directories are not missed.
2. **Every filename gets its own Jev relevance question.** Each question asks whether that emoji would be a natural reaction to the meaning and feeling of the entire message. There is no keyword filter, local mood taxonomy, `Choice` competition, or shortlist. The 255-option `Choice` limit does not apply to these independent yes/no questions.
3. Questions are packed into batches of at most 100, with a conservative 60 KB JSON cap and up to twelve evaluations in flight across viewers. Each batch receives the complete message as shared state. The live progress count advances only when a batch's answers have been received and validated, not when it is submitted. Best-so-far suggestions appear after each batch and reorder as more scores arrive. Every batch must finish for a completed ranking; failure clears provisional choices.
4. The app combines tiled emojis, applies a small name-length preference, deduplicates complete image layouts, and shows up to twelve suggestions. Even an all-low-scoring result is shown with an explicit weak-match warning, not an unexplained "zero results." Scores are model judgments, not guarantees or image analysis; they are kept out of the minimal UI.

**Longer names:** a raw Jev relevance score of at least 0.5 unlocks a bonus of up to **0.06** for sorting. After removing a common `bufo-`/`frog-` prefix (or underscore equivalent), names of eight characters or fewer receive no bonus. The bonus grows linearly to its cap at forty characters. Weak matches get no bonus, and length cannot overcome a materially larger relevance gap. The API preserves raw relevance in `score` and reports `nameBonus` separately; the adjusted sum is not presented as a model probability.

**Tiled emojis:** names ending in `_column_row` are grouped by their base name: the first number moves horizontally, and the second starts a new row. Jev still scores every filename, with context that it represents a tile of the whole emoji; a group's relevance is the mean of its tile scores, not the maximum or sum. A group appears in provisional results only after all its tiles have scores, even when they span batches. Only the base name earns a length bonus. Groups are formed before the twelve-result limit, rendered without gutters, and marked with a visible `BIG` badge and the number of emojis copied. Copying produces adjacent Slack codes with a newline between numerically ordered rows. Zero-based, one-based, and other coordinate offsets work. A standalone emoji with the same base name remains a separate choice. Missing or duplicate coordinates within the observed rectangle produce an explicitly unavailable group rather than a broken copy string. The manual clipboard fallback preserves line breaks.

**Progress transport:** the browser sends `Accept: application/x-ndjson` to `/api/suggest`. The response streams `progress` events containing `scoredCount`, `totalCount`, `completedBatches`, `totalBatches`, and a provisional `ranking` with suggestions, weak-match status, evaluated count, elapsed time, and the captured catalog stamp. It ends with a complete `result` or an explicit `error` event. Best-so-far choices are labeled as provisional but can already be copied. Retained cards reuse their images and preserve keyboard focus when reordered. After headers have been sent, errors are reported in the stream rather than by changing the HTTP status. A truncated or invalid stream clears provisional suggestions and is never cached. Clients without that Accept header still receive the ordinary complete JSON response. Completed results show server ranking time; cached results are identified as cached.

Exhaustive scoring can take several seconds and cost more than shortlisting. The UI explicitly says Jev is scoring the whole catalog while it runs. Changing or clearing the message cancels pending work, aborts obsolete requests, and rejects stale results. Up to twenty rankings are cached in each browser's memory until reload; nothing is saved to localStorage or shared between viewers. The server allows one ranking per viewer and four viewers at once, and surfaces timeouts, invalid answers, rate limits, and account/credit errors. There are no automatic paid retries. Aborting a request cannot guarantee the provider stops work already accepted or refunds it.

## Assets, credentials, and data flow

The owner has confirmed that this Bufo collection may be publicly shared. Its exported snapshot is therefore included in the public Fly image and served without authentication. **Credentials are never public**, and no generated catalog, images, benchmark output, or screenshots are committed to the code repo. Only export artwork you are authorized to share.

Local/shared sync output and downloaded images live in server storage (`BUFO_DATA_DIR`, default `bufo/.local/`). Those modes fetch images on demand, verify Git blob hashes, and cache with restricted file permissions. Public mode serves only its pre-exported snapshot from `BUFO_CATALOG_DIR`, while `BUFO_DATA_DIR` holds its persistent usage ledger. The MIME type comes from verified image bytes because some source filenames have misleading extensions.

**Typing sends the message and emoji filenames to the selected model provider after a pause. Image bytes, GitHub credentials, image URLs, and blob hashes are not sent to the model.** A short disclosure stays below the textarea. Do not submit confidential messages or filenames to a provider that is not approved to receive them. TypeSafe says it does not train on requests; that is not a promise of zero retention. Vercel routes only to TypeSafe in this app, and no account-specific zero-retention entitlement is assumed.

Local mode binds only to `127.0.0.1`, checks Host/Origin, and requires a per-process CSRF token on writes. Shared mode requires the trusted proxy assertion and per-user CSRF token. Public mode requires HTTPS-origin configuration, central credentials, persistent budget storage, and an explicit token allowance. All modes serve an explicit static-file allowlist and do not log request bodies, filenames, identities, or credentials. There are no browser endpoints for changing or disconnecting the central model key.

Do not tunnel local mode, put a model key in client JavaScript, or add unrelated private files to a container image. Public sharing is an explicit deployment mode, not a fallback when shared authentication is misconfigured.

## Verify and maintain

```sh
npm test
npm run check
npm run sync
```

Tests use synthetic filenames, images, and mocked provider responses. They cover exhaustive scoring, bounded name bonuses, mosaic grouping and multiline copying, live top-choice replacement, whole-mosaic scoring gates, image/focus preservation, out-of-order batch progress, interrupted streams, context limits, semantic results without keyword overlap, both provider protocols, debounce timing, stale responses, cancellation, provider cooldowns, asset export, read-only images, canonical duplicates, server credentials, shared-user isolation, global upstream concurrency, proxy authentication, public IP/CSRF limits, durable budget reservations, quota races/restarts, and light-only no-setup browser behavior. They do not prove live model quality, latency, or account access. Hosted startup checks the configured account; assess real suggestions before rolling out to colleagues.

Separate live TypeSafe checks on September 30, 2026 confirmed full-catalog rankings for "oops" and "payments are broken", with all twelve image previews loading for each. These are smoke checks, not a comprehensive quality benchmark or proof of an internal deployment.

Later checks exercised an expanded 1,884-filename snapshot, streamed scoring progress, and real 2-by-2 and 4-by-4 mosaics with visible `BIG` labels and exact multiline copying. The subsequent batch-size experiment above reduced short-message rankings from 46 requests to 19 and enabled live best-so-far choices.

After tuning, two real browser runs completed server scoring in 0.5-0.7 seconds. Copyable choices appeared while scoring was still incomplete, 12-14 distinct top lists appeared, and the 16-tile mosaic still rendered and copied correctly. Desktop and mobile image loading and layout were checked without uploading private screenshots or touching the host clipboard.

The public Fly image was built remotely and verified on September 30, 2026. Two public-browser rankings completed server scoring in 0.6-0.8 seconds, with live suggestions, correct image loading, and exact multiline copying. All 1,884 exported entries were validated inside the running non-root container without a GitHub key. An actual redeploy preserved the existing usage ledger. HTTPS redirection, denial of internal source/secret paths, required write tokens, and Fly's replacement of forged client-IP headers were also checked.

Optional browser checks use Playwright with an installed Google Chrome and isolated test servers. They never use the private source catalog, call a real model, or overwrite the host clipboard:

```sh
npm ci
npm run test:browser
```

Re-run `npm run sync` to refresh a local/shared snapshot, then reload the app; shared startup also refreshes it. For Fly, follow it with `npm run export` and redeploy so the new immutable snapshot reaches the server. Old content-addressed cache files can be removed from the local cache's `images/` directory if no longer wanted. Rotate expiring service/model credentials in the host's secret store and restart the service. Never add `.local/`, `public-assets/`, or `.env` to a commit.
