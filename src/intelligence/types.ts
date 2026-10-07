export type DecisionType = 'task_routing' | 'context_relevance' | 'escalation';
export type Risk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export interface ShadowRequest { decisionType: DecisionType; schemaVersion: 'v1'; state: unknown }
export interface ObserveInput {
  task: { id: string; projectId: string };
  authoritativeDecision: string;
  shadowRequest: ShadowRequest;
  risk: Risk;
  deterministicResolution?: 'static_rule' | 'known_config' | 'exact_lookup' | 'search' | 'test' | 'policy' | 'founder';
  founderApprovalRequired?: boolean;
  authoritativeEscalated?: boolean;
}
export interface ChoiceOutput { type: 'choice'; choice: string; confidence: number; probabilities: Record<string, number> }
export interface ProviderResult { model: string; output: ChoiceOutput; usage?: { input_tokens: number; output_tokens: number } }
export type ObservationStatus = 'observed' | 'disabled' | 'deterministic_bypass' | 'unsupported_schema' | 'invalid_input' | 'sanitization_failure' | 'oversized_context' | 'circuit_open' | 'timeout' | 'provider_error' | 'malformed_response';
export interface DecisionReceipt {
  task_id: string; project_id: string; decision_type: DecisionType | null; schema_version: string;
  input_hash: string | null; decision_fingerprint: string | null;
  provider: 'jev'; model: string | null; provider_version?: string;
  decision_schema_hash: string | null; policy_version: 'shadow.v1';
  output: ChoiceOutput | null; confidence_or_probability: number | null;
  authoritative_echo_decision: string; agreement: boolean | null; disagreement: boolean | null;
  escalated: boolean; risk_level: Risk; shadow_only: true; founder_approval_required: boolean;
  provider_request_id?: string; latency_ms: number; usage?: ProviderResult['usage'];
  cost?: { amount: number; currency: string }; timestamp: string; final_outcome?: string;
  status: ObservationStatus;
}
export interface Observation { readonly status: ObservationStatus; readonly receipt: Readonly<DecisionReceipt>; readonly evidenceRecorded: boolean }
