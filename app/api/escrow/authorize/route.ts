import { liveAuthorizeOrder, mockAuthorizeOrder } from '@/lib/paypal';
import { fail, ok, runService } from '@/lib/service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON');
  }
  const orderId = String(body.orderId || '');
  if (!orderId) return fail('Missing orderId');

  try {
    const r = await runService(
      'paypal',
      req,
      () => liveAuthorizeOrder(orderId),
      mockAuthorizeOrder,
      { forceMock: orderId.startsWith('MOCK-') } // mock orders never hit PayPal
    );
    return ok({ ...r, data: { ...r.data, escrowState: 'LOCKED' as const } });
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Authorization failed', 502);
  }
}
