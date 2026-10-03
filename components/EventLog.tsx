'use client';

import type { LogEvent } from '@/lib/types';

const COLOR: Record<LogEvent['kind'], string> = {
  info: 'text-slate-400',
  agent: 'text-sky-300',
  escrow: 'text-cyan-300',
  verify: 'text-violet-300',
  payout: 'text-emerald-300',
  warn: 'text-amber-300',
  error: 'text-rose-300',
};

export default function EventLog({ events }: { events: LogEvent[] }) {
  return (
    <section className="card p-4">
      <div className="label mb-2">System Event Log</div>
      <div className="max-h-56 space-y-1 overflow-y-auto font-mono text-[11px]">
        {events.length === 0 && <div className="text-slate-600">no events</div>}
        {[...events].reverse().map((e) => (
          <div key={e.id} className="flex gap-2">
            <span className="shrink-0 text-slate-600">{new Date(e.ts).toLocaleTimeString([], { hour12: false })}</span>
            {e.mode && <span className={`shrink-0 ${e.mode === 'mock' ? 'text-amber-400/70' : 'text-emerald-400/70'}`}>[{e.mode}]</span>}
            <span className={COLOR[e.kind]}>{e.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
