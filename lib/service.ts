import { NextResponse } from 'next/server';
import {
  ALLOW_MOCK_FALLBACK,
  SERVICE_TIMEOUT_MS,
  USE_MOCK_SERVICES,
  hasLLMCreds,
  hasPayPalCreds,
} from './config';
import type { ServiceMode } from './types';

export type ServiceKind = 'paypal' | 'llm';

/** Decide mock vs live for one request. UI toggle (header) > env default. Missing creds => mock. */
export function resolveService(kind: ServiceKind, req: Request): { mock: boolean; note?: string } {
  const header = req.headers.get('x-service-mode');
  const wantMock = header === 'mock' ? true : header === 'live' ? false : USE_MOCK_SERVICES;
  if (wantMock) return { mock: true };
  const hasCreds = kind === 'paypal' ? hasPayPalCreds() : hasLLMCreds();
  if (!hasCreds) return { mock: true, note: `No ${kind.toUpperCase()} credentials configured, using mock` };
  return { mock: false };
}

export interface RunResult<T> {
  data: T;
  mode: ServiceMode;
  note?: string;
}

/**
 * Run a service call with mock fallback.
 * - mock mode  -> runs mock()
 * - live mode  -> runs live(); on failure falls back to mock() when ALLOW_MOCK_FALLBACK
 */
export async function runService<T>(
  kind: ServiceKind,
  req: Request,
  live: () => Promise<T>,
  mock: () => Promise<T>,
  opts: { forceMock?: boolean } = {}
): Promise<RunResult<T>> {
  const resolved = opts.forceMock ? { mock: true, note: 'Mock record, completing in mock mode' } : resolveService(kind, req);
  if (resolved.mock) return { data: await mock(), mode: 'mock', note: resolved.note };
  try {
    return { data: await live(), mode: 'live' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!ALLOW_MOCK_FALLBACK) throw e;
    return { data: await mock(), mode: 'mock', note: `Live ${kind} call failed (${msg}). Fell back to mock.` };
  }
}

export function ok<T>(r: RunResult<T>) {
  return NextResponse.json({ data: r.data, mode: r.mode, note: r.note });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** fetch with timeout + JSON/err handling, used for all live calls. */
export async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = SERVICE_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      const detail = (json as { message?: string; error_description?: string; error?: { message?: string } } | null);
      throw new Error(
        `HTTP ${res.status} ${detail?.message || detail?.error_description || detail?.error?.message || text.slice(0, 200)}`
      );
    }
    return json as Record<string, any>;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error(`timeout after ${timeoutMs}ms`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}
