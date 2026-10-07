import { describe, expect, it, vi } from 'vitest';
import { DecisionGateway, InMemoryEvidenceSink, InMemoryCircuitBreaker, JevHttpClient, configFromEnv } from '../src/intelligence/index.js';
import type { ObserveInput, GatewayConfig } from '../src/intelligence/index.js';
const input = (): ObserveInput => ({ task: { id: 'task-1', projectId: 'project-1' }, authoritativeDecision: 'deterministic', shadowRequest: { decisionType: 'task_routing', schemaVersion: 'v1', state: { summary: 'A narrow task' } }, risk: 'LOW' });
const answer = (choice = 'specialist', confidence = 0.8) => ({ model: 'jev-1.13.0', output: { type: 'choice', choice, confidence, probabilities: { deterministic: 0.1, specialist: 0.8, founder: 0.1 } } });
function setup(result: unknown = answer(), config: Partial<GatewayConfig> = {}) {
  const call = vi.fn(async () => result); const sink = new InMemoryEvidenceSink();
  return { call, sink, gateway: new DecisionGateway({ observe: call }, sink, { enabled: true, ...config }) };
}
describe('shadow safety', () => {
  it('deterministic bypass prevents provider call', async () => {
    const s = setup(); const i = input(); i.deterministicResolution = 'founder';
    expect((await s.gateway.observe(i)).status).toBe('deterministic_bypass'); expect(s.call).not.toHaveBeenCalled();
  });
  it('records disagreement without changing execution or returning a replacement', async () => {
    const s = setup(); const i = input(); const before = structuredClone(i); const r = await s.gateway.observe(i);
    expect(i).toEqual(before); expect(r.receipt.disagreement).toBe(true); expect(r.receipt.authoritative_echo_decision).toBe('deterministic');
    expect(Object.keys(r).sort()).toEqual(['evidenceRecorded', 'receipt', 'status']); expect(s.sink.receipts).toHaveLength(1);
    expect(Object.getOwnPropertyNames(DecisionGateway.prototype).sort()).toEqual(['constructor', 'observe']);
  });
  it('times out even if provider ignores abort', async () => {
    let signal: AbortSignal | undefined;
    const gateway = new DecisionGateway({ observe: async (_, s) => { signal = s; return new Promise(() => {}); } }, new InMemoryEvidenceSink(), { enabled: true, timeoutMs: 5 });
    expect((await gateway.observe(input())).status).toBe('timeout'); expect(signal?.aborted).toBe(true);
  });
  it('malformed provider data fails safely', async () => {
    const s = setup({ model: 'jev-1.13.0', output: { choice: 'deploy', confidence: Infinity } });
    expect((await s.gateway.observe(input())).status).toBe('malformed_response');
  });
  it('low confidence is recorded without operational thresholds', async () => {
    const s = setup(answer('specialist', 0.01)); const r = await s.gateway.observe(input());
    expect(r.receipt.confidence_or_probability).toBe(0.01); expect(r.receipt.escalated).toBe(false); expect(r.receipt.authoritative_echo_decision).toBe('deterministic');
  });
  it('critical risk remains advisory and cannot authorize deployment', async () => {
    const s = setup(); const i = input(); i.risk = 'CRITICAL'; i.shadowRequest.state = { operation: 'production deploy' };
    const r = await s.gateway.observe(i); expect(r.receipt.founder_approval_required).toBe(true); expect(r.receipt.shadow_only).toBe(true); expect(r).not.toHaveProperty('authorized');
  });
  it('Founder Approval cannot be bypassed by high confidence', async () => {
    const s = setup(answer('specialist', 1)); const i = input(); i.founderApprovalRequired = true;
    const r = await s.gateway.observe(i); expect(r.receipt.founder_approval_required).toBe(true); expect(i.founderApprovalRequired).toBe(true); expect(r).not.toHaveProperty('approval');
  });
  it('does not retry and fingerprints are stable and project isolated', async () => {
    const s = setup(); s.call.mockRejectedValue(new Error('network'));
    const a = await s.gateway.observe(input()); expect(s.call).toHaveBeenCalledTimes(1);
    const b = await s.gateway.observe(input()); expect(a.receipt.decision_fingerprint).toBe(b.receipt.decision_fingerprint);
    const i = input(); i.task.projectId = 'project-2'; const c = await s.gateway.observe(i);
    expect(c.receipt.decision_fingerprint).not.toBe(a.receipt.decision_fingerprint);
  });
  it('redacts nested secrets and persists only hashes of state', async () => {
    const s = setup(); const i = input(); i.shadowRequest.state = { apiKey: 'raw-sensitive', nested: { refreshToken: 'raw-token', note: 'Bearer raw-bearer' } };
    await s.gateway.observe(i); const sent = JSON.stringify(s.call.mock.calls);
    for (const secret of ['raw-sensitive', 'raw-token', 'raw-bearer']) { expect(sent).not.toContain(secret); expect(JSON.stringify(s.sink.receipts)).not.toContain(secret); }
    expect(s.sink.receipts[0]?.input_hash).toMatch(/^[a-f0-9]{64}$/); expect(s.sink.receipts[0]).not.toHaveProperty('state');
  });
  it('irrelevant context cannot delete authoritative evidence', async () => {
    const s = setup({ model: 'jev-1.13.0', output: { type: 'choice', choice: 'irrelevant', confidence: 1, probabilities: { relevant: 0, irrelevant: 1, uncertain: 0 } } });
    const i = input(); i.shadowRequest.decisionType = 'context_relevance'; i.authoritativeDecision = 'relevant';
    const requiredEvidence = Object.freeze(['test-report']); i.shadowRequest.state = { requiredEvidence };
    await s.gateway.observe(i); expect(requiredEvidence).toEqual(['test-report']); expect(i.authoritativeDecision).toBe('relevant');
  });
  it('throwing or stalled evidence sinks cannot corrupt authoritative state', async () => {
    for (const record of [async () => { throw new Error('secret-error'); }, async () => new Promise<void>(() => {})]) {
      const i = input(); const g = new DecisionGateway({ observe: async () => answer() }, { record }, { enabled: true, timeoutMs: 5 });
      const r = await g.observe(i); expect(r.status).toBe('observed'); expect(r.evidenceRecorded).toBe(false); expect(i.authoritativeDecision).toBe('deterministic');
    }
  });
  it('disabled flag restores baseline without inspecting sensitive state', async () => {
    const s = setup(undefined, configFromEnv({ JEV_ENABLED: 'false' })); const i = input(); i.shadowRequest.state = () => 'unsafe';
    expect((await s.gateway.observe(i)).status).toBe('disabled'); expect(s.call).not.toHaveBeenCalled();
  });
  it('oversized sanitized state skips the provider', async () => {
    const s = setup(undefined, { maxStateBytes: 50 }); const i = input(); i.shadowRequest.state = 'x'.repeat(60);
    expect((await s.gateway.observe(i)).status).toBe('oversized_context'); expect(s.call).not.toHaveBeenCalled();
  });
  it('rejects accessors, cycles and unsupported schema without provider calls', async () => {
    const s = setup(); const i = input(); const getter = vi.fn(); i.shadowRequest.state = Object.defineProperty({}, 'value', { get: getter, enumerable: true });
    expect((await s.gateway.observe(i)).status).toBe('sanitization_failure'); expect(getter).not.toHaveBeenCalled();
    const cycle: Record<string, unknown> = {}; cycle.self = cycle; i.shadowRequest.state = cycle;
    expect((await s.gateway.observe(i)).status).toBe('sanitization_failure');
    i.shadowRequest.schemaVersion = 'v2' as 'v1'; expect((await s.gateway.observe(i)).status).toBe('unsupported_schema'); expect(s.call).not.toHaveBeenCalled();
  });
  it('opens after three similar failures and isolates projects', async () => {
    const s = setup(); s.call.mockRejectedValue(new Error('network'));
    for (let n = 0; n < 3; n++) expect((await s.gateway.observe(input())).status).toBe('provider_error');
    expect((await s.gateway.observe(input())).status).toBe('circuit_open'); expect(s.call).toHaveBeenCalledTimes(3);
    const i = input(); i.task.projectId = 'project-2'; expect((await s.gateway.observe(i)).status).toBe('provider_error');
    const circuit = new InMemoryCircuitBreaker(); circuit.failure('p', 'timeout'); circuit.failure('p', 'network'); circuit.failure('p', 'network'); expect(circuit.isOpen('p')).toBe(false);
    circuit.failure('p', 'network'); expect(circuit.isOpen('p')).toBe(true); circuit.reset('p'); expect(circuit.isOpen('p')).toBe(false);
  });
  it('validates escalation schema and strips extra provider fields', async () => {
    const s = setup({ model: 'jev-1.13.0', output: { type: 'choice', choice: 'founder', confidence: 1, probabilities: { none: 0, specialist: 0, founder: 1 }, secret: 'raw' }, usage: { input_tokens: 10, output_tokens: 2, secret: 'raw' } });
    const i = input(); i.shadowRequest.decisionType = 'escalation'; i.authoritativeDecision = 'none';
    const r = await s.gateway.observe(i); expect(r.status).toBe('observed'); expect(r.receipt.escalated).toBe(false); expect(JSON.stringify(r)).not.toContain('raw');
  });
  it('rejects unsafe configuration and invalid distributions', async () => {
    expect(() => configFromEnv({ JEV_MODE: 'active' })).toThrow(); expect(() => configFromEnv({ JEV_ENABLED: '1' })).toThrow(); expect(() => configFromEnv({ JEV_TIMEOUT_MS: '-1' })).toThrow();
    const v = answer(); v.output.probabilities.specialist = 0.1;
    expect((await setup(v).gateway.observe(input())).status).toBe('malformed_response');
  });
  it('provider mutation cannot affect caller inputs or captured authority', async () => {
    const i = input(); const before = structuredClone(i);
    const g = new DecisionGateway({ observe: async r => { (r.state as Record<string, unknown>).summary = 'changed'; return answer(); } }, new InMemoryEvidenceSink(), { enabled: true });
    await g.observe(i); expect(i).toEqual(before);
  });
});
describe('verified HTTP boundary (mock fetch only)', () => {
  it('uses verified endpoint and bearer auth, no retry/idempotency header', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ model: 'jev-1.13.0', answers: { observation: answer().output }, usage: { input_tokens: 1, output_tokens: 1 } })));
    const c = new JevHttpClient({ apiKey: 'test-only', fetch: fetcher });
    const g = new DecisionGateway(c, new InMemoryEvidenceSink(), { enabled: true }); expect((await g.observe(input())).status).toBe('observed');
    expect(fetcher).toHaveBeenCalledWith('https://api.typesafe.ai/v1/systemone', expect.objectContaining({ redirect: 'error', headers: { Authorization: 'Bearer test-only', 'Content-Type': 'application/json' } }));
    const init = (fetcher.mock.calls as unknown as [string, RequestInit][])[0]![1]; const body = JSON.parse(init.body as string);
    expect(body.questions.observation.type).toBe('choice'); expect(body.model).toBe('jev-1.13.0'); expect(body).not.toHaveProperty('fingerprint');
  });
  it('bounds HTTP response and handles provider errors without retries', async () => {
    for (const response of [new Response('denied', { status: 429 }), new Response('not-json'), new Response('x'.repeat(65537))]) {
      const fetcher = vi.fn(async () => response); const c = new JevHttpClient({ apiKey: 'test-only', fetch: fetcher });
      const r = await new DecisionGateway(c, new InMemoryEvidenceSink(), { enabled: true }).observe(input());
      expect(['provider_error', 'malformed_response']).toContain(r.status); expect(fetcher).toHaveBeenCalledTimes(1);
    }
    expect(() => new JevHttpClient({ apiKey: 'x', baseUrl: 'http://example.com' })).toThrow();
  });
});
