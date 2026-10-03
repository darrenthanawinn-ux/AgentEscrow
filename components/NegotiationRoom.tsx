'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/lib/types';

const PRESETS = [
  'Build a React dashboard for $500',
  'Write a REST API with auth and docs for $1200',
  'Design a landing page and brand kit for $800',
];

const ROLE_STYLE = {
  buyer: { name: 'Buyer Agent', badge: 'bg-sky-400/15 text-sky-300 border-sky-400/30', side: 'items-start', bubble: 'border-sky-400/20 bg-sky-400/5' },
  vendor: { name: 'Vendor Agent', badge: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30', side: 'items-end', bubble: 'border-emerald-400/20 bg-emerald-400/5' },
  system: { name: 'System', badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30', side: 'items-center', bubble: 'border-edge bg-white/5' },
} as const;

export default function NegotiationRoom({
  messages,
  busy,
  negotiating,
  locked,
  onStart,
}: {
  messages: ChatMessage[];
  busy: boolean;
  negotiating: boolean;
  locked: boolean;
  onStart: (brief: string) => void;
}) {
  const [brief, setBrief] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, negotiating]);

  const submit = () => {
    const b = brief.trim();
    if (!b || busy) return;
    onStart(b);
    setBrief('');
  };

  return (
    <section className="card flex h-full min-h-[560px] flex-col">
      <div className="flex items-center justify-between border-b border-edge px-4 py-3">
        <div>
          <div className="label">Agent Negotiation Room</div>
          <div className="text-xs text-slate-500">Buyer Agent ⇄ Vendor Agent</div>
        </div>
        {negotiating && (
          <span className="flex items-center gap-2 text-xs text-amber-300">
            <span className="h-2 w-2 animate-ping rounded-full bg-amber-300" /> negotiating
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="text-4xl">🤝</div>
            <p className="max-w-xs text-sm text-slate-400">
              Describe a project and a budget. Two AI agents will negotiate scope, split it into milestones and draft a
              contract.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {PRESETS.map((p) => (
                <button key={p} onClick={() => setBrief(p)} className="rounded-full border border-edge bg-white/5 px-3 py-1 text-xs text-slate-300 hover:border-cyan-400/50">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const s = ROLE_STYLE[m.role];
          return (
            <div key={m.id} className={`flex animate-fadeUp flex-col gap-1 ${s.side}`}>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${s.badge}`}>{s.name}</span>
              <div className={`max-w-[88%] rounded-xl border px-3 py-2 text-sm leading-relaxed text-slate-200 ${s.bubble}`}>{m.content}</div>
            </div>
          );
        })}

        {negotiating && (
          <div className="flex gap-1 pl-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-edge p-3">
        <div className="flex gap-2">
          <input
            className="input"
            placeholder={locked ? 'Contract is live. Reset to start a new project.' : 'e.g. Build a React dashboard for $500'}
            value={brief}
            disabled={busy || locked}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button className="btn-primary" disabled={busy || locked || !brief.trim()} onClick={submit}>
            Negotiate
          </button>
        </div>
      </div>
    </section>
  );
}
