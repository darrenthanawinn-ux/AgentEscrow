'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { post, type UiMode } from '@/lib/client';
import type {
  ChatMessage,
  Contract,
  Escrow,
  Evaluation,
  LogEvent,
  Milestone,
  PayoutReceipt,
  ServiceMode,
  TranscriptEntry,
} from '@/lib/types';
import ContractCard from './ContractCard';
import EscrowPanel from './EscrowPanel';
import EventLog from './EventLog';
import Header, { type ServerInfo } from './Header';
import MilestoneBoard from './MilestoneBoard';
import NegotiationRoom from './NegotiationRoom';
import type { Stage } from './StatusBadge';

type Phase = 'idle' | 'negotiating' | 'contract' | 'locked' | 'complete';

interface State {
  brief: string;
  messages: ChatMessage[];
  phase: Phase;
  contract: Contract | null;
  escrow: Escrow | null;
  events: LogEvent[];
  vendorEmail: string;
}

const KEY = 'agentescrow:v1';
const MODE_KEY = 'agentescrow:mode';
const TURNS = 6;

const initial: State = {
  brief: '',
  messages: [],
  phase: 'idle',
  contract: null,
  escrow: null,
  events: [],
  vendorEmail: 'vendor@example.com',
};

const uid = () => Math.random().toString(36).slice(2, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;

export default function Dashboard() {
  const [s, setS] = useState<State>(initial);
  const [mode, setModeState] = useState<UiMode>('auto');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const ref = useRef<State>(s);
  ref.current = s;
  const modeRef = useRef<UiMode>(mode);
  modeRef.current = mode;

  const setMode = (m: UiMode) => {
    setModeState(m);
    modeRef.current = m;
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  };

  // ───────── helpers ─────────
  const log = useCallback((kind: LogEvent['kind'], text: string, m?: ServiceMode) => {
    setS((p) => ({ ...p, events: [...p.events, { id: uid(), ts: Date.now(), kind, text, mode: m }] }));
  }, []);

  const patchMilestone = useCallback((id: string, patch: Partial<Milestone>) => {
    setS((p) =>
      p.contract
        ? { ...p, contract: { ...p.contract, milestones: p.contract.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)) } }
        : p
    );
  }, []);

  const noteOf = useCallback(
    (note?: string) => {
      if (note) log('warn', note);
    },
    [log]
  );

  // ───────── mount: restore, server info, PayPal return ─────────
  const authorize = useCallback(
    async (orderId: string, base: Escrow, useMode: UiMode) => {
      log('escrow', `Authorizing PayPal order ${orderId}…`);
      const r = await post<{ authorizationId: string; txHash: string }>('/api/escrow/authorize', { orderId }, useMode);
      noteOf(r.note);
      setS((p) => ({
        ...p,
        phase: 'locked',
        escrow: { ...base, mode: r.mode, status: 'LOCKED', authorizationId: r.data.authorizationId, txHash: r.data.txHash },
      }));
      log('escrow', `Funds LOCKED in escrow (authorization ${r.data.authorizationId}).`, r.mode);
    },
    [log, noteOf]
  );

  useEffect(() => {
    let restored = initial;
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) restored = { ...initial, ...JSON.parse(saved) };
      const m = localStorage.getItem(MODE_KEY) as UiMode | null;
      if (m === 'auto' || m === 'mock' || m === 'live') {
        setModeState(m);
        modeRef.current = m;
      }
    } catch {}
    if (restored.phase === 'negotiating') restored = { ...restored, phase: 'idle', messages: [] };
    setS(restored);
    ref.current = restored;
    setHydrated(true);

    fetch('/api/config')
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    const flow = params.get('paypal');
    if (flow) window.history.replaceState(null, '', window.location.pathname);
    if (flow === 'return' && restored.escrow?.status === 'CREATED') {
      setBusy(true);
      authorize(restored.escrow.orderId, restored.escrow, 'live')
        .catch((e) => log('error', `Authorization failed: ${e.message}`))
        .finally(() => setBusy(false));
    } else if (flow === 'cancel') {
      log('warn', 'PayPal approval was cancelled. Funds not locked.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  }, [s, hydrated]);

  // ───────── 1. negotiation ─────────
  const startNegotiation = async (brief: string) => {
    setBusy(true);
    const fresh: State = {
      ...initial,
      vendorEmail: ref.current.vendorEmail,
      brief,
      phase: 'negotiating',
      messages: [{ id: uid(), role: 'system', content: `Project request: ${brief}`, ts: Date.now() }],
    };
    setS(fresh);
    ref.current = fresh;
    log('info', `Negotiation started: "${brief}"`);
    const transcript: TranscriptEntry[] = [];
    try {
      for (let i = 0; i < TURNS; i++) {
        const r = await post<{ role: 'buyer' | 'vendor'; content: string }>(
          '/api/negotiate',
          { action: 'turn', brief, transcript, index: i },
          modeRef.current
        );
        if (i === 0) noteOf(r.note);
        transcript.push({ role: r.data.role, content: r.data.content });
        setS((p) => ({ ...p, messages: [...p.messages, { id: uid(), role: r.data.role, content: r.data.content, ts: Date.now() }] }));
      }
      log('agent', 'Agents reached agreement. Generating contract JSON…');
      const f = await post<Contract>('/api/negotiate', { action: 'finalize', brief, transcript }, modeRef.current);
      noteOf(f.note);
      setS((p) => ({
        ...p,
        phase: 'contract',
        contract: f.data,
        messages: [
          ...p.messages,
          { id: uid(), role: 'system', content: `Contract ${f.data.id} drafted: ${f.data.milestones.length} milestones, ${f.data.totalAmount} ${f.data.currency}.`, ts: Date.now() },
        ],
      }));
      log('agent', `Contract ${f.data.id} ready.`, f.mode);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error';
      log('error', `Negotiation failed: ${msg}`);
      setS((p) => ({
        ...p,
        phase: 'idle',
        messages: [...p.messages, { id: uid(), role: 'system', content: `Negotiation failed: ${msg}`, ts: Date.now() }],
      }));
    } finally {
      setBusy(false);
    }
  };

  // ───────── 2. lock funds ─────────
  const lockFunds = async () => {
    const c = ref.current.contract;
    if (!c) return;
    setBusy(true);
    log('escrow', 'Creating PayPal order (intent: AUTHORIZE)…');
    try {
      const r = await post<{ orderId: string; status: string; approvalUrl: string | null }>('/api/escrow/create', { contract: c }, modeRef.current);
      noteOf(r.note);
      const base: Escrow = {
        status: 'CREATED',
        mode: r.mode,
        orderId: r.data.orderId,
        approvalUrl: r.data.approvalUrl,
        total: c.totalAmount,
        released: 0,
        currency: c.currency,
      };
      log('escrow', `Order ${r.data.orderId} created.`, r.mode);

      if (r.mode === 'live' && r.data.approvalUrl) {
        const next: State = { ...ref.current, escrow: base };
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
        setS(next);
        log('escrow', 'Redirecting to PayPal for buyer approval…');
        window.location.href = r.data.approvalUrl;
        return; // stay busy during redirect
      }
      setS((p) => ({ ...p, escrow: base }));
      await authorize(r.data.orderId, base, modeRef.current);
    } catch (e) {
      log('error', `Escrow failed: ${e instanceof Error ? e.message : e}`);
    }
    setBusy(false);
  };

  // ───────── 3. verify + payout ─────────
  const releasePayout = async (id: string, proof: string) => {
    const { contract: c, escrow: esc, vendorEmail } = ref.current;
    const m = c?.milestones.find((x) => x.id === id);
    if (!c || !esc || !m) return;
    const isFinal = c.milestones.every((x) => x.id === id || x.status === 'PAID');
    log('payout', `Releasing ${m.amount} ${c.currency} for ${m.id} to ${vendorEmail}…`);
    const p = await post<PayoutReceipt>(
      '/api/payout',
      {
        contractId: c.id,
        milestone: { id: m.id, title: m.title, amount: m.amount },
        currency: c.currency,
        authorizationId: esc.authorizationId,
        vendorEmail,
        proof,
        isFinal,
      },
      modeRef.current
    );
    noteOf(p.note);
    patchMilestone(id, { status: 'PAID', payout: p.data });
    setS((prev) => {
      if (!prev.escrow) return prev;
      const released = r2(prev.escrow.released + m.amount);
      const done = released >= r2(prev.escrow.total) - 0.001;
      return {
        ...prev,
        phase: done ? 'complete' : prev.phase,
        escrow: { ...prev.escrow, released, status: done ? 'RELEASED' : 'PARTIALLY_RELEASED' },
      };
    });
    log('payout', `Paid out ${m.amount} ${c.currency} (batch ${p.data.batchId}, ${p.data.status}).`, p.mode);
  };

  const submitDeliverable = async (id: string, text: string) => {
    const c = ref.current.contract;
    const m = c?.milestones.find((x) => x.id === id);
    if (!c || !m) return;
    setBusy(true);
    patchMilestone(id, { status: 'SUBMITTED', deliverable: text });
    log('verify', `Vendor submitted deliverable for ${id}. AI Evaluator reviewing…`);
    try {
      const v = await post<Evaluation>(
        '/api/verify',
        {
          contractId: c.id,
          milestone: { id: m.id, title: m.title, description: m.description, acceptanceCriteria: m.acceptanceCriteria, amount: m.amount },
          deliverable: text,
        },
        modeRef.current
      );
      noteOf(v.note);
      const ev = v.data;
      if (!ev.passed || !ev.proof) {
        patchMilestone(id, { status: 'REJECTED', evaluation: ev });
        log('verify', `${id} REJECTED (${ev.score}/100): ${ev.feedback}`, v.mode);
        return;
      }
      patchMilestone(id, { status: 'VERIFIED', evaluation: ev });
      log('verify', `${id} VERIFIED (${ev.score}/100). Triggering automatic payout.`, v.mode);
      try {
        await releasePayout(id, ev.proof);
      } catch (e) {
        log('error', `Payout failed: ${e instanceof Error ? e.message : e}. Use "Retry payout".`);
      }
    } catch (e) {
      patchMilestone(id, { status: 'PENDING' });
      log('error', `Verification failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  const retryPayout = async (id: string) => {
    const proof = ref.current.contract?.milestones.find((m) => m.id === id)?.evaluation?.proof;
    if (!proof) return;
    setBusy(true);
    try {
      await releasePayout(id, proof);
    } catch (e) {
      log('error', `Payout failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    const fresh = { ...initial, vendorEmail: ref.current.vendorEmail };
    setS(fresh);
    ref.current = fresh;
    setBusy(false);
    try {
      localStorage.removeItem(KEY);
    } catch {}
  };

  // ───────── derived header state ─────────
  const { stage, stepIndex } = useMemo<{ stage: Stage; stepIndex: number }>(() => {
    if (s.phase === 'negotiating') return { stage: 'NEGOTIATING', stepIndex: 0 };
    if (s.phase === 'complete') return { stage: 'PAID OUT', stepIndex: 4 };
    if (s.contract?.milestones.some((m) => m.status === 'VERIFIED')) return { stage: 'VERIFIED', stepIndex: 2 };
    if (s.escrow && s.escrow.status !== 'CREATED') return { stage: 'ESCROW LOCKED', stepIndex: 1 };
    if (s.contract) return { stage: 'CONTRACT READY', stepIndex: 0 };
    return { stage: 'IDLE', stepIndex: -1 };
  }, [s.phase, s.contract, s.escrow]);

  return (
    <div className="min-h-screen">
      <Header stage={stage} stepIndex={stepIndex} mode={mode} setMode={setMode} info={info} onReset={reset} />
      <main className="mx-auto grid max-w-[1500px] gap-4 px-4 py-4 lg:grid-cols-[minmax(340px,5fr)_7fr]">
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-110px)]">
          <NegotiationRoom
            messages={s.messages}
            busy={busy}
            negotiating={s.phase === 'negotiating'}
            locked={Boolean(s.contract)}
            onStart={startNegotiation}
          />
        </div>
        <div className="space-y-4">
          <ContractCard contract={s.contract} escrow={s.escrow} />
          <EscrowPanel
            contract={s.contract}
            escrow={s.escrow}
            vendorEmail={s.vendorEmail}
            setVendorEmail={(v) => setS((p) => ({ ...p, vendorEmail: v }))}
            busy={busy}
            onLock={lockFunds}
          />
          <MilestoneBoard contract={s.contract} escrow={s.escrow} busy={busy} onSubmit={submitDeliverable} onRetry={retryPayout} />
          <EventLog events={s.events} />
        </div>
      </main>
    </div>
  );
}
