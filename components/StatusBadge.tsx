import type { MilestoneStatus } from '@/lib/types';

export type Stage = 'NEGOTIATING' | 'CONTRACT READY' | 'ESCROW LOCKED' | 'VERIFIED' | 'PAID OUT' | 'IDLE';

const STAGE_STYLE: Record<string, string> = {
  IDLE: 'border-slate-700 text-slate-400 bg-slate-800/40',
  NEGOTIATING: 'border-amber-400/40 text-amber-300 bg-amber-400/10',
  'CONTRACT READY': 'border-sky-400/40 text-sky-300 bg-sky-400/10',
  'ESCROW LOCKED': 'border-cyan-400/40 text-cyan-300 bg-cyan-400/10',
  VERIFIED: 'border-violet-400/40 text-violet-300 bg-violet-400/10',
  'PAID OUT': 'border-emerald-400/40 text-emerald-300 bg-emerald-400/10',
  PENDING: 'border-slate-600 text-slate-400 bg-slate-800/40',
  SUBMITTED: 'border-amber-400/40 text-amber-300 bg-amber-400/10',
  REJECTED: 'border-rose-400/40 text-rose-300 bg-rose-400/10',
  PAID: 'border-emerald-400/40 text-emerald-300 bg-emerald-400/10',
};

export default function StatusBadge({ value, pulse }: { value: Stage | MilestoneStatus; pulse?: boolean }) {
  const key = value === 'VERIFIED' ? 'VERIFIED' : value;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
        STAGE_STYLE[key] ?? STAGE_STYLE.IDLE
      } ${pulse ? 'animate-pulseGlow' : ''}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value}
    </span>
  );
}
