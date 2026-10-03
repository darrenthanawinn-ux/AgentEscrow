import { mockDelay } from '@/lib/config';
import { extractJson, llm } from '@/lib/llm';
import { mockContract, mockTurn, normalizeContract } from '@/lib/negotiation';
import { fail, ok, runService } from '@/lib/service';
import type { Contract, TranscriptEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

const BUYER_SYS = `You are the BUYER AGENT in a B2B micro-contracting negotiation. You represent the client.
Goals: get the project done within budget, insist on staged milestones, clear acceptance criteria, and escrow-protected payment.
Reply in at most 70 words, in first person, no markdown. Never exceed the stated budget.`;

const VENDOR_SYS = `You are the VENDOR AGENT in a B2B micro-contracting negotiation. You represent the freelancer/service provider.
Goals: fair price, realistic scope, milestone-based payouts released automatically when work is verified, funds locked in escrow before work starts.
Reply in at most 70 words, in first person, no markdown. Stay within the buyer's stated budget.`;

const CONTRACT_SYS = `You convert a negotiation into a contract. Output ONLY a JSON object, no prose, with this schema:
{"title": string, "milestones": [{"title": string, "description": string, "amount": number, "acceptanceCriteria": [string]}], "terms": [string]}
Rules: 2 to 5 milestones; amounts must sum EXACTLY to the total budget; each milestone has 2 to 4 objectively checkable acceptance criteria.`;

const fmt = (t: TranscriptEntry[]) =>
  t.length ? t.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n') : '(no messages yet)';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON');
  }
  const brief = String(body.brief || '').trim();
  if (!brief) return fail('Missing brief');
  const transcript: TranscriptEntry[] = Array.isArray(body.transcript) ? body.transcript : [];

  if (body.action === 'turn') {
    const index = Number(body.index) || 0;
    const role = index % 2 === 0 ? 'buyer' : 'vendor';
    try {
      const r = await runService<string>(
        'llm',
        req,
        () =>
          llm(
            role === 'buyer' ? BUYER_SYS : VENDOR_SYS,
            `Project brief from the user: ${brief}\n\nNegotiation so far:\n${fmt(transcript)}\n\nWrite your next message now. Turn ${index + 1} of 6${index >= 4 ? ' (wrap up and confirm final terms)' : ''}.`,
            300
          ),
        async () => {
          await mockDelay(900 + Math.random() * 600);
          return mockTurn(index, brief);
        }
      );
      return ok({ ...r, data: { role, content: r.data } });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Negotiation failed', 502);
    }
  }

  if (body.action === 'finalize') {
    try {
      const r = await runService<Contract>(
        'llm',
        req,
        async () => {
          const reply = await llm(
            CONTRACT_SYS,
            `Total budget: ${brief}\n\nProject brief: ${brief}\n\nNegotiation transcript:\n${fmt(transcript)}`,
            1200
          );
          try {
            return normalizeContract(extractJson(reply), brief, transcript);
          } catch {
            return mockContract(brief); // unparsable LLM output: still deliver a valid contract
          }
        },
        async () => {
          await mockDelay(1100);
          return mockContract(brief);
        }
      );
      return ok(r);
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Contract generation failed', 502);
    }
  }

  return fail('Unknown action');
}
