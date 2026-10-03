import { NextResponse } from 'next/server';
import { USE_MOCK_SERVICES, hasLLMCreds, hasPayPalCreds, llmProvider } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    defaultMock: USE_MOCK_SERVICES,
    paypalConfigured: hasPayPalCreds(),
    llmConfigured: hasLLMCreds(),
    llmProvider: llmProvider(),
    env: process.env.NODE_ENV,
  });
}
