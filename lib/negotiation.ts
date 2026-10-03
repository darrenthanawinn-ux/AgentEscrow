import type { Contract, Evaluation, Milestone, TranscriptEntry } from './types';

export function parseBudget(brief: string): number {
  const m = brief.match(/(?:\$|USD\s?)\s?([\d,]+(?:\.\d+)?)/i) || brief.match(/([\d,]+(?:\.\d+)?)\s?(?:usd|dollars)/i);
  const n = m ? Number(m[1].replace(/,/g, '')) : 500;
  return Number.isFinite(n) && n > 0 ? n : 500;
}

export function cleanTitle(brief: string): string {
  const t = brief.replace(/(?:for\s+)?(?:\$|USD\s?)\s?[\d,]+(?:\.\d+)?/gi, '').replace(/\s+/g, ' ').trim();
  return (t || 'Untitled project').replace(/^(please\s+)?/i, '').slice(0, 80);
}

const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/** Scripted but brief-aware negotiation. Index even = buyer, odd = vendor. */
export function mockTurn(index: number, brief: string): string {
  const budget = parseBudget(brief);
  const title = cleanTitle(brief);
  const m1 = Math.round(budget * 0.3);
  const m2 = Math.round(budget * 0.4);
  const m3 = Math.round(budget - m1 - m2);
  const script = [
    `Project request: "${title}". My budget ceiling is ${money(budget)} total. I need staged delivery with escrow protection and clear acceptance criteria per milestone.`,
    `Understood. That scope is feasible at ${money(budget)} if we cut it into three milestones: design and scaffolding, core implementation, then polish and handoff. I want funds locked in escrow before I start.`,
    `Agreed on escrow. Proposed split: ${money(m1)} for scaffolding, ${money(m2)} for core build, ${money(m3)} for polish and docs. Each milestone must ship with verifiable output and a short written summary.`,
    `Accepted. I'll deliver M1 within two days. For payout I need automatic release as soon as the evaluator verifies the deliverable against the criteria, with no manual approval delays.`,
    `Done. Automatic release on verified delivery, rejected submissions can be resubmitted twice. Funds are held via PayPal authorization and released milestone by milestone.`,
    `Locked in. Terms are final at ${money(budget)} over 3 milestones. Drafting the contract JSON now.`,
  ];
  return script[Math.min(index, script.length - 1)];
}

export function mockContract(brief: string): Contract {
  const budget = parseBudget(brief);
  const title = cleanTitle(brief);
  const a1 = Math.round(budget * 0.3 * 100) / 100;
  const a2 = Math.round(budget * 0.4 * 100) / 100;
  const a3 = Math.round((budget - a1 - a2) * 100) / 100;
  return normalizeContract(
    {
      title,
      milestones: [
        {
          title: 'Design & Scaffolding',
          description: `Project structure, architecture notes and a working skeleton for: ${title}.`,
          amount: a1,
          acceptanceCriteria: ['Project structure delivered', 'Architecture summary included', 'Runs locally'],
        },
        {
          title: 'Core Implementation',
          description: 'Main features implemented and demonstrable end to end.',
          amount: a2,
          acceptanceCriteria: ['Core features implemented', 'Code or repository link provided', 'Basic tests or demo steps'],
        },
        {
          title: 'Polish & Handoff',
          description: 'Final QA, documentation and handoff package.',
          amount: a3,
          acceptanceCriteria: ['Documentation provided', 'Known issues listed', 'Handoff checklist complete'],
        },
      ],
      terms: [
        'Funds are held in PayPal escrow (authorization) before work begins.',
        'Each milestone is released automatically when the AI Evaluator verifies the deliverable.',
        'Rejected submissions may be revised and resubmitted.',
        'Disputes are escalated to a human arbiter.',
      ],
    },
    brief
  );
}

/** Make any (LLM or mock) contract draft safe: ids, statuses, 2dp amounts, sum === total. */
export function normalizeContract(raw: any, brief: string, transcript: TranscriptEntry[] = []): Contract {
  const total = parseBudget(brief);
  const src: any[] = Array.isArray(raw?.milestones) && raw.milestones.length ? raw.milestones.slice(0, 6) : [];
  if (!src.length) return mockContract(brief);

  let amounts = src.map((m) => Math.max(0, Number(m.amount) || 0));
  const sum = amounts.reduce((a, b) => a + b, 0);
  if (sum <= 0) amounts = src.map(() => total / src.length);
  else amounts = amounts.map((a) => (a / sum) * total);
  amounts = amounts.map((a) => Math.round(a * 100) / 100);
  const diff = Math.round((total - amounts.reduce((a, b) => a + b, 0)) * 100) / 100;
  amounts[amounts.length - 1] = Math.round((amounts[amounts.length - 1] + diff) * 100) / 100;

  const contractId = `AEC-${Date.now().toString(36).toUpperCase()}`;
  const milestones: Milestone[] = src.map((m, i) => ({
    id: `M${i + 1}`,
    title: String(m.title || `Milestone ${i + 1}`).slice(0, 80),
    description: String(m.description || '').slice(0, 300),
    amount: amounts[i],
    acceptanceCriteria: (Array.isArray(m.acceptanceCriteria) && m.acceptanceCriteria.length
      ? m.acceptanceCriteria
      : ['Deliverable matches the milestone description']
    )
      .slice(0, 5)
      .map(String),
    status: 'PENDING',
  }));

  void transcript;
  return {
    id: contractId,
    title: String(raw?.title || cleanTitle(brief)).slice(0, 100),
    currency: 'USD',
    totalAmount: total,
    buyer: { name: 'Buyer Agent' },
    vendor: { name: 'Vendor Agent' },
    milestones,
    terms: (Array.isArray(raw?.terms) ? raw.terms : []).slice(0, 6).map(String),
    createdAt: Date.now(),
  };
}

/** Heuristic evaluator used in mock mode (and as a safety net if the LLM reply is unparsable). */
export function mockEvaluate(milestone: Pick<Milestone, 'title' | 'description' | 'acceptanceCriteria'>, deliverable: string): Evaluation {
  const text = deliverable.trim();
  const words = text ? text.split(/\s+/).length : 0;
  const lower = text.toLowerCase();
  const keywords = Array.from(
    new Set(
      `${milestone.title} ${milestone.description} ${milestone.acceptanceCriteria.join(' ')}`
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 4)
    )
  );
  const matched = keywords.filter((k) => lower.includes(k)).length;
  const hasLink = /https?:\/\/\S+/.test(text) || /```/.test(text) || /\b(function|const|import|class|def)\b/.test(text);
  const bad = /\b(todo|lorem ipsum|placeholder|not done|fail)\b/i.test(text);
  const score = Math.max(0, Math.min(100, Math.round(25 + Math.min(words, 50) * 0.7 + matched * 6 + (hasLink ? 12 : 0) - (bad ? 40 : 0))));
  const passed = words >= 8 && !bad && score >= 60;
  const feedback = passed
    ? `Deliverable satisfies ${Math.max(1, Math.min(milestone.acceptanceCriteria.length, matched + 1))}/${milestone.acceptanceCriteria.length} criteria${hasLink ? ' and includes verifiable artifacts' : ''}. Approved for release.`
    : words < 8
      ? 'Submission too short to verify. Provide a link, code snippet or a written summary covering the acceptance criteria.'
      : bad
        ? 'Submission contains placeholder or incomplete markers. Resubmit finished work.'
        : `Not enough evidence for the acceptance criteria (score ${score}/100). Address: ${milestone.acceptanceCriteria.join('; ')}.`;
  return { passed, score, feedback };
}
