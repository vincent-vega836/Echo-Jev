import type { ChoiceOutput, DecisionType } from './types.js';
export const schemas = {
  task_routing: { version: 'v1', instructions: 'Which advisory processing path fits this task?', criteria: { deterministic: 'Static processing', specialist: 'Specialist assessment', founder: 'Founder review' } },
  context_relevance: { version: 'v1', instructions: 'How relevant is this candidate context to the task?', criteria: { relevant: 'Directly relevant', irrelevant: 'Unrelated', uncertain: 'Insufficient context' } },
  escalation: { version: 'v1', instructions: 'Which advisory review level fits this task?', criteria: { none: 'No additional review suggested', specialist: 'Specialist review suggested', founder: 'Founder review suggested' } },
} as const;
export function supported(type: unknown, version: unknown): type is DecisionType { return typeof type === 'string' && Object.hasOwn(schemas, type) && version === 'v1'; }
export function parseOutput(value: unknown, type: DecisionType): ChoiceOutput {
  const v = value as Partial<ChoiceOutput> | null;
  const options = Object.keys(schemas[type].criteria);
  const probability = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
  if (!v || v.type !== 'choice' || !options.includes(v.choice ?? '') || !probability(v.confidence) || !v.probabilities || typeof v.probabilities !== 'object') throw new Error('malformed_response');
  if (Object.keys(v.probabilities).length !== options.length || options.some(k => !probability(v.probabilities![k]))) throw new Error('malformed_response');
  const sum = options.reduce((n, k) => n + v.probabilities![k]!, 0);
  if (Math.abs(sum - 1) > 0.0001 || options.some(k => v.probabilities![k]! > v.probabilities![v.choice!]! + 0.0001)) throw new Error('malformed_response');
  return { type: 'choice', choice: v.choice!, confidence: v.confidence, probabilities: Object.fromEntries(options.map(k => [k, v.probabilities![k]!])) };
}
