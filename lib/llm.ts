import { fetchJson } from './service';
import { llmProvider } from './config';

/** Minimal provider-agnostic LLM call (direct HTTPS, no SDK needed). */
export async function llm(system: string, user: string, maxTokens = 700): Promise<string> {
  if (llmProvider() === 'openai') {
    const json = await fetchJson('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    return String(json.choices?.[0]?.message?.content ?? '').trim();
  }

  const json = await fetchJson('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const parts = (json.content ?? []) as { type: string; text?: string }[];
  return parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .join('')
    .trim();
}

/** Pull the first JSON object out of an LLM reply. */
export function extractJson<T = any>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in LLM reply');
  return JSON.parse(text.slice(start, end + 1)) as T;
}
