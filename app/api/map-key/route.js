import { NextResponse } from 'next/server';
import { getVietmapApiKey } from '../../../lib/vietmap';

export async function GET() {
  const hasKey = !!getVietmapApiKey();
  return NextResponse.json({ hasKey });
}
