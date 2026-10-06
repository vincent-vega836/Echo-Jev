You are implementing the first production-grade intelligence gateway module for ECHO.

REPOSITORY:
vincent-vega836/Echo-Jev

OWNER:
Founder

PRIORITY:
P0

OBJECTIVE:
Build a minimal, secure, testable Jev Shadow Decision Gateway plus Context7 engineering/documentation policy.

IMPORTANT:
This repository may currently contain only README.md or very little code.

FIRST inspect the actual repository.
Do not assume infrastructure that does not exist.
Do not invent an ECHO task engine, evidence ledger, telemetry platform, queue, database, agent runtime, deployment system, Slack architecture, or production environment.

If infrastructure is absent, build this repository as a small standalone library/module that can later be integrated into the real ECHO runtime through explicit interfaces.

==================================================
0. NON-NEGOTIABLE ECHO RULES
==================================================

Preserve these principles:

- LEAN architecture
- Founder Approval authority
- fail-closed security
- strict agent authority boundaries
- project isolation
- evidence before DONE
- minimum context
- minimum model cost
- no unnecessary infrastructure
- no unnecessary paid services
- no broad refactors
- no hidden authority escalation
- deterministic logic before probabilistic logic

Jev and Context7 MUST NOT bypass Founder authority.

Core rule:

Context7 does not make runtime decisions.
Jev does not determine technical truth.
Neither can grant authority.

==================================================
1. TARGET ARCHITECTURE
==================================================

Separate two responsibilities.

A) RUNTIME DECISION PATH

Deterministic
→ Jev Shadow observation
→ existing/authoritative ECHO decision
→ later cheap LLM/frontier escalation if real ECHO runtime requires it
→ Founder Approval when required

In this repository Jev is SHADOW ONLY.

Jev must NEVER change the authoritative result.

B) ENGINEERING KNOWLEDGE PATH

Repository reality
→ installed dependency/version
→ Context7 current documentation
→ implementation
→ tests
→ review

Do NOT put Context7 in the runtime decision chain.

==================================================
2. REQUIRED REPOSITORY STRUCTURE
==================================================

Inspect the repo first.

If no incompatible existing structure exists, implement approximately:

README.md
AGENTS.md
package.json
tsconfig.json
.env.example

src/
  intelligence/
    decision-gateway.ts
    jev-client.ts
    schemas.ts
    evidence.ts
    security.ts
    types.ts
    index.ts

tests/
  decision-gateway.test.ts

.echo/
  context7/
    policy.md
    query-rules.md
    registry.json

Do not mechanically create this structure if the repository already has a better compatible structure.

Adapt to repository reality.

==================================================
3. LANGUAGE / TOOLCHAIN
==================================================

Prefer:

- TypeScript
- Node.js current LTS-compatible APIs
- strict TypeScript
- Vitest for tests
- native fetch where possible

Avoid adding unnecessary dependencies.

Every dependency must have a clear reason.

Use Context7 for version-sensitive documentation before using third-party APIs/packages.

==================================================
4. CONTEXT7 POLICY
==================================================

Context7 is an engineering documentation gate.

Use it for:

- external SDK/API syntax
- library/framework configuration
- migrations
- version-specific behavior
- CLI commands
- package-specific debugging

Do NOT use Context7 for:

- ECHO business logic
- Founder decisions
- generic programming knowledge
- trivial refactoring
- authorization
- runtime routing

Workflow:

1. Inspect package/dependency actually used.
2. Determine installed/requested version.
3. Resolve official/high-reputation Context7 library ID.
4. Query only the specific technical question required.
5. Prefer atomic, single-concept queries.
6. Never send secrets, tokens, credentials, .env content, customer data, or sensitive raw context.
7. Record verified library IDs in:

.echo/context7/registry.json

Do NOT pre-populate fake dependencies.

Only add entries for dependencies actually used by this repository.

Create:

.echo/context7/policy.md
.echo/context7/query-rules.md

Make these concise and operational.

==================================================
5. JEV MODE
==================================================

Jev starts strictly in SHADOW MODE.

Default environment:

JEV_ENABLED=false
JEV_MODE=shadow

Also support:

JEV_API_KEY=
JEV_BASE_URL=
JEV_MODEL=
JEV_TIMEOUT_MS=
JEV_MAX_STATE_BYTES=

Do not put real secrets in the repository.

.env.example must contain placeholders only.

==================================================
6. VERIFY JEV API BEFORE IMPLEMENTATION
==================================================

DO NOT assume an endpoint, request schema, model name, retry policy, or response schema from memory.

Before implementing the HTTP adapter:

- inspect the current official Jev documentation
- verify:
  - API base URL
  - authentication format
  - request format
  - response format
  - supported question types
  - batching support
  - idempotency support
  - timeout/retry guidance
  - model/version fields
  - usage/cost fields if available

If documentation is unclear or unavailable:

do NOT fabricate the API.

Instead create a clean JevClient interface and a provider adapter boundary, with the concrete HTTP adapter implemented only for fields verified from official documentation.

Tests must mock the provider.

No paid API call is required to complete tests.

==================================================
7. INITIAL DECISION TYPES
==================================================

Support only these three decision types:

1. task_routing
2. context_relevance
3. escalation

Do not add more decision types.

Each decision schema must be explicitly versioned.

Example concept:

task_routing.v1
context_relevance.v1
escalation.v1

Schemas should be bounded and machine-checkable.

Avoid open-ended free-form Jev reasoning.

==================================================
8. SHADOW-ONLY GUARANTEE
==================================================

The gateway API must make it structurally difficult for Jev to modify execution.

The authoritative ECHO decision must be provided independently.

Preferred shape conceptually:

observe({
  task,
  authoritativeDecision,
  shadowRequest,
  risk,
  ...
})

The return value may contain:

- observation metadata
- Jev output
- agreement/disagreement
- evidence receipt
- diagnostic information

But the gateway MUST NOT return a replacement authoritative decision.

There must be no method such as:

applyJevDecision()
authorizeFromJev()
routeFromJev()

during Phase 1.

==================================================
9. DETERMINISTIC BYPASS
==================================================

Jev must not be called when deterministic logic already resolves the question.

Examples:

- static rule
- known config
- exact lookup
- grep/search result
- test/assertion
- explicit policy
- Founder decision

Expose this behavior in the gateway API.

Record that Jev was bypassed.

==================================================
10. HARD SAFETY BOUNDARIES
==================================================

Jev must NEVER authorize or perform:

- production deploy
- release
- publish
- destructive operations
- deletion
- migration approval
- credentials changes
- secrets access
- permission changes
- GitHub destructive/material remote writes
- financial commitments
- security approval
- Founder Approval
- final external research truth
- high-risk architecture decisions
- DONE status without deterministic evidence

For HIGH or CRITICAL risk decisions:

Jev is advisory evidence only.

Founder Approval remains authoritative.

==================================================
11. SECURITY
==================================================

Implement:

src/intelligence/security.ts

Minimum functionality:

- redact likely secrets before provider calls
- reject or sanitize dangerous key names:
  apiKey
  api_key
  token
  password
  secret
  authorization
  cookie
  privateKey
  accessToken
  refreshToken

Also catch common secret string patterns when practical.

Do not persist raw sensitive state in evidence receipts.

Prefer hashes.

Use SHA-256 through Node crypto.

==================================================
12. LEAN CONTEXT
==================================================

Do not send:

- entire repositories
- full logs
- full knowledge stores
- arbitrary conversation history
- secrets
- unrelated files

Implement a configurable maximum state size.

Default reasonable value:

16 KB

If sanitized state exceeds the configured limit:

do not call Jev.

Return a safe shadow skip result.

==================================================
13. IDEMPOTENCY
==================================================

Where the provider supports idempotency, use it.

Derive the key from stable bounded inputs such as:

task_id
decision_type
schema_version
input_hash

Conceptually:

echo:{hash(task_id + decision_type + schema_version + input_hash)}

Never include raw secrets in the idempotency key.

If official Jev API does not support idempotency:

still calculate and persist a local decision fingerprint.

Do not fabricate provider behavior.

==================================================
14. EVIDENCE RECEIPT
==================================================

Create a strongly typed DecisionReceipt.

Minimum fields:

task_id
project_id
decision_type
schema_version
input_hash
provider
model
provider_version if available
decision_schema_hash
policy_version
output
confidence_or_probability if available
authoritative_echo_decision
agreement
disagreement
escalated
risk_level
shadow_only
provider_request_id if available
latency_ms
usage if available
cost if available
timestamp
final_outcome if later known

Do NOT persist raw sensitive input.

Create a simple EvidenceSink interface.

Because this repo currently may not have a real ECHO evidence ledger:

- create an interface
- create a safe in-memory/test implementation if needed
- do NOT invent a database

==================================================
15. FAILURE BEHAVIOR
==================================================

Jev failure must NEVER break the authoritative ECHO task.

Handle:

- disabled feature
- timeout
- network error
- malformed response
- provider error
- unsupported schema
- oversized context
- sanitization failure
- evidence sink failure

Behavior:

existing/authoritative ECHO path continues.

Shadow observation records failure when safely possible.

Telemetry/evidence failure must not corrupt task state.

==================================================
16. CIRCUIT BREAKER
==================================================

Provide a small interface compatible with ECHO's future circuit breaker.

If no real circuit breaker exists in this repo:

implement only a minimal in-memory/reference implementation suitable for tests.

Policy:

3 materially similar provider failures may open the shadow circuit.

Do not create Redis, queues, cloud workers, or recurring infrastructure.

==================================================
17. CONFIDENCE FIREWALL
==================================================

Confidence is NOT truth.

Do not hard-code a universal operational threshold such as:

0.90 = approve

Forbidden.

Any threshold in Phase 1 is allowed only for:

offline measurement
metrics
calibration analysis

It must not affect execution.

==================================================
18. REQUIRED TESTS
==================================================

Implement at least these 12 tests:

1. deterministic bypass prevents Jev call

2. successful Jev result is recorded but cannot change authoritative execution

3. timeout falls back safely

4. malformed Jev response falls back safely

5. low confidence is never treated as truth

6. high-risk task is never authorized by Jev

7. Founder Approval cannot be bypassed

8. retry/idempotency behavior is safe

9. secrets/raw sensitive context are not persisted

10. context relevance result cannot delete required authoritative evidence

11. evidence/telemetry failure does not corrupt task state

12. feature flag disables Jev and restores baseline behavior

Add additional tests only if materially valuable.

Do not inflate test count for appearance.

==================================================
19. README
==================================================

Rewrite README.md professionally.

It must explain:

- what Echo-Jev is
- Jev Shadow Mode
- Context7 role
- deterministic-first architecture
- security boundaries
- environment variables
- how to run tests
- what is implemented
- what is intentionally NOT implemented
- how future ECHO integration should happen

Explicitly say:

This repository is not yet the full ECHO runtime.

It provides the bounded intelligence gateway module intended for later integration.

==================================================
20. AGENTS.md
==================================================

Create AGENTS.md with repository-level rules for Codex/agents.

Include:

- inspect before edit
- deterministic first
- Context7 for version-sensitive external dependencies
- never invent provider APIs
- no secrets
- no unnecessary dependencies
- Jev shadow-only
- Founder authority cannot be bypassed
- tests required before claiming completion
- no broad refactor
- no infrastructure invention
- proof-of-work required

==================================================
21. PACKAGE QUALITY
==================================================

Configure:

- strict TypeScript
- build script
- test script
- typecheck script

Example desired commands:

npm test
npm run typecheck
npm run build

Do not add linting/formatting frameworks unless already present or clearly necessary.

==================================================
22. IMPLEMENTATION QUALITY
==================================================

Code must be:

- readable
- typed
- modular
- small
- dependency-light
- testable
- fail-safe

Avoid:

- giant god classes
- excessive abstractions
- speculative interfaces
- premature microservices
- databases
- queues
- workers
- paid telemetry
- unnecessary Docker setup

==================================================
23. NO FAKE COMPLETION
==================================================

Do not say DONE unless:

- files exist
- code compiles
- typecheck passes
- tests pass

If anything cannot be verified, report it.

==================================================
24. EXECUTION ORDER
==================================================

Execute in this order:

1. Inspect repository.
2. Read README and existing config.
3. Identify repository reality.
4. Verify current Context7 guidance for external packages used.
5. Verify official Jev API contract.
6. Design minimal interfaces.
7. Implement types/security/evidence.
8. Implement Jev client boundary.
9. Implement decision gateway.
10. Implement three schemas.
11. Implement configuration.
12. Add tests.
13. Run typecheck.
14. Run tests.
15. Run build.
16. Review git diff for unnecessary changes.
17. Fix failures.
18. Produce proof-of-work report.

==================================================
25. FINAL REPORT FORMAT
==================================================

At the end respond exactly with these sections:

STATUS
IMPLEMENTED / PARTIAL / NOT IMPLEMENTED

FILES CHANGED
Exact paths.

ARCHITECTURE
Short description of the resulting structure.

JEV API VERIFICATION
Official source used and exactly what was verified.
Mention anything intentionally left configurable.

CONTEXT7
Which library IDs/docs were used and why.

TESTS
Commands executed and exact results.

SHADOW SAFETY
Evidence that Jev cannot alter the authoritative ECHO result.

SECURITY
What is redacted/not persisted.

COST / LATENCY
Real measured data if an API was actually called.
Otherwise state:
NOT MEASURED — no paid provider call was executed.

RISKS / BLOCKERS
Only real remaining issues.

ROLLBACK
How to completely disable Jev.
Must include:
JEV_ENABLED=false

NEXT ACTION
Exactly one recommended next action.

==================================================
26. STOP CONDITION
==================================================

Stop after the minimal Shadow Gateway + tests + Context7 policy are implemented.

Do NOT expand into:

- Slack integration
- Sentry
- Playwright
- Research agents
- deployment automation
- production runtime
- databases
- cloud queues
- agent orchestration

unless they already exist in this repository and are strictly required.

Build the smallest production-quality foundation that proves the architecture correctly.

Start by inspecting the repository now.
