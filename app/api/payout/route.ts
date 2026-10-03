import { checkProof, liveCapture, livePayout, mockCapture, mockPayout } from '@/lib/paypal';
import { fail, ok, runService } from '@/lib/service';
import type { PayoutReceipt } from '@/lib/types';

export const dynamic = 'force-dynamic';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON');
  }
  const { contractId, milestone, currency = 'USD', authorizationId, vendorEmail, proof, isFinal } = body;
  if (!contractId || !milestone?.id || !(Number(milestone.amount) > 0)) return fail('Missing milestone');
  if (!authorizationId) return fail('Escrow is not locked: no authorization on file');
  if (!EMAIL.test(String(vendorEmail || ''))) return fail('Valid vendor PayPal email required');
  const amount = Number(milestone.amount);

  // Funds only move if the AI Evaluator signed off on exactly this milestone/amount.
  if (!checkProof(proof, contractId, milestone.id, amount)) return fail('Verification proof invalid. Payout blocked.', 403);

  const itemId = `${contractId}-${milestone.id}`;
  const forceMock = String(authorizationId).startsWith('MOCK-');

  try {
    const r = await runService<PayoutReceipt>(
      'paypal',
      req,
      async () => {
        const cap = await liveCapture({ authorizationId, amount, currency, invoiceId: itemId, final: Boolean(isFinal) });
        const pay = await livePayout({
          receiver: vendorEmail,
          amount,
          currency,
          note: `${milestone.title} (${contractId})`,
          itemId,
        });
        return {
          batchId: pay.batchId,
          captureId: cap.captureId,
          status: pay.status,
          amount,
          currency,
          receiver: vendorEmail,
          mode: 'live' as const,
          ts: Date.now(),
        };
      },
      async () => {
        const cap = await mockCapture();
        const pay = await mockPayout();
        return {
          batchId: pay.batchId,
          captureId: cap.captureId,
          status: pay.status,
          amount,
          currency,
          receiver: vendorEmail,
          mode: 'mock' as const,
          ts: Date.now(),
        };
      },
      { forceMock }
    );
    return ok(r);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Payout failed', 502);
  }
}
