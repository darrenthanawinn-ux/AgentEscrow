'use client';

import type { UiMode } from '@/lib/client';
import StatusBadge, { Stage } from './StatusBadge';

const STEPS: Stage[] = ['NEGOTIATING', 'ESCROW LOCKED', 'VERIFIED', 'PAID OUT'];

export interface ServerInfo {
  defaultMock: boolean;
  paypalConfigured: boolean;
  llmConfigured: boolean;
  llmProvider: string;
}

export default function Header({
  stage,
  stepIndex,
  mode,
  setMode,
  info,
  onReset,
}: {
  stage: Stage;
  stepIndex: number;
  mode: UiMode;
  setMode: (m: UiMode) => void;
  info: ServerInfo | null;
  onReset: () => void;
}) {
  const effective = mode === 'auto' ? (info?.defaultMock ? 'mock' : 'live') : mode;
  const liveBlocked = effective === 'live' && info && (!info.paypalConfigured || !info.llmConfigured);

  return (
    <header className="border-b border-edge bg-void/70 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-lg">⛓</div>
          <div>
            <h1 className="text-base font-bold tracking-tight">
              Agent<span className="text-cyan-300">Escrow</span>
            </h1>
            <p className="text-[11px] text-slate-500">Autonomous B2B micro-contracting · PayPal escrow</p>
          </div>
        </div>

        <ol className="hidden items-center gap-1 md:flex">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-1">
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest transition ${
                  i < stepIndex
                    ? 'border-emerald-400/40 text-emerald-300'
                    : i === stepIndex
                      ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-200'
                      : 'border-edge text-slate-600'
                }`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && <span className="text-slate-700">›</span>}
            </li>
          ))}
        </ol>

        <div className="flex items-center gap-3">
          <StatusBadge value={stage} />
          <div className="flex overflow-hidden rounded-lg border border-edge text-[11px] font-bold uppercase tracking-wider">
            {(['auto', 'mock', 'live'] as UiMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1.5 transition ${mode === m ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:bg-white/5'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <span
            className={`rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${
              effective === 'mock' ? 'border-amber-400/40 text-amber-300' : 'border-emerald-400/40 text-emerald-300'
            }`}
            title={liveBlocked ? 'Missing credentials: will fall back to mock' : ''}
          >
            {effective === 'mock' ? 'Mock services' : liveBlocked ? 'Live (no keys → mock)' : 'Live sandbox'}
          </span>
          <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}
