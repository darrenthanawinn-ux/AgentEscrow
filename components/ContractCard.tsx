'use client';

import type { Contract, Escrow } from '@/lib/types';

export const money = (n: number, c = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n);

export default function ContractCard({ contract, escrow }: { contract: Contract | null; escrow: Escrow | null }) {
  if (!contract) {
    return (
      <section className="card p-4">
        <div className="label mb-2">Smart Contract (JSON)</div>
        <p className="text-sm text-slate-500">The contract will appear here once the agents agree on terms.</p>
      </section>
    );
  }
  const paid = contract.milestones.filter((m) => m.status === 'PAID').reduce((a, m) => a + m.amount, 0);
  const pct = Math.round((paid / contract.totalAmount) * 100);
  const json = JSON.stringify(
    {
      id: contract.id,
      title: contract.title,
      currency: contract.currency,
      totalAmount: contract.totalAmount,
      parties: { buyer: contract.buyer.name, vendor: contract.vendor.name },
      milestones: contract.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        amount: m.amount,
        acceptanceCriteria: m.acceptanceCriteria,
      })),
      terms: contract.terms,
    },
    null,
    2
  );

  return (
    <section className="card animate-fadeUp p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="label">Contract {contract.id}</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">{contract.title}</h2>
        </div>
        <div className="text-right">
          <div className="label">Total</div>
          <div className="font-mono text-xl font-bold text-cyan-300">{money(contract.totalAmount, contract.currency)}</div>
        </div>
      </div>

      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[11px] text-slate-500">
          <span>Released from escrow</span>
          <span className="font-mono">{money(paid, contract.currency)} · {pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        {escrow && <div className="mt-1 text-[11px] text-slate-600">Escrow status: {escrow.status.replace('_', ' ')}</div>}
      </div>

      <details className="group rounded-lg border border-edge bg-black/40">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs text-slate-400 hover:text-slate-200">View contract JSON</summary>
        <pre className="max-h-64 overflow-auto px-3 pb-3 font-mono text-[11px] leading-relaxed text-emerald-300/90">{json}</pre>
      </details>
    </section>
  );
}
