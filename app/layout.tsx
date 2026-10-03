import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentEscrow | Autonomous AI contracting & PayPal escrow',
  description: 'Two AI agents negotiate, lock funds in PayPal escrow, and release payouts on verified delivery.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
