# Bufo Finder

A single-page emoji picker: type a message, pause for 700 ms, and Jev scores **every bufo filename** for semantic relevance to the entire message. Click a result to copy its `:slack-code:`.

## Run locally

Requires Node 22.13+ and the GitHub CLI, authenticated with read access to [the emoji source repo](https://github.com/github/slack-emoji/tree/main/emojis/_bufo). The runtime has no npm dependencies; no build, Slack token, or new hosting account is needed.

```sh
cd bufo
npm run sync
npm start
```

Open **http://127.0.0.1:4318**, click **Connect Jev**, choose a provider, and enter its API key. The key is held only in the local server's memory and the password field is cleared after use. Connecting checks the key with a tiny synthetic request; it does not send the private catalog. Connecting also opts into automatic suggestions for the current page.

For an optional persistent local setup, copy `.env.example` to `.env` and fill in **one** provider's key. `.env` is ignored by Git. Restart the server after changes. Enable **Suggest with Jev after I pause** in the page; environment credentials alone never opt a browser into AI requests. `PORT` can select a different local port.

Without a key or with AI switched off, the app explicitly says that no analysis has run. The empty-message gallery is only a preview of the collection. There is no keyword-matching fallback: phrases such as "payments are broken" and "oops" are sent to Jev in full, and every filename is scored even when it shares no words with the message.

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

1. The sync command reads the source's Git trees and canonical emoji mapping through `gh`. It pins the child trees and image blobs to the same snapshot, resolves duplicate PNG/GIF versions using the canonical mapping, and writes an ignored local index.
2. **Every filename gets its own Jev relevance question.** Each question asks whether that emoji would be a natural reaction to the meaning and feeling of the entire message. There is no keyword filter, local mood taxonomy, `Choice` competition, or shortlist. The 255-option `Choice` limit does not apply to these independent yes/no questions.
3. Questions are packed into conservative 24 KB JSON requests with up to three calls in flight. Each batch receives the complete message as shared state. Every result must be valid and every batch must finish; a failed batch never produces a partial success.
4. The app sorts Jev's independent relevance estimates, deduplicates identical image assets, and shows up to twelve suggestions with estimated filename-fit scores. Even an all-low-scoring result is shown with an explicit weak-match warning, not an unexplained "zero results." Scores are model judgments, not guarantees or image analysis.

Exhaustive scoring can take several seconds and cost more than shortlisting. The UI explicitly says Jev is scoring the whole catalog while it runs. Changing or clearing the message cancels pending work, aborts obsolete requests, and rejects stale results. Up to twenty rankings are cached in browser memory until reload or a provider change; nothing is saved to localStorage. The server allows only one ranking at a time and surfaces timeouts, invalid answers, rate limits, and account/credit errors. There are no automatic paid retries. Aborting a request cannot guarantee the provider stops work already accepted or refunds it.

## Private assets and data flow

The source emoji repo is private. This app's code lives in a public site repo, so **no source images or catalog are committed or publicly deployed**. The sync output and downloaded images live in `bufo/.local/`, ignored by Git and readable only by the local user by default. Images are fetched on demand using existing GitHub CLI authentication, verified against Git blob hashes, and cached locally.

**When AI is enabled, the message and emoji filenames are sent to the selected model provider. Image bytes, GitHub credentials, image URLs, and blob hashes are not.** The app makes this explicit before enabling AI. Do not submit confidential messages or filenames to a provider that is not approved to receive them. TypeSafe says it does not train on requests; that is not a promise of zero retention. Vercel routes only to TypeSafe in this app, and no account-specific zero-retention entitlement is assumed.

The local server binds only to `127.0.0.1`, checks Host/Origin, requires a per-process token on writes, serves an explicit static-file allowlist, and does not log request bodies, filenames, or credentials. Disconnect forgets the in-memory model key; a key explicitly saved in `.env` will load again at the next server start.

GitHub Pages can display the setup screen but cannot execute the local proxy. Do not tunnel this server, expose it on the LAN, upload `.local/` to Vercel, or put a shared API key in client JavaScript. A hosted version needs a separately approved private deployment with authentication and private asset storage, or a source catalog licensed and authorized for public use.

## Verify and maintain

```sh
npm test
npm run check
npm run sync
```

Tests use synthetic filenames, images, and mocked provider responses. They cover exhaustive scoring, context limits, semantic results without keyword overlap, both provider protocols, debounce timing, stale responses, cancellation, private asset handling, canonical duplicates, key handling, and local request protections. They do not prove live model quality or current account access; connecting a real key performs the separate live account check.

Optional browser checks use Playwright with an installed Google Chrome and isolated test servers. They never use the private source catalog, call a real model, or overwrite the host clipboard:

```sh
npm ci
npm run test:browser
```

Re-run `npm run sync` to refresh the snapshot, then reload the app. Old content-addressed image cache files remain private and can be removed from `.local/images/` if no longer wanted. Never add `.local/` or `.env` to a commit.
