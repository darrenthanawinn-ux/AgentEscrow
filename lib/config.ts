// ───────────────────────────────────────────────────────────────
//  Central mock / live switch for AgentEscrow
// ───────────────────────────────────────────────────────────────

/** Master default flag. Per-request UI override (x-service-mode header) can flip it. */
export const USE_MOCK_SERVICES =
  process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK === 'true';

export const ALLOW_MOCK_FALLBACK = process.env.ALLOW_MOCK_FALLBACK !== 'false';
export const SERVICE_TIMEOUT_MS = Number(process.env.SERVICE_TIMEOUT_MS || 12000);
export const PAYPAL_BASE = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
export const APP_SECRET = process.env.APP_SECRET || 'dev-secret-change-me';

export const hasPayPalCreds = () =>
  Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);

export const llmProvider = (): 'anthropic' | 'openai' =>
  process.env.LLM_PROVIDER === 'openai' ? 'openai' : 'anthropic';

export const hasLLMCreds = () =>
  llmProvider() === 'openai'
    ? Boolean(process.env.OPENAI_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);

/** Simulated network latency used by every mock service. */
export const mockDelay = (ms = 1000) => new Promise<void>((r) => setTimeout(r, ms));
