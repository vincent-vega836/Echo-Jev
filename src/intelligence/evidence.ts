import type { DecisionReceipt } from './types.js';
export interface EvidenceSink { record(receipt: Readonly<DecisionReceipt>): void | Promise<void> }
export class InMemoryEvidenceSink implements EvidenceSink {
  private readonly entries: DecisionReceipt[] = [];
  constructor(private readonly capacity = 1000) { if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('invalid_capacity'); }
  record(receipt: Readonly<DecisionReceipt>): void { if (this.entries.length >= this.capacity) this.entries.shift(); this.entries.push(structuredClone(receipt)); }
  get receipts(): readonly DecisionReceipt[] { return structuredClone(this.entries); }
}
export interface ShadowCircuitBreaker { isOpen(projectId: string): boolean; success(projectId: string): void; failure(projectId: string, kind: string): void }
export class InMemoryCircuitBreaker implements ShadowCircuitBreaker {
  private readonly states = new Map<string, { kind: string; count: number }>();
  isOpen(projectId: string): boolean { return (this.states.get(projectId)?.count ?? 0) >= 3; }
  success(projectId: string): void { this.states.delete(projectId); }
  failure(projectId: string, kind: string): void {
    const prior = this.states.get(projectId);
    this.states.set(projectId, { kind, count: prior?.kind === kind ? Math.min(prior.count + 1, 3) : 1 });
  }
  reset(projectId: string): void { this.states.delete(projectId); }
}
