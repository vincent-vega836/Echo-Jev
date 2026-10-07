# Repository rules

- Inspect the actual repository and installed versions before editing.
- Deterministic first: bypass Jev for rules, lookups, searches, tests, policies and Founder decisions.
- Jev is shadow-only; never apply its output or grant authority. Founder authority cannot be bypassed.
- Context7 is an engineering documentation gate, never runtime routing or technical truth from Jev.
- Resolve Context7 IDs and query version-sensitive third-party APIs before use; record actual dependencies only.
- Never invent provider APIs. Verify official contracts; leave unverified capabilities unimplemented.
- No secrets, raw sensitive evidence, unnecessary dependencies, broad refactors or invented infrastructure.
- Keep project isolation and bounded context. No operational confidence thresholds.
- Run typecheck, tests and build before completion; report commands/results as proof of work.
- Keep responses concise. Stop at the minimal standalone gateway.
