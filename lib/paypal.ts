import { createHmac, randomBytes } from 'crypto';
import { APP_SECRET, PAYPAL_BASE, mockDelay } from './config';
import { fetchJson } from './service';

const rid = (n = 6) => randomBytes(n).toString('hex').toUpperCase();

// ───────────── LIVE (PayPal REST, sandbox) ─────────────

async function getToken(): Promise<string> {
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const json = await fetchJson(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  return json.access_token as string;
}

async function authed(path: string, body: unknown, requestId: string) {
  const token = await getToken();
  return fetchJson(`${PAYPAL_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId, // idempotency
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
}

export interface OrderResult {
  orderId: string;
  status: string;
  approvalUrl: string | null;
}

/** Orders v2 with intent AUTHORIZE = funds are reserved on the buyer's PayPal (our escrow hold). */
export async function liveCreateOrder(p: {
  contractId: string;
  title: string;
  total: number;
  currency: string;
  origin: string;
}): Promise<OrderResult> {
  const json = await authed(
    '/v2/checkout/orders',
    {
      intent: 'AUTHORIZE',
      purchase_units: [
        {
          reference_id: p.contractId,
          custom_id: p.contractId,
          description: `AgentEscrow: ${p.title}`.slice(0, 120),
          amount: { currency_code: p.currency, value: p.total.toFixed(2) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'AgentEscrow',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            return_url: `${p.origin}/?paypal=return`,
            cancel_url: `${p.origin}/?paypal=cancel`,
          },
        },
      },
    },
    `order-${p.contractId}`
  );
  const links = (json.links ?? []) as { rel: string; href: string }[];
  const approve = links.find((l) => l.rel === 'payer-action' || l.rel === 'approve');
  return { orderId: json.id, status: json.status, approvalUrl: approve?.href ?? null };
}

export interface AuthResult {
  authorizationId: string;
  status: string;
  txHash: string;
}

export async function liveAuthorizeOrder(orderId: string): Promise<AuthResult> {
  const json = await authed(`/v2/checkout/orders/${orderId}/authorize`, {}, `auth-${orderId}`);
  const auth = json.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth?.id) throw new Error(`Authorization missing in response (order status ${json.status})`);
  return { authorizationId: auth.id, status: auth.status, txHash: auth.id };
}

export interface CaptureResult {
  captureId: string;
  status: string;
}

/** Partial capture of the held authorization = releasing one milestone from escrow. */
export async function liveCapture(p: {
  authorizationId: string;
  amount: number;
  currency: string;
  invoiceId: string;
  final: boolean;
}): Promise<CaptureResult> {
  const json = await authed(
    `/v2/payments/authorizations/${p.authorizationId}/capture`,
    {
      amount: { currency_code: p.currency, value: p.amount.toFixed(2) },
      invoice_id: p.invoiceId,
      final_capture: p.final,
      note_to_payer: 'AgentEscrow milestone release',
    },
    `cap-${p.invoiceId}`
  );
  return { captureId: json.id, status: json.status };
}

export interface PayoutResult {
  batchId: string;
  status: string;
}

/** Payouts API: pay the vendor's PayPal account. */
export async function livePayout(p: {
  receiver: string;
  amount: number;
  currency: string;
  note: string;
  itemId: string;
}): Promise<PayoutResult> {
  const json = await authed(
    '/v1/payments/payouts',
    {
      sender_batch_header: {
        sender_batch_id: p.itemId,
        email_subject: 'AgentEscrow milestone payout',
        email_message: p.note,
      },
      items: [
        {
          recipient_type: 'EMAIL',
          receiver: p.receiver,
          amount: { value: p.amount.toFixed(2), currency: p.currency },
          note: p.note,
          sender_item_id: p.itemId,
        },
      ],
    },
    `payout-${p.itemId}`
  );
  return { batchId: json.batch_header?.payout_batch_id, status: json.batch_header?.batch_status ?? 'PENDING' };
}

// ───────────── MOCK (same shapes, realistic latency) ─────────────

export async function mockCreateOrder(): Promise<OrderResult> {
  await mockDelay(1000);
  return { orderId: `MOCK-ORDER-${rid()}`, status: 'CREATED', approvalUrl: null };
}

export async function mockAuthorizeOrder(): Promise<AuthResult> {
  await mockDelay(1200);
  return {
    authorizationId: `MOCK-AUTH-${rid()}`,
    status: 'CREATED',
    txHash: '0x' + randomBytes(32).toString('hex'),
  };
}

export async function mockCapture(): Promise<CaptureResult> {
  await mockDelay(800);
  return { captureId: `MOCK-CAP-${rid()}`, status: 'COMPLETED' };
}

export async function mockPayout(): Promise<PayoutResult> {
  await mockDelay(1000);
  return { batchId: `MOCK-PAYOUT-${rid()}`, status: 'SUCCESS' };
}

// ───────────── Verification proofs (stateless anti-tamper) ─────────────

export function signProof(contractId: string, milestoneId: string, amount: number) {
  return createHmac('sha256', APP_SECRET).update(`${contractId}|${milestoneId}|${amount.toFixed(2)}|PASSED`).digest('hex');
}

export function checkProof(proof: string | undefined, contractId: string, milestoneId: string, amount: number) {
  return Boolean(proof) && proof === signProof(contractId, milestoneId, amount);
}
