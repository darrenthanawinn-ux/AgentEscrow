'use client';

import type { Contract, Escrow } from '@/lib/types';
import { money } from './ContractCard';

export default function EscrowPanel({
  contract,
  escrow,
  vendorEmail,
  setVendorEmail,
  busy,
  onLock,
}: {
  contract: Contract | null;
  escrow: Escrow | null;
  vendorEmail: string;
  setVendorEmail: (v: string) => void;
  busy: boolean;
  onLock: () => void;
}) {
  const locked = escrow && escrow.status !== 'CREATED';
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendorEmail);

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="label">PayPal Escrow</div>
        {escrow && (
          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${escrow.mode === 'mock' ? 'border-amber-400/40 text-amber-300' : 'border-emerald-400/40 text-emerald-300'}`}>
            {escrow.mode}
          </span>
        )}
      </div>

      {!contract && <p className="text-sm text-slate-500">Waiting for a signed contract.</p>}

      {contract && !locked && (
        <div className="space-y-3">
          <div>
            <label className="label mb-1 block">Vendor PayPal email (payout receiver)</label>
            <input className="input" type="email" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} placeholder="vendor-sandbox@personal.example.com" />
            <p className="mt-1 text-[11px] text-slate-600">Live mode: use a PayPal sandbox personal account email.</p>
          </div>
          <button className="btn-primary w-full" disabled={busy || !emailOk} onClick={onLock}>
            🔒 Lock Funds with PayPal · {money(contract.totalAmount, contract.currency)}
          </button>
        </div>
      )}

      {locked && escrow && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <dt className="text-slate-500">State</dt>
          <dd className="text-right font-semibold text-cyan-300">{escrow.status.replace('_', ' ')}</dd>
          <dt className="text-slate-500">Held</dt>
          <dd className="text-right font-mono">{money(escrow.total - escrow.released, escrow.currency)}</dd>
          <dt className="text-slate-500">Released</dt>
          <dd className="text-right font-mono text-emerald-300">{money(escrow.released, escrow.currency)}</dd>
          <dt className="text-slate-500">Order</dt>
          <dd className="truncate text-right font-mono text-slate-300" title={escrow.orderId}>{escrow.orderId}</dd>
          <dt className="text-slate-500">Authorization</dt>
          <dd className="truncate text-right font-mono text-slate-300" title={escrow.authorizationId}>{escrow.authorizationId}</dd>
          <dt className="text-slate-500">Tx hash</dt>
          <dd className="truncate text-right font-mono text-slate-400" title={escrow.txHash}>{escrow.txHash}</dd>
        </dl>
      )}
    </section>
  );
}
