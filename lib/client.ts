import type { ApiEnvelope, ServiceMode } from './types';

export type UiMode = 'auto' | ServiceMode;

export async function post<T>(path: string, body: unknown, mode: UiMode = 'auto'): Promise<ApiEnvelope<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (mode !== 'auto') headers['x-service-mode'] = mode;
  const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as ApiEnvelope<T>;
}
