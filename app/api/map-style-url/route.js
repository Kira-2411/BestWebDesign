import { NextResponse } from 'next/server';

function getApiKey() {
  return process.env.VIETMAP_API_KEY || '154f9927fe7ac8231b3bdfd15e11a530c88e8a63b9f1964e';
}

export async function GET() {
  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json({ hasKey: false, styleUrl: null });
  }

  const styleUrl = `https://maps.vietmap.vn/maps/styles/tm/style.json?apikey=${encodeURIComponent(apiKey)}`;
  return NextResponse.json({ hasKey: true, styleUrl });
}
