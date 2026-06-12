/**
 * Tiện ích dùng chung cho thuật toán gợi ý nguyện vọng (API + static).
 */

const NORTH_KEYWORDS = ['hà nội', 'hanoi', 'thái nguyên', 'nghệ an', 'vinh', 'bắc ninh', 'hải phòng'];
const CENTRAL_KEYWORDS = ['đà nẵng', 'huế', 'khánh hòa', 'nha trang', 'quảng nam', 'thanh hóa', 'quy nhơn'];
const SOUTH_KEYWORDS = ['hồ chí minh', 'tp.hcm', 'hcm', 'cần thơ', 'bình dương', 'đồng nai', 'vũng tàu', 'long an'];

const REGION_KEYWORDS = {
  north: NORTH_KEYWORDS,
  central: CENTRAL_KEYWORDS,
  south: SOUTH_KEYWORDS,
};

const REGION_CENTERS = {
  north: { city: 'Hà Nội', lat: 21.0285, lng: 105.8342 },
  central: { city: 'Đà Nẵng', lat: 16.0544, lng: 108.2022 },
  south: { city: 'TP.HCM', lat: 10.8231, lng: 106.6297 },
};

/** Tọa độ từng cơ sở cho trường đa miền (key = university id viết thường) */
const MULTI_CAMPUS_COORDS = {
  rmit: {
    north: { city: 'Hà Nội', lat: 21.0318, lng: 105.7465 },
    south: { city: 'TP.HCM', lat: 10.73, lng: 106.6946 },
  },
  fptu: {
    north: { city: 'Hà Nội', lat: 21.0135, lng: 105.5273 },
    central: { city: 'Đà Nẵng', lat: 16.0544, lng: 108.214 },
    south: { city: 'TP.HCM', lat: 10.8411, lng: 106.8099 },
  },
  ftu: {
    north: { city: 'Hà Nội', lat: 21.0233, lng: 105.8056 },
    south: { city: 'TP.HCM', lat: 10.7772, lng: 106.6958 },
  },
};

export function inferRegionFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (NORTH_KEYWORDS.some((kw) => lower.includes(kw))) return 'north';
  if (CENTRAL_KEYWORDS.some((kw) => lower.includes(kw))) return 'central';
  if (SOUTH_KEYWORDS.some((kw) => lower.includes(kw))) return 'south';
  return null;
}

function inferRegionFromCoords(lat, lng) {
  if (lat == null || lng == null || Number.isNaN(Number(lat))) return null;
  const latitude = Number(lat);
  if (latitude >= 20) return 'north';
  if (latitude >= 12) return 'central';
  return 'south';
}

export function normalizeCombos(combos) {
  if (Array.isArray(combos)) return combos;
  if (typeof combos === 'string') {
    try {
      const parsed = JSON.parse(combos);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
    return combos.split(',').map((item) => item.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  return [];
}

export function isMultiCampusUniversity(university) {
  const cityText = [university?.city, university?.location, university?.name].filter(Boolean).join(' ');
  return isMultiCampus(cityText);
}

function isMultiCampus(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return lower.includes('&') || lower.includes(' và ') || lower.includes('nhiều cơ sở') || lower.includes('toàn quốc');
}

function getUniversityId(university) {
  return (university?.id || university?.short_name || university?.shortName || '').toLowerCase();
}

function getMentionedRegions(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const regions = [];
  if (NORTH_KEYWORDS.some((kw) => lower.includes(kw))) regions.push('north');
  if (CENTRAL_KEYWORDS.some((kw) => lower.includes(kw))) regions.push('central');
  if (SOUTH_KEYWORDS.some((kw) => lower.includes(kw))) regions.push('south');
  return regions;
}

/**
 * Chọn cơ sở hiển thị trên bản đồ / kết quả tư vấn theo miền người dùng chọn.
 */
export function resolveUniversityCampus(university, preferredRegion = 'all') {
  const cityText = [university.city, university.location, university.name].filter(Boolean).join(' ');
  const uniId = getUniversityId(university);
  const registry = MULTI_CAMPUS_COORDS[uniId] || {};
  const mentioned = getMentionedRegions(cityText);
  const isMulti = isMultiCampus(cityText) || mentioned.length > 1 || university.region === 'all';

  if (!isMulti) {
    return {
      lat: university.lat,
      lng: university.lng,
      city: university.city,
      region: resolveUniversityRegion(university),
    };
  }

  if (preferredRegion && preferredRegion !== 'all' && matchesRegion(university, preferredRegion)) {
    const campus = registry[preferredRegion] || REGION_CENTERS[preferredRegion];
    return { ...campus, region: preferredRegion };
  }

  const fallbackRegion = mentioned[0] || resolveUniversityRegion(university) || 'south';
  const campus = registry[fallbackRegion] || REGION_CENTERS[fallbackRegion];
  return { ...campus, region: fallbackRegion };
}

export function applyCampusToUniversity(university, preferredRegion = 'all') {
  const campus = resolveUniversityCampus(university, preferredRegion);
  return {
    ...university,
    lat: campus.lat,
    lng: campus.lng,
    city: campus.city,
    campus_region: campus.region,
  };
}

/**
 * Xác định vùng miền thực tế của trường (không trả về "all" khi đã chọn lọc cụ thể).
 */
export function resolveUniversityRegion(university) {
  if (university.region && university.region !== 'all') {
    return university.region;
  }

  return (
    inferRegionFromText(university.city)
    || inferRegionFromText(university.location)
    || inferRegionFromText(university.name)
    || inferRegionFromCoords(university.lat, university.lng)
    || null
  );
}

/**
 * Lọc khu vực chặt: chọn miền Nam thì không hiện miền Trung/Bắc.
 */
export function matchesRegion(university, selectedRegion) {
  if (!selectedRegion || selectedRegion === 'all') return true;

  const cityText = [university.city, university.location, university.name].filter(Boolean).join(' ');

  if (isMultiCampus(cityText)) {
    const keywords = REGION_KEYWORDS[selectedRegion] || [];
    return keywords.some((kw) => cityText.toLowerCase().includes(kw));
  }

  const resolved = resolveUniversityRegion(university);
  return resolved === selectedRegion;
}

/**
 * Lọc loại trường chặt: chọn công lập thì không hiện tư thục.
 */
export function matchesSchoolType(university, schoolType) {
  if (!schoolType || schoolType === 'all') return true;
  return university.type === schoolType;
}

/** Ngưỡng dựa trên chênh lệch điểm so với điểm chuẩn năm gần nhất */
export function classifyRisk(delta) {
  if (delta >= 1.5) return { id: 'safe', label: 'An toàn' };
  if (delta >= -0.5) return { id: 'fit', label: 'Phù hợp' };
  return { id: 'reach', label: 'Thử thách' };
}

export function getLatestCutoffYear(cutoffs) {
  const years = Object.keys(cutoffs).map(Number).filter((y) => !Number.isNaN(y));
  return years.length ? Math.max(...years) : null;
}

export function getLatestCutoff(cutoffs) {
  const year = getLatestCutoffYear(cutoffs);
  if (year === null) return { year: null, score: undefined };
  return { year, score: cutoffs[year] };
}

/** Điểm xếp hạng nội bộ (không phải xác suất trúng tuyển) */
export function computeRankScore(delta, profile, university, major, trend) {
  let rank = 50 + delta * 10;
  if ((profile.interests || []).includes(major.category)) rank += 15;
  if (profile.region && profile.region !== 'all' && matchesRegion(university, profile.region)) rank += 8;
  if (profile.maxTuition > 0 && university.tuition <= profile.maxTuition) rank += 5;
  if (trend === 'Giảm') rank += 3;
  if (trend === 'Tăng') rank -= 3;
  return Math.max(1, Math.min(99, Math.round(rank)));
}

export function getTrend(cutoffs) {
  const change = (cutoffs[2025] || 0) - (cutoffs[2023] || 0);
  if (change >= 1) return 'Tăng';
  if (change <= -0.5) return 'Giảm';
  return 'Ổn định';
}

function regionLabel(region) {
  if (region === 'north') return 'miền Bắc';
  if (region === 'central') return 'miền Trung';
  if (region === 'south') return 'miền Nam';
  return 'toàn quốc';
}

function buildReason(profile, university, major, delta, trend, combination, cutoffYear) {
  const diffText = delta >= 0
    ? `cao hơn điểm chuẩn ${cutoffYear} (${combination}) ${delta.toFixed(1)} điểm`
    : `thấp hơn điểm chuẩn ${cutoffYear} (${combination}) ${Math.abs(delta).toFixed(1)} điểm`;
  const regionLabelText = profile.region === 'all'
    ? 'không giới hạn khu vực'
    : `ưu tiên khu vực ${regionLabel(profile.region)}`;

  const interestNote = (profile.interests || []).includes(major.category)
    ? 'ngành học này thuộc lĩnh vực bạn quan tâm'
    : 'ngành học phù hợp tổ hợp của bạn';

  const verifiedNote = university.data_source_url
    ? 'Dữ liệu có nguồn trường.'
    : 'Dữ liệu tham khảo — chưa xác minh nguồn.';

  return `Điểm của bạn ${diffText}, ${interestNote}, trường ở ${university.city}, ${regionLabelText}. Xu hướng 3 năm: ${trend.toLowerCase()}. ${verifiedNote} (Chưa tính điểm ưu tiên.)`;
}

export function computeMatchesFromPairs(groupedPairs, profile) {
  const {
    combination,
    scores,
    interests = [],
    region = 'all',
    maxTuition = 0,
    schoolType = 'all',
  } = profile;

  const totalScore = Object.values(scores).reduce((sum, value) => sum + Number(value || 0), 0);
  const matches = [];

  Object.values(groupedPairs).forEach((pair) => {
    const { university, major, cutoffs, combination: pairCombination } = pair;

    if (pairCombination) {
      if (pairCombination !== combination) return;
    } else {
      const combos = normalizeCombos(major.combos);
      if (!combos.length || !combos.includes(combination)) return;
    }

    if (interests.length > 0 && !interests.includes(major.category)) return;
    if (!matchesRegion(university, region)) return;
    if (!matchesSchoolType(university, schoolType)) return;
    if (maxTuition > 0 && university.tuition > maxTuition) return;

    const { year: cutoffYear, score: cutoff } = getLatestCutoff(cutoffs);
    if (cutoff === undefined || cutoffYear === null) return;

    const delta = totalScore - cutoff;
    const risk = classifyRisk(delta);
    const trend = getTrend(cutoffs);
    const rankScore = computeRankScore(delta, profile, university, major, trend);

    const resolvedUniversity = region && region !== 'all'
      ? applyCampusToUniversity(university, region)
      : university;

    const resolvedCombination = pairCombination || combination;

    matches.push({
      id: `${university.id}-${major.id}-${resolvedCombination}`,
      university: resolvedUniversity,
      major,
      combination: resolvedCombination,
      cutoff,
      cutoffYear,
      cutoffs,
      delta,
      risk,
      trend,
      score: rankScore,
      reason: buildReason(profile, university, major, delta, trend, resolvedCombination, cutoffYear),
    });
  });

  return { totalScore, matches };
}

const STRATEGY_RATIOS = { safe: 0.3, fit: 0.5, reach: 0.2 };
const QUOTA_FILL_ORDER = ['fit', 'safe', 'reach'];

function sortMatchesByScore(a, b) {
  return b.score - a.score || b.delta - a.delta;
}

/**
 * Chia kết quả theo ma trận 30/50/20.
 * - Ưu tiên đúng quota khi đủ dữ liệu từng nhóm.
 * - Nhóm thiếu (vd. điểm cao → ít Thử thách) không bịa thêm; slot dư chuyển sang Phù hợp / An toàn.
 */
export function applyStrategyQuota(matches, limit = 40) {
  if (!matches?.length) return [];

  const buckets = { safe: [], fit: [], reach: [] };
  matches.forEach((match) => {
    const tier = match.risk?.id;
    if (buckets[tier]) buckets[tier].push(match);
  });

  Object.values(buckets).forEach((list) => list.sort(sortMatchesByScore));

  const targetSafe = Math.round(limit * STRATEGY_RATIOS.safe);
  const targetFit = Math.round(limit * STRATEGY_RATIOS.fit);
  const targetReach = Math.max(0, limit - targetSafe - targetFit);

  const picked = {
    safe: buckets.safe.slice(0, targetSafe),
    fit: buckets.fit.slice(0, targetFit),
    reach: buckets.reach.slice(0, targetReach),
  };

  const unpicked = {
    safe: buckets.safe.slice(picked.safe.length),
    fit: buckets.fit.slice(picked.fit.length),
    reach: buckets.reach.slice(picked.reach.length),
  };

  let remaining = limit - picked.safe.length - picked.fit.length - picked.reach.length;

  for (const tier of QUOTA_FILL_ORDER) {
    while (remaining > 0 && unpicked[tier].length > 0) {
      picked[tier].push(unpicked[tier].shift());
      remaining -= 1;
    }
  }

  return [...picked.safe, ...picked.fit, ...picked.reach];
}

export function groupCutoffRows(cutoffsData) {
  const groupedPairs = {};

  cutoffsData.forEach((item) => {
    if (!item.university || !item.major) return;
    const comboKey = item.combination || '_legacy';
    const key = `${item.university_id}-${item.major_id}-${comboKey}`;
    if (!groupedPairs[key]) {
      groupedPairs[key] = {
        university: item.university,
        major: item.major,
        combination: item.combination || null,
        cutoffs: {},
        source_url: item.source_url || null,
      };
    }
    groupedPairs[key].cutoffs[item.year] = item.cutoff_score;
    if (item.source_url) groupedPairs[key].source_url = item.source_url;
  });

  return groupedPairs;
}

const CUTOFF_SELECT = `
  year,
  cutoff_score,
  combination,
  method,
  source_url,
  university_id,
  major_id,
  university:universities (
    id, name, short_name, type, city, region, website, tuition, lat, lng, data_source_url, verified_at
  ),
  major:majors (
    id, name, category, combos, description, program_code
  )
`;

export async function fetchAllCutoffs(supabase) {
  const pageSize = 1000;
  const allRows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cutoffs')
      .select(CUTOFF_SELECT)
      .order('university_id', { ascending: true })
      .order('major_id', { ascending: true })
      .order('year', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

/**
 * Lọc lại kết quả phía client (phòng dữ liệu cache cũ hoặc lỗi backend).
 */
export function filterMatchesByProfile(matches, profile) {
  if (!matches || !profile) return [];
  return matches.filter((match) => {
    const uni = match.university;
    if (!uni) return false;
    if (!matchesRegion(uni, profile.region || 'all')) return false;
    if (!matchesSchoolType(uni, profile.schoolType || 'all')) return false;
    if (profile.maxTuition > 0 && uni.tuition > profile.maxTuition) return false;
    return true;
  });
}
