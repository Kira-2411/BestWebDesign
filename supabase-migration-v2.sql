-- ============================================================
-- UniMatch Migration v2 — Dữ liệu tuyển sinh chính xác
-- Chạy trong Supabase Dashboard → SQL Editor → Run
-- KHÔNG xóa dữ liệu cũ; chỉ bổ sung cột và bảng mới.
-- ============================================================

-- 1. Bổ sung metadata cho trường
ALTER TABLE universities
ADD COLUMN IF NOT EXISTS ministry_code TEXT,
ADD COLUMN IF NOT EXISTS data_source_url TEXT,
ADD COLUMN IF NOT EXISTS verified_at DATE;

-- 2. Bổ sung mã ngành Bộ cho majors
ALTER TABLE majors
ADD COLUMN IF NOT EXISTS program_code TEXT,
ADD COLUMN IF NOT EXISTS data_source_url TEXT,
ADD COLUMN IF NOT EXISTS verified_at DATE;

-- 3. Bổ sung cột cho cutoffs (tổ hợp + nguồn)
ALTER TABLE cutoffs
ADD COLUMN IF NOT EXISTS combination TEXT,
ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'thi_thpt',
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS verified_at DATE;

-- Gán tổ hợp mặc định cho dữ liệu cũ (nếu có)
UPDATE cutoffs SET combination = 'A00' WHERE combination IS NULL;

-- Đổi unique constraint: thêm combination
ALTER TABLE cutoffs DROP CONSTRAINT IF EXISTS cutoffs_university_id_major_id_year_key;
ALTER TABLE cutoffs DROP CONSTRAINT IF EXISTS cutoffs_university_id_major_id_combination_year_key;

-- Cho phép combination NULL tạm thời với dữ liệu legacy
CREATE UNIQUE INDEX IF NOT EXISTS cutoffs_unique_verified
ON cutoffs (university_id, major_id, combination, year)
WHERE combination IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cutoffs_unique_legacy
ON cutoffs (university_id, major_id, year)
WHERE combination IS NULL;

-- 4. Bảng tổ hợp xét tuyển theo trường–ngành
CREATE TABLE IF NOT EXISTS admission_combos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    major_id TEXT NOT NULL REFERENCES majors(id) ON DELETE CASCADE,
    combination TEXT NOT NULL,
    subjects TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    source_url TEXT,
    verified_at DATE,
    UNIQUE (university_id, major_id, combination)
);

-- 5. Bảng học phí (theo trường hoặc theo ngành)
CREATE TABLE IF NOT EXISTS tuition_fees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    major_id TEXT REFERENCES majors(id) ON DELETE CASCADE,
    year INT NOT NULL,
    amount_million NUMERIC(10, 2) NOT NULL,
    note TEXT,
    source_url TEXT,
    verified_at DATE,
    UNIQUE (university_id, major_id, year)
);

-- 6. RLS: cho phép đọc công khai (giống các bảng khác)
ALTER TABLE admission_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read admission_combos" ON admission_combos;
CREATE POLICY "Allow public read admission_combos" ON admission_combos
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read tuition_fees" ON tuition_fees;
CREATE POLICY "Allow public read tuition_fees" ON tuition_fees
    FOR SELECT USING (true);

ALTER TABLE admission_combos DISABLE ROW LEVEL SECURITY;
ALTER TABLE tuition_fees DISABLE ROW LEVEL SECURITY;

-- 7. Index hỗ trợ query match
CREATE INDEX IF NOT EXISTS idx_cutoffs_combination ON cutoffs (combination);
CREATE INDEX IF NOT EXISTS idx_cutoffs_univ_major ON cutoffs (university_id, major_id);
CREATE INDEX IF NOT EXISTS idx_admission_combos_lookup ON admission_combos (university_id, combination);
CREATE INDEX IF NOT EXISTS idx_tuition_fees_univ ON tuition_fees (university_id, year DESC);
