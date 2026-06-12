import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';
import {
  fetchAllCutoffs,
  groupCutoffRows,
  computeMatchesFromPairs,
  applyStrategyQuota,
} from '../../../lib/match-utils';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const profile = await request.json();
    const { combination, scores } = profile;

    if (!combination || !scores || Object.keys(scores).length === 0) {
      return NextResponse.json(
        { error: 'Thiếu tổ hợp môn hoặc điểm số.' },
        { status: 400 }
      );
    }

    const cutoffsData = await fetchAllCutoffs(supabase);
    const groupedPairs = groupCutoffRows(cutoffsData);
    const { totalScore, matches } = computeMatchesFromPairs(groupedPairs, profile);

    const sortedMatches = applyStrategyQuota(matches, 40);

    return NextResponse.json({
      profile,
      totalScore,
      matches: sortedMatches,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
