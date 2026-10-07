# Echo-Jev

This repository is not yet the full ECHO runtime.
It provides the bounded intelligence gateway module intended for later integration.

Echo-Jev is a dependency-light TypeScript library for observing three bounded decisions: `task_routing.v1`, `context_relevance.v1`, and `escalation.v1`. Runtime code has no third-party dependencies; TypeScript, Node declarations and Vitest are development tools.

## Authority and architecture

The caller resolves deterministic rules first, supplies an independently authoritative ECHO decision, and calls `observe`. A deterministic resolution bypasses Jev. Otherwise Jev evaluates a sanitized copy of minimal state. The result contains observation metadata and evidence only. No replacement decision, execution callback, authorization, deployment, deletion, publication, permission change, spending, security approval or DONE action exists.

Founder Approval remains authoritative. HIGH/CRITICAL risk is advisory only and marked as requiring Founder Approval. Confidence is recorded for offline calibration; no confidence threshold affects execution. Context relevance never modifies required evidence. Jev does not determine technical truth, and neither Jev nor Context7 grants authority.

`src/intelligence` separates types, versioned schemas, sanitization, provider adapter, evidence and gateway. `EvidenceSink` and `ShadowCircuitBreaker` are explicit integration boundaries. Reference implementations are in memory; evidence retention defaults to 1,000 receipts. Three consecutive similar provider failures open a project-specific circuit until explicit reset or replacement. Success resets that project's count. No durable ledger is claimed.

## Setup and verification

Use Node 22.12+ or Node 24 LTS with npm. The development checks were executed on Node 25; LTS execution should also be verified before integration.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

The build exports `dist/index.js` and declarations. Tests use mocked providers/fetch and need no API key or paid call.

## Configuration

`.env.example` contains no credentials. The library does not implicitly load `.env`; the host loads configuration and passes it explicitly. `configFromEnv()` validates it.

- `JEV_ENABLED=false`: default off; set exactly `true` to enable observation.
- `JEV_MODE=shadow`: the only supported mode.
- `JEV_API_KEY`: server-side provider credential; never pass it as state.
- `JEV_BASE_URL`: optional HTTPS origin; default `https://api.typesafe.ai`. Only trusted administrator configuration may change this credential destination. Redirects are rejected.
- `JEV_MODEL`: optional model ID; default verified pinned `jev-1.13.0`.
- `JEV_TIMEOUT_MS`: default 2,000; accepted range 1–60,000. Provider and evidence sink each have a separate bounded wait.
- `JEV_MAX_STATE_BYTES`: default 16,384 UTF-8 bytes after sanitization; accepted range 1–1,048,576.

```ts
import { DecisionGateway, JevHttpClient, InMemoryEvidenceSink, configFromEnv } from './dist/index.js';

const config = configFromEnv();
// Avoid constructing an HTTP client or requiring a key when disabled.
const client = config.enabled
  ? new JevHttpClient({
      apiKey: process.env.JEV_API_KEY ?? '',
      ...(process.env.JEV_BASE_URL ? { baseUrl: process.env.JEV_BASE_URL } : {}),
      ...(process.env.JEV_MODEL ? { model: process.env.JEV_MODEL } : {}),
    })
  : { observe: async () => { throw new Error('disabled'); } };
const gateway = new DecisionGateway(client, new InMemoryEvidenceSink(), config);
const observation = await gateway.observe({
  task: { id: 'task-1', projectId: 'project-1' },
  authoritativeDecision: 'deterministic',
  shadowRequest: { decisionType: 'task_routing', schemaVersion: 'v1', state: { summary: 'Bounded non-sensitive task description' } },
  risk: 'LOW',
  deterministicResolution: 'static_rule',
});
// ECHO continues using its independently owned decision, never observation.output.
```

Authoritative labels must belong to the same closed schema to support meaningful comparison. Routing labels are `deterministic`, `specialist`, `founder`; relevance labels are `relevant`, `irrelevant`, `uncertain`; escalation labels are `none`, `specialist`, `founder`. These are advisory classification labels, not grants of authority. The host maps its real decisions to labels without handing over execution.

## Security and failure behavior

Dangerous key names (including apiKey, api_key, token, password, secret, authorization, cookie, privateKey, accessToken and refreshToken) are redacted recursively. Common bearer, JWT, GitHub/OpenAI-style keys, AWS access-key IDs, private-key blocks and credential assignments are redacted in strings. Only plain finite JSON data is accepted; accessors, cycles, excessive depth/size and unsupported objects fail closed. Redaction is heuristic: callers must still minimize context and exclude sensitive/customer data, full repositories, logs and conversation histories.

Receipts store SHA-256 hashes of sanitized state, not raw state, and closed-set validated outputs. Error messages, extra provider fields and secrets are not stored. Fingerprints include project, task, schema and sanitized input hash. Identifiers must be bounded opaque non-sensitive IDs. Hashes are fingerprints, not encryption; do not supply sensitive identifiers or rely on hashes to conceal low-entropy data.

Disabled, deterministic, unsupported, oversized, unsafe, timeout, provider, malformed and open-circuit cases return safe observation statuses. Sink failures produce `evidenceRecorded=false`. A timeout aborts HTTP requests even if a mocked adapter ignores cancellation; adapters and sinks must honor cancellation/lifetime responsibilities where applicable. Observation adds at most the provider and sink waits plus bounded synchronous work; it never writes task state. Future integration should avoid blocking ECHO execution on optional telemetry.

## Verified Jev API contract

Official sources checked 2026-10-06: [HTTP API](https://docs.typesafe.ai/api), [models](https://docs.typesafe.ai/models), [question batching](https://docs.typesafe.ai/introduction), and [SDK retry policy](https://docs.typesafe.ai/sdk/javascript/api/interfaces/RetryPolicy).

Verified: HTTPS origin `api.typesafe.ai`, POST `/v1/systemone`, Bearer authentication; JSON `state`, `model`, named `questions`; `choice`, `score`, `noul` primitives; named `answers`, response model version, probabilities/confidence and input/output token usage. Multiple questions can share state. This module sends a single fixed Choice question per observation. It validates all allowed probabilities, their sum and selected highest-probability option. HTTP response bodies are capped at 64 KB.

Official guidance recommends exponential backoff for 429/529. This shadow adapter intentionally performs one attempt and no automatic retry to bound cost and latency. Provider idempotency support, HTTP timeout prescription, request ID and a response cost field were not documented in the reviewed API reference; no such behavior is fabricated. The decision fingerprint stays local and does not deduplicate repeated calls. Model/version and usage are retained if available; no cost is inferred from marketing pricing. Base URL/model remain explicitly configurable. No live API call was executed.

## Context7 engineering policy

Repository reality → actual dependency/version → resolved Context7 documentation → implementation → tests → review. Policies and verified dependency IDs live in `.echo/context7`. Context7 is for version-sensitive engineering documentation; it is never in the runtime chain and cannot make Founder or authorization decisions. Jev's direct HTTP contract is verified against official TypeSafe documentation.

## Integration scope

Implemented: standalone shadow observation, three closed versioned schemas, deterministic bypass, strict configuration, sanitization/bounds, local fingerprints, typed receipts, safe failures, project-scoped reference circuit breaker and mocked safety tests.

Not implemented: full task engine, production runtime, Founder approval mechanism, databases, queues, durable evidence ledger, LLM escalation, execution routing, batching, remote idempotency, automatic retries, deployment, Slack or paid telemetry. Receipt fields for request IDs/cost/final outcomes are optional future integration data and are not fabricated.

Future ECHO integration should inject its provider/evidence/circuit implementations, supply its authoritative classification and approval requirement, validate project ownership before calling, and retain execution and evidence independently. Do not convert shadow observations into execution commands. Disable completely with `JEV_ENABLED=false` and recreate the gateway using that configuration.
