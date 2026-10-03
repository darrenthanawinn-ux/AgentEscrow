import { liveCreateOrder, mockCreateOrder } from '@/lib/paypal';
import { fail, ok, runService } from '@/lib/service';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON');
  }
  const c = body.contract;
  if (!c?.id || !(Number(c.totalAmount) > 0)) return fail('Missing or invalid contract');

  const origin = new URL(req.url).origin;
  try {
    const r = await runService(
      'paypal',
      req,
      () =>
        liveCreateOrder({
          contractId: c.id,
          title: c.title,
          total: Number(c.totalAmount),
          currency: c.currency || 'USD',
          origin,
        }),
      mockCreateOrder
    );
    return ok(r);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Order creation failed', 502);
  }
}
