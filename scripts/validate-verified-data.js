/**
 * Kiểm tra tính hợp lệ của dữ liệu CSV trước khi import lên Supabase.
 * Chạy: npm run validate:data
 */

const {
  VALID_COMBINATIONS,
  VALID_REGIONS,
  VALID_TYPES,
  loadVerifiedDataset,
} = require('./lib/csv-utils');

function fail(errors, message) {
  errors.push(message);
}

function validateDataset(dataset) {
  const errors = [];
  const warnings = [];

  const uniIds = new Set(dataset.universities.map((r) => r.university_id));
  const majorIds = new Set(dataset.majors.map((r) => r.major_id));
  const categoryIds = new Set(dataset.categories.map((r) => r.id));

  dataset.universities.forEach((row) => {
    if (!row.university_id) fail(errors, `universities dòng ${row._line}: thiếu university_id`);
    if (!VALID_TYPES.has(row.type)) fail(errors, `universities ${row.university_id}: type phải là public|private`);
    if (!VALID_REGIONS.has(row.region)) fail(errors, `universities ${row.university_id}: region không hợp lệ`);
    if (!row.source_url?.startsWith('http')) fail(errors, `universities ${row.university_id}: thiếu source_url`);
    (row.categories || '').split('|').filter(Boolean).forEach((cat) => {
      if (!categoryIds.has(cat)) fail(errors, `universities ${row.university_id}: category "${cat}" chưa có trong categories.csv`);
    });
  });

  dataset.majors.forEach((row) => {
    if (!row.major_id) fail(errors, `majors dòng ${row._line}: thiếu major_id`);
    if (!categoryIds.has(row.category)) fail(errors, `majors ${row.major_id}: category "${row.category}" không tồn tại`);
    if (!row.program_code) warnings.push(`majors ${row.major_id}: chưa có program_code (mã Bộ)`);
  });

  const comboKeys = new Set();
  dataset.admissionCombos.forEach((row) => {
    if (!uniIds.has(row.university_id)) fail(errors, `admission-combos dòng ${row._line}: university_id "${row.university_id}" không tồn tại`);
    if (!majorIds.has(row.major_id)) fail(errors, `admission-combos dòng ${row._line}: major_id "${row.major_id}" không tồn tại`);
    if (!VALID_COMBINATIONS.has(row.combination)) fail(errors, `admission-combos ${row.university_id}/${row.major_id}: combination "${row.combination}" không hợp lệ`);

    const key = `${row.university_id}|${row.major_id}|${row.combination}`;
    if (comboKeys.has(key)) fail(errors, `admission-combos trùng: ${key}`);
    comboKeys.add(key);
  });

  const cutoffKeys = new Set();
  dataset.cutoffs.forEach((row) => {
    if (!uniIds.has(row.university_id)) fail(errors, `cutoffs dòng ${row._line}: university_id "${row.university_id}" không tồn tại`);
    if (!majorIds.has(row.major_id)) fail(errors, `cutoffs dòng ${row._line}: major_id "${row.major_id}" không tồn tại`);
    if (!VALID_COMBINATIONS.has(row.combination)) fail(errors, `cutoffs ${row.university_id}/${row.major_id}: combination không hợp lệ`);

    const comboKey = `${row.university_id}|${row.major_id}|${row.combination}`;
    if (!comboKeys.has(comboKey)) {
      fail(errors, `cutoffs ${comboKey} năm ${row.year}: chưa khai báo trong admission-combos.csv`);
    }

    const score = Number(row.cutoff_score);
    if (Number.isNaN(score) || score < 10 || score > 30) {
      fail(errors, `cutoffs ${comboKey} năm ${row.year}: điểm ${row.cutoff_score} ngoài khoảng 10–30`);
    }

    const year = Number(row.year);
    if (Number.isNaN(year) || year < 2020 || year > 2030) {
      fail(errors, `cutoffs ${comboKey}: năm ${row.year} không hợp lệ`);
    }

    const key = `${comboKey}|${row.year}`;
    if (cutoffKeys.has(key)) fail(errors, `cutoffs trùng: ${key}`);
    cutoffKeys.add(key);
  });

  dataset.tuitionFees.forEach((row) => {
    if (!uniIds.has(row.university_id)) fail(errors, `tuition-fees dòng ${row._line}: university_id không tồn tại`);
    if (row.major_id && !majorIds.has(row.major_id)) {
      fail(errors, `tuition-fees ${row.university_id}/${row.major_id}: major_id không tồn tại`);
    }
    const amount = Number(row.amount_million);
    if (Number.isNaN(amount) || amount <= 0) {
      fail(errors, `tuition-fees ${row.university_id}: amount_million không hợp lệ`);
    }
  });

  return { errors, warnings };
}

function main() {
  console.log('🔍 Đang kiểm tra dữ liệu trong thư mục data/...\n');
  const dataset = loadVerifiedDataset();
  const { errors, warnings } = validateDataset(dataset);

  console.log(`📊 Thống kê:`);
  console.log(`   - Trường: ${dataset.universities.length}`);
  console.log(`   - Ngành: ${dataset.majors.length}`);
  console.log(`   - Tổ hợp xét tuyển: ${dataset.admissionCombos.length}`);
  console.log(`   - Điểm chuẩn: ${dataset.cutoffs.length}`);
  console.log(`   - Học phí: ${dataset.tuitionFees.length}\n`);

  if (warnings.length) {
    console.log('⚠️  Cảnh báo:');
    warnings.forEach((w) => console.log(`   - ${w}`));
    console.log('');
  }

  if (errors.length) {
    console.error('❌ Lỗi validation:');
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }

  console.log('✅ Dữ liệu hợp lệ — sẵn sàng import với: npm run import:data');
}

main();
