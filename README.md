# AgentEscrow

Autonomous B2B micro-contracting + escrow. A **Buyer Agent** and a **Vendor Agent** negotiate a project, split it into milestones and emit a JSON contract. Funds are locked via **PayPal** (Orders v2, `intent: AUTHORIZE`). When the vendor submits a deliverable, an **AI Evaluator** verifies it and the milestone is released automatically (authorization capture + Payouts API).

Everything external (PayPal + LLM) has a **Mock Mode** so the full flow works offline, with no keys, and survives sandbox latency spikes.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000  (mock mode is ON by default in dev)
```

Click a preset (or type "Build a React dashboard for $500") → **Negotiate** → **Lock Funds with PayPal** → **Fill demo deliverable** → **Submit for verification**.

## Mock / Live switch

`lib/config.ts`:

```ts
export const USE_MOCK_SERVICES =
  process.env.NODE_ENV === 'development' || process.env.ENABLE_MOCK === 'true';
```

Resolution order per request (`lib/service.ts`):

1. UI toggle in the header (`auto | mock | live`) sent as the `x-service-mode` header
2. Otherwise `USE_MOCK_SERVICES`
3. Live requested but no credentials → mock automatically
4. Live call fails or times out (`SERVICE_TIMEOUT_MS`) and `ALLOW_MOCK_FALLBACK` is not `false` → **automatic mock fallback**, flagged in the event log

Mock services add realistic delays (`await new Promise(r => setTimeout(r, 1000))`) and return the same shapes as PayPal: order, authorization (with fake tx hash, escrow state `LOCKED`), capture and payout batch `SUCCESS`.

## Going live (PayPal sandbox)

```bash
cp .env.example .env.local
# fill PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (sandbox REST app) and ANTHROPIC_API_KEY or OPENAI_API_KEY
# remove ENABLE_MOCK=true, run `npm run build && npm start` (or toggle "live" in the header during dev)
```

Live flow:

1. `POST /api/escrow/create` → Orders v2 `AUTHORIZE`, returns the PayPal approval URL; the UI redirects the buyer there (state is kept in localStorage).
2. PayPal returns to `/?paypal=return`; the UI calls `POST /api/escrow/authorize` → authorization id = escrow hold.
3. On a passing evaluation, `POST /api/payout` does a **partial capture** of the authorization for that milestone, then **Payouts API** to the vendor's PayPal email.

Notes:
- PayPal authorizations have a limited honor period (about 3 days) and validity (29 days). Fine for a demo; for production re-authorize or capture up front into a ledger.
- Payouts requires the Payouts feature enabled on the sandbox business account and funds in its sandbox balance.
- The vendor email must be a sandbox personal account to see money arrive.

## Security touches

- `/api/verify` issues an HMAC `proof` bound to `contractId | milestoneId | amount`; `/api/payout` refuses to move money without it (`APP_SECRET`).
- Deliverables are treated as untrusted data in the evaluator prompt.
- Idempotency via `PayPal-Request-Id`.
- The contract/escrow state lives in the browser for the demo. For production persist it server-side (DB) and re-derive amounts from it instead of trusting client JSON.

## Structure

```
app/
  page.tsx, layout.tsx, globals.css
  api/
    config/route.ts            mode + credential status
    negotiate/route.ts         agent turns + contract finalization
    escrow/create/route.ts     PayPal order (AUTHORIZE) or mock
    escrow/authorize/route.ts  authorize approved order -> LOCKED
    verify/route.ts            AI Evaluator (+ signed proof)
    payout/route.ts            capture + Payouts API or mock receipt
components/
  Dashboard.tsx                state machine / orchestration
  Header, NegotiationRoom, ContractCard, EscrowPanel, MilestoneBoard, EventLog, StatusBadge
lib/
  config.ts                    USE_MOCK_SERVICES + env helpers
  service.ts                   runService(): mock/live/fallback, fetchJson w/ timeout
  paypal.ts                    live PayPal REST + mock equivalents + proof signing
  llm.ts                       Anthropic / OpenAI over fetch
  negotiation.ts               mock agents, contract normalizer, mock evaluator
  types.ts, client.ts
```

## Demo script (2 minutes)

1. Show header: **MOCK SERVICES** badge, flip to **live** to show the credential guard.
2. Negotiate "Build a React dashboard for $500" → watch the agents agree and the contract JSON appear.
3. Lock funds → state **ESCROW LOCKED** with tx hash.
4. Submit a thin deliverable ("done") → **REJECTED**; then submit the demo deliverable → **VERIFIED → PAID**.
5. Repeat for all milestones → **PAID OUT**; point at the event log showing mock/live per step.
