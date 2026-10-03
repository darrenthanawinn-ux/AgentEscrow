export type AgentRole = 'buyer' | 'vendor' | 'system';
export type ServiceMode = 'mock' | 'live';

export interface ChatMessage {
  id: string;
  role: AgentRole;
  content: string;
  ts: number;
}

export interface TranscriptEntry {
  role: 'buyer' | 'vendor';
  content: string;
}

export type MilestoneStatus = 'PENDING' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED' | 'PAID';

export interface Evaluation {
  passed: boolean;
  score: number;
  feedback: string;
  proof?: string; // HMAC proof issued by /api/verify, required by /api/payout
}

export interface PayoutReceipt {
  batchId: string;
  captureId: string;
  status: string;
  amount: number;
  currency: string;
  receiver: string;
  mode: ServiceMode;
  ts: number;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  amount: number;
  acceptanceCriteria: string[];
  status: MilestoneStatus;
  deliverable?: string;
  evaluation?: Evaluation;
  payout?: PayoutReceipt;
}

export interface Contract {
  id: string;
  title: string;
  currency: string;
  totalAmount: number;
  buyer: { name: string };
  vendor: { name: string };
  milestones: Milestone[];
  terms: string[];
  createdAt: number;
}

export type EscrowStatus = 'CREATED' | 'LOCKED' | 'PARTIALLY_RELEASED' | 'RELEASED';

export interface Escrow {
  status: EscrowStatus;
  mode: ServiceMode;
  orderId: string;
  authorizationId?: string;
  txHash?: string;
  approvalUrl?: string | null;
  total: number;
  released: number;
  currency: string;
}

export interface LogEvent {
  id: string;
  ts: number;
  kind: 'info' | 'agent' | 'escrow' | 'verify' | 'payout' | 'warn' | 'error';
  text: string;
  mode?: ServiceMode;
}

export interface ApiEnvelope<T> {
  data: T;
  mode: ServiceMode;
  note?: string;
}
