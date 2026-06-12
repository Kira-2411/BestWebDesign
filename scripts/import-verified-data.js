/**
 * Import dữ liệu verified từ thư mục data/ lên Supabase.
 *
 * Yêu cầu:
 * 1. Đã chạy supabase-migration-v2.sql trên Supabase
 * 2. File .env.local có NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY
 *
 * Chạy:
 *   npm run validate:data
 *   npm run import:data
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { loadVerifiedDataset } = require('./lib/csv-utils');

function loadEnv() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Không tìm thấy .env.local');
    process.exit(1);
  }

  const env = {};
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] ? match[2].trim() : '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      env[match[1]] = value;
    }
  });
  return env;
}

async function upsertChunked(supabase, table, rows, onConflict, label) {
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const options = onConflict ? { onConflict } : {};
    const { error } = onConflict
      ? await supabase.from(table).upsert(chunk, options)
      : await supabase.from(table).insert(chunk);
    if (error) {
      throw new Error(`${label} (chunk ${i}): ${error.message}`);
    }
  }
}

function buildMajorCombos(dataset, majorId) {
  const combos = dataset.admissionCombos
    .filter((row) => row.major_id === majorId)
    .map((row) => row.combination);
  return [...new Set(combos)];
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local');
    process.exit(1);
  }

  const dataset = loadVerifiedDataset();
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log('🚀 Bắt đầu import dữ liệu verified lên Supabase...\n');

  const categories = dataset.categories.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
  }));

  const majors = dataset.majors.map((row) => ({
    id: row.major_id,
    name: row.name,
    category: row.category,
    description: row.description || '',
    careers: [],
    salary: '',
    difficulty: 5,
    employment: 90,
    combos: buildMajorCombos(dataset, row.major_id),
    program_code: row.program_code || null,
    data_source_url: row.source_url || null,
    verified_at: row.verified_at || null,
  }));

  const tuitionByUni = {};
  dataset.tuitionFees.forEach((row) => {
    if (!row.major_id) {
      tuitionByUni[row.university_id] = Number(row.amount_million);
    }
  });

  const universities = dataset.universities.map((row) => ({
    id: row.university_id,
    name: row.name,
    short_name: row.short_name,
    type: row.type,
    city: row.city,
    region: row.region,
    website: row.website,
    tuition: tuitionByUni[row.university_id] || null,
    students: row.students || null,
    majors_count: Number(row.majors_count) || null,
    lat: Number(row.lat),
    lng: Number(row.lng),
    categories: row.categories.split('|').filter(Boolean),
    data_source_url: row.source_url || null,
    verified_at: row.verified_at || null,
  }));

  const admissionCombos = dataset.admissionCombos.map((row) => ({
    university_id: row.university_id,
    major_id: row.major_id,
    combination: row.combination,
    subjects: row.subjects.split('|').filter(Boolean),
    is_active: true,
    source_url: row.source_url || null,
    verified_at: row.verified_at || null,
  }));

  const cutoffs = dataset.cutoffs.map((row) => ({
    university_id: row.university_id,
    major_id: row.major_id,
    combination: row.combination,
    year: Number(row.year),
    cutoff_score: Number(row.cutoff_score),
    method: row.method || 'thi_thpt',
    source_url: row.source_url || null,
    verified_at: row.verified_at || null,
  }));

  const tuitionFees = dataset.tuitionFees.map((row) => ({
    university_id: row.university_id,
    major_id: row.major_id || null,
    year: Number(row.year),
    amount_million: Number(row.amount_million),
    note: row.note || null,
    source_url: row.source_url || null,
    verified_at: row.verified_at || null,
  }));

  await upsertChunked(supabase, 'categories', categories, 'id', 'categories');
  console.log(`✅ categories: ${categories.length} dòng`);

  await upsertChunked(supabase, 'majors', majors, 'id', 'majors');
  console.log(`✅ majors: ${majors.length} dòng`);

  await upsertChunked(supabase, 'universities', universities, 'id', 'universities');
  console.log(`✅ universities: ${universities.length} dòng`);

  await upsertChunked(supabase, 'admission_combos', admissionCombos, 'university_id,major_id,combination', 'admission_combos');
  console.log(`✅ admission_combos: ${admissionCombos.length} dòng`);

  const uniIds = [...new Set(universities.map((u) => u.id))];

  const { error: delCutoffErr } = await supabase
    .from('cutoffs')
    .delete()
    .in('university_id', uniIds);
  if (delCutoffErr) throw new Error(`Xóa cutoffs cũ: ${delCutoffErr.message}`);

  await upsertChunked(supabase, 'cutoffs', cutoffs, undefined, 'cutoffs');
  console.log(`✅ cutoffs: ${cutoffs.length} dòng (đã thay dữ liệu cũ của ${uniIds.length} trường)`);

  const { error: delTuitionErr } = await supabase
    .from('tuition_fees')
    .delete()
    .in('university_id', uniIds);
  if (delTuitionErr) throw new Error(`Xóa tuition_fees cũ: ${delTuitionErr.message}`);

  await upsertChunked(supabase, 'tuition_fees', tuitionFees, undefined, 'tuition_fees');
  console.log(`✅ tuition_fees: ${tuitionFees.length} dòng`);

  console.log('\n🎉 Import hoàn tất!');
  console.log('👉 Kiểm tra trên Supabase: Table Editor → universities, cutoffs, admission_combos');
  console.log('👉 Test web: nhập điểm A00 ~28 và xem HUST CNTT xuất hiện ở nhóm Phù hợp/An toàn');
}

main().catch((err) => {
  console.error('❌ Import thất bại:', err.message);
  if (err.message.includes('admission_combos')) {
    console.error('\n💡 Có thể bạn chưa chạy supabase-migration-v2.sql trên Supabase Dashboard.');
  }
  process.exit(1);
});
