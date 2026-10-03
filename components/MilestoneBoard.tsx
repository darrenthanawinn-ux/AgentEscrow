'use client';

import { useState } from 'react';
import type { Contract, Escrow, Milestone } from '@/lib/types';
import StatusBadge from './StatusBadge';
import { money } from './ContractCard';

function sample(m: Milestone) {
  return `Delivered "${m.title}". ${m.description} Repo: https://github.com/example/agent-escrow-demo/pull/1\nCovers: ${m.acceptanceCriteria.join('; ')}.\n\nfunction summary() { return "milestone complete"; }`;
}

function MilestoneRow({
  m,
  currency,
  active,
  busy,
  onSubmit,
  onRetry,
}: {
  m: Milestone;
  currency: string;
  active: boolean;
  busy: boolean;
  onSubmit: (id: string, text: string) => void;
  onRetry: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const canSubmit = active && (m.status === 'PENDING' || m.status === 'REJECTED');

  return (
    <li className={`rounded-lg border p-3 transition ${active ? 'border-cyan-400/40 bg-cyan-400/[0.03]' : 'border-edge bg-black/20'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-slate-500">{m.id}</span>
            <h3 className="text-sm font-semibold text-slate-100">{m.title}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">{m.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="font-mono text-sm font-bold text-slate-200">{money(m.amount, currency)}</span>
          <StatusBadge value={m.status} pulse={m.status === 'SUBMITTED'} />
        </div>
      </div>

      <ul className="mt-2 space-y-0.5">
        {m.acceptanceCriteria.map((c) => (
          <li key={c} className="flex gap-1.5 text-[11px] text-slate-400">
            <span className={m.status === 'PAID' || m.status === 'VERIFIED' ? 'text-emerald-400' : 'text-slate-600'}>✓</span>
            {c}
          </li>
        ))}
      </ul>

      {m.evaluation && (
        <div className={`mt-2 rounded-md border px-2.5 py-1.5 text-xs ${m.evaluation.passed ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-200' : 'border-rose-400/30 bg-rose-400/5 text-rose-200'}`}>
          <b>AI Evaluator · {m.evaluation.score}/100</b> · {m.evaluation.feedback}
        </div>
      )}

      {m.payout && (
        <div className="mt-2 rounded-md border border-edge bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-slate-400">
          payout {m.payout.batchId} · {m.payout.status} · {m.payout.mode} · → {m.payout.receiver}
        </div>
      )}

      {active && m.status === 'VERIFIED' && (
        <button className="btn-primary mt-3" disabled={busy} onClick={() => onRetry(m.id)}>
          Retry payout
        </button>
      )}

      {canSubmit && (
        <div className="mt-3 space-y-2">
          <textarea
            className="input min-h-[84px] resize-y font-mono text-xs"
            placeholder="Vendor submits deliverable: paste a code snippet, a repo/preview link or a written summary…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy || !text.trim()} onClick={() => onSubmit(m.id, text)}>
              Submit for verification
            </button>
            <button className="btn-ghost" disabled={busy} onClick={() => setText(sample(m))}>
              Fill demo deliverable
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function MilestoneBoard({
  contract,
  escrow,
  busy,
  onSubmit,
  onRetry,
}: {
  contract: Contract | null;
  escrow: Escrow | null;
  busy: boolean;
  onSubmit: (id: string, text: string) => void;
  onRetry: (id: string) => void;
}) {
  const locked = Boolean(escrow && escrow.status !== 'CREATED');
  const nextId = contract?.milestones.find((m) => m.status !== 'PAID')?.id;

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="label">Milestones · Verification &amp; Auto-Payout</div>
        {contract && !locked && <span className="text-[11px] text-amber-300">Lock funds to unlock submissions</span>}
      </div>
      {!contract ? (
        <p className="text-sm text-slate-500">No milestones yet.</p>
      ) : (
        <ul className="space-y-3">
          {contract.milestones.map((m) => (
            <MilestoneRow key={m.id} m={m} currency={contract.currency} active={locked && m.id === nextId} busy={busy} onSubmit={onSubmit} onRetry={onRetry} />
          ))}
        </ul>
      )}
    </section>
  );
}
