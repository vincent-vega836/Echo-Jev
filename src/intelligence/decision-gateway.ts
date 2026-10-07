import { hash, redact, safeId, sanitize } from './security.js';
import { parseOutput, schemas, supported } from './schemas.js';
import { InMemoryCircuitBreaker } from './evidence.js';
import type { EvidenceSink, ShadowCircuitBreaker } from './evidence.js';
import type { GatewayConfig, JevClient } from './jev-client.js';
import type { DecisionReceipt, Observation, ObservationStatus, ObserveInput, ProviderResult } from './types.js';
const defaults: GatewayConfig = { enabled: false, mode: 'shadow', timeoutMs: 2000, maxStateBytes: 16384 };
class ShadowFailure extends Error { constructor(readonly status: ObservationStatus) { super(status); } }
export class DecisionGateway {
  private readonly config: GatewayConfig;
  private readonly circuit: ShadowCircuitBreaker;
  constructor(private readonly client: JevClient, private readonly sink: EvidenceSink, config: Partial<GatewayConfig> = {}, circuit?: ShadowCircuitBreaker) {
    this.config = { ...defaults, ...config }; this.circuit = circuit ?? new InMemoryCircuitBreaker();
    if (this.config.mode !== 'shadow' || typeof this.config.enabled !== 'boolean' || !Number.isSafeInteger(this.config.timeoutMs) || this.config.timeoutMs < 1 || this.config.timeoutMs > 60000 || !Number.isSafeInteger(this.config.maxStateBytes) || this.config.maxStateBytes < 1 || this.config.maxStateBytes > 1048576) throw new Error('invalid_configuration');
  }
  async observe(input: ObserveInput): Promise<Observation> {
    const start = performance.now();
    const receipt: DecisionReceipt = {
      task_id: safeId(input.task.id) ? input.task.id : '[INVALID]', project_id: safeId(input.task.projectId) ? input.task.projectId : '[INVALID]',
      decision_type: supported(input.shadowRequest.decisionType, 'v1') ? input.shadowRequest.decisionType : null,
      schema_version: input.shadowRequest.schemaVersion === 'v1' ? 'v1' : 'unsupported', input_hash: null, decision_fingerprint: null,
      provider: 'jev', model: null, decision_schema_hash: null, policy_version: 'shadow.v1', output: null,
      confidence_or_probability: null, authoritative_echo_decision: '[INVALID]', agreement: null, disagreement: null,
      escalated: input.authoritativeEscalated === true, risk_level: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(input.risk) ? input.risk : 'CRITICAL', shadow_only: true,
      founder_approval_required: input.founderApprovalRequired === true || ['HIGH', 'CRITICAL'].includes(input.risk),
      latency_ms: 0, timestamp: new Date().toISOString(), status: 'invalid_input',
    };
    const finish = async (status: ObservationStatus): Promise<Observation> => {
      receipt.status = status; receipt.latency_ms = Math.max(0, performance.now() - start);
      let evidenceRecorded = false;
      // A broken or stalled sink never holds up the caller indefinitely.
      try { await bounded(() => Promise.resolve(this.sink.record(structuredClone(receipt))), this.config.timeoutMs); evidenceRecorded = true; } catch { /* No raw exception data is persisted. */ }
      return Object.freeze({ status, receipt: Object.freeze(structuredClone(receipt)), evidenceRecorded });
    };
    if (!supported(input.shadowRequest.decisionType, input.shadowRequest.schemaVersion)) return finish('unsupported_schema');
    const type = input.shadowRequest.decisionType, schema = schemas[type];
    receipt.decision_schema_hash = hash(JSON.stringify(schema));
    const authority = input.authoritativeDecision;
    if (!safeId(input.task.id) || !safeId(input.task.projectId) || typeof authority !== 'string' || !Object.hasOwn(schema.criteria, authority) || !['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(input.risk)) return finish('invalid_input');
    receipt.authoritative_echo_decision = authority;
    if (!this.config.enabled) return finish('disabled');
    if (input.deterministicResolution !== undefined) return finish('deterministic_bypass');
    // Capture stable, bounded fields before crossing the untrusted provider boundary.
    const projectId = receipt.project_id;
    let state: unknown, serialized: string;
    try { state = sanitize(input.shadowRequest.state, this.config.maxStateBytes); serialized = JSON.stringify(state); } catch { return finish('sanitization_failure'); }
    if (Buffer.byteLength(serialized) > this.config.maxStateBytes) return finish('oversized_context');
    receipt.input_hash = hash(serialized);
    receipt.decision_fingerprint = `echo:${hash(JSON.stringify([receipt.project_id, receipt.task_id, type, 'v1', receipt.decision_schema_hash, receipt.input_hash]))}`;
    let circuitOpen = true;
    try { circuitOpen = this.circuit.isOpen(projectId); } catch { /* Fail closed for shadow calls. */ }
    if (circuitOpen) return finish('circuit_open');
    const controller = new AbortController();
    let result: ProviderResult;
    try {
      const raw = await bounded(() => this.client.observe({ state, decisionType: type, fingerprint: receipt.decision_fingerprint! }, controller.signal), this.config.timeoutMs, controller);
      try {
        const v = raw as Partial<ProviderResult> | null;
        if (!v || typeof v.model !== 'string' || !/^jev-[a-zA-Z0-9.-]{1,64}$/.test(v.model) || redact(v.model) !== v.model) throw new Error('malformed');
        result = { model: v.model, output: parseOutput(v.output, type) };
        if (v.usage !== undefined) {
          if (!v.usage || !Number.isSafeInteger(v.usage.input_tokens) || v.usage.input_tokens < 0 || !Number.isSafeInteger(v.usage.output_tokens) || v.usage.output_tokens < 0) throw new Error('malformed');
          result.usage = { input_tokens: v.usage.input_tokens, output_tokens: v.usage.output_tokens };
        }
      } catch { throw new ShadowFailure('malformed_response'); }
    } catch (error) {
      const status = error instanceof ShadowFailure ? error.status : error instanceof Error && error.message === 'malformed_response' ? 'malformed_response' : 'provider_error';
      try { this.circuit.failure(projectId, status); } catch { /* Circuit telemetry cannot affect ECHO. */ }
      return finish(status);
    }
    try { this.circuit.success(projectId); } catch { /* Ignore telemetry failures. */ }
    receipt.model = result.model; receipt.provider_version = result.model;
    receipt.output = result.output; receipt.confidence_or_probability = result.output.confidence;
    receipt.agreement = result.output.choice === authority; receipt.disagreement = !receipt.agreement;
    if (result.usage) receipt.usage = result.usage;
    return finish('observed');
  }
}
async function bounded<T>(operation: () => Promise<T>, timeoutMs: number, controller?: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve().then(operation), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { reject(new ShadowFailure('timeout')); controller?.abort(); }, timeoutMs);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
