import { createHash } from 'node:crypto';
export const hash = (text: string): string => createHash('sha256').update(text).digest('hex');
const dangerous = /apikey|token|password|secret|authorization|cookie|privatekey|credential/i;
const patterns = /-----BEGIN [\w ]*PRIVATE KEY-----[\s\S]*?(?:-----END [\w ]*PRIVATE KEY-----|$)|\b(?:sk-|gh[pousr]_|github_pat_)[A-Za-z0-9_-]+|\bAKIA[A-Z0-9]{16}\b|\bBearer\s+\S+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|authorization|cookie|private[_-]?key|token)\s*[:=]\s*[^\s,;]+/gi;
export function redact(text: string): string { return text.replace(patterns, '[REDACTED]'); }
// Only plain JSON data is accepted. Accessors, cycles, deep or huge inputs fail closed.
export function sanitize(input: unknown, maxBytes = 16384): unknown {
  let nodes = 0, bytes = 0;
  const seen = new WeakSet<object>();
  function visit(value: unknown, depth: number): unknown {
    if (++nodes > 10000 || depth > 32) throw new Error('unsafe_state');
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      bytes += Buffer.byteLength(value); if (bytes > maxBytes * 4) throw new Error('unsafe_state');
      return redact(value);
    }
    if (typeof value !== 'object' || value === null || seen.has(value)) throw new Error('unsafe_state');
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new Error('unsafe_state');
    if (Array.isArray(value) && value.length > 10000) throw new Error('unsafe_state');
    seen.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(descriptors).sort()) {
      if (Array.isArray(value) && key === 'length') continue;
      bytes += Buffer.byteLength(key); if (bytes > maxBytes * 4) throw new Error('unsafe_state');
      const descriptor = descriptors[key]!;
      if (!('value' in descriptor)) throw new Error('unsafe_state');
      if (redact(key) !== key) throw new Error('unsafe_state');
      result[key] = dangerous.test(key.replace(/[^a-z]/gi, '')) ? '[REDACTED]' : visit(descriptor.value, depth + 1);
    }
    seen.delete(value);
    return Array.isArray(value) ? Array.from({ length: value.length }, (_, i) => result[String(i)] ?? null) : result;
  }
  return visit(input, 0);
}
export function safeId(value: unknown): value is string { return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value) && redact(value) === value; }
