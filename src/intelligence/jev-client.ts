import { schemas } from './schemas.js';
import type { DecisionType } from './types.js';
export interface JevClient {
  observe(request: { state: unknown; decisionType: DecisionType; fingerprint: string }, signal: AbortSignal): Promise<unknown>;
}
export interface GatewayConfig { enabled: boolean; mode: 'shadow'; timeoutMs: number; maxStateBytes: number }
export function configFromEnv(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const integer = (v: string | undefined, fallback: number, max: number): number => {
    if (v === undefined || v === '') return fallback;
    if (!/^\d+$/.test(v) || !Number.isSafeInteger(Number(v)) || Number(v) < 1 || Number(v) > max) throw new Error('invalid_configuration');
    return Number(v);
  };
  if (env.JEV_MODE && env.JEV_MODE !== 'shadow') throw new Error('shadow_only');
  if (env.JEV_ENABLED && !['true', 'false'].includes(env.JEV_ENABLED)) throw new Error('invalid_configuration');
  return { enabled: env.JEV_ENABLED === 'true', mode: 'shadow', timeoutMs: integer(env.JEV_TIMEOUT_MS, 2000, 60000), maxStateBytes: integer(env.JEV_MAX_STATE_BYTES, 16384, 1048576) };
}
// Official TypeSafe contract, verified 2026-10-06: https://docs.typesafe.ai/api
// No documented idempotency header: fingerprint stays local. No automatic retries.
export class JevHttpClient implements JevClient {
  private readonly endpoint: string;
  constructor(private readonly options: { apiKey: string; baseUrl?: string; model?: string; fetch?: typeof fetch }) {
    const base = new URL(options.baseUrl || 'https://api.typesafe.ai');
    if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('invalid_provider_url');
    if (!options.apiKey || /[\r\n]/.test(options.apiKey)) throw new Error('invalid_api_key');
    if (options.model && !/^jev-[a-zA-Z0-9.-]{1,64}$/.test(options.model)) throw new Error('invalid_model');
    this.endpoint = new URL('/v1/systemone', base).href;
  }
  async observe(request: { state: unknown; decisionType: DecisionType; fingerprint: string }, signal: AbortSignal): Promise<unknown> {
    const schema = schemas[request.decisionType];
    const response = await (this.options.fetch ?? fetch)(this.endpoint, {
      method: 'POST', redirect: 'error', signal,
      headers: { Authorization: `Bearer ${this.options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: request.state, model: this.options.model || 'jev-1.13.0', questions: { observation: { type: 'choice', instructions: schema.instructions, criteria: schema.criteria } } }),
    });
    if (!response.ok) throw new Error(`http_${response.status}`);
    // Bound response memory; the gateway timeout covers streaming and parsing too.
    if (!response.body) throw new Error('malformed_response');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length; if (size > 65536) { await reader.cancel(); throw new Error('malformed_response'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { model?: unknown; answers?: { observation?: unknown }; usage?: unknown };
      return { model: body.model, output: body.answers?.observation, usage: body.usage };
    } catch { throw new Error('malformed_response'); }
  }
}
