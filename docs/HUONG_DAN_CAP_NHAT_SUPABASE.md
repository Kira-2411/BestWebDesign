# Hướng dẫn cập nhật dữ liệu tuyển sinh lên Supabase

Tài liệu này hướng dẫn bạn theo dõi và cập nhật dữ liệu **chính xác** cho chức năng gợi ý nguyện vọng UniMatch.

---

## Tổng quan quy trình

```text
1. Chạy migration SQL trên Supabase (một lần)
2. Sửa file CSV trong thư mục data/
3. npm run validate:data   → kiểm tra lỗi
4. npm run import:data     → đẩy lên Supabase
5. Test trên web
```

---

## Bước 1: Chạy migration (chỉ làm một lần)

1. Mở [Supabase Dashboard](https://supabase.com/dashboard) → project của bạn
2. Vào **SQL Editor** → **New query**
3. Copy toàn bộ nội dung file `supabase-migration-v2.sql` ở thư mục gốc project
4. Nhấn **Run**

Migration sẽ tạo thêm:
- Cột `combination`, `source_url` trên bảng `cutoffs`
- Bảng mới `admission_combos` (tổ hợp xét tuyển theo trường–ngành)
- Bảng mới `tuition_fees` (học phí có nguồn)

**Không xóa** dữ liệu cũ — an toàn cho project đang chạy.

---

## Bước 2: Cấu trúc file CSV trong `data/`

| File | Mục đích |
|------|----------|
| `categories.csv` | 10 nhóm ngành (cntt, kinhte, yte…) |
| `universities-verified.csv` | Thông tin trường (tên, tọa độ, website, nguồn) |
| `majors-verified.csv` | Ngành học + mã Bộ (`program_code`) |
| `admission-combos.csv` | Tổ hợp xét tuyển được phép cho từng trường–ngành |
| `cutoffs-verified.csv` | Điểm chuẩn theo năm + tổ hợp |
| `tuition-fees.csv` | Học phí (triệu VNĐ/năm) |

### Quy tắc quan trọng

1. **Mỗi dòng cutoff** phải có cặp tương ứng trong `admission-combos.csv`
2. **Tổ hợp** chỉ dùng mã chuẩn: `A00`, `A01`, `B00`, `C00`, `D01`, `D07`, `D14`…
3. **Mỗi bản ghi** nên có `source_url` (link thông báo tuyển sinh / điểm chuẩn)
4. **verified_at** = ngày bạn kiểm tra dữ liệu (YYYY-MM-DD)

---

## Bước 3: Thêm trường mới (ví dụ: ĐH Đà Nẵng)

### 3.1 Thêm vào `universities-verified.csv`

```csv
udn,Đại học Đà Nẵng,UDN,public,Đà Nẵng,central,https://udn.vn,30000+,50+,16.0691,108.2223,cntt|kysu,https://udn.vn,2026-06-12
```

### 3.2 Thêm tổ hợp vào `admission-combos.csv`

```csv
udn,cntt,A00,Toán|Vật lý|Hóa học,https://udn.vn/tuyen-sinh,2026-06-12
udn,cntt,A01,Toán|Vật lý|Tiếng Anh,https://udn.vn/tuyen-sinh,2026-06-12
```

### 3.3 Thêm điểm chuẩn vào `cutoffs-verified.csv`

Lấy từ website trường (cột điểm chuẩn năm 2024 hoặc 2025):

```csv
udn,cntt,A00,2023,24.50,thi_thpt,https://udn.vn/diem-chuan,2026-06-12
udn,cntt,A00,2024,25.00,thi_thpt,https://udn.vn/diem-chuan,2026-06-12
udn,cntt,A00,2025,25.50,thi_thpt,https://udn.vn/diem-chuan,2026-06-12
```

### 3.4 Thêm học phí vào `tuition-fees.csv`

```csv
udn,,2024,22,Học phí đại trà,https://udn.vn/hoc-phi,2026-06-12
```

(`major_id` để trống = học phí chung của trường)

---

## Bước 4: Validate và Import

Trong terminal, tại thư mục project:

```bash
npm run validate:data
```

Nếu pass:

```bash
npm run import:data
```

Script `import:data` cần file `.env.local` có:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (lấy từ Supabase → Settings → API → service_role)

---

## Bước 5: Kiểm tra trên Supabase Dashboard

Sau import, mở **Table Editor** và kiểm tra:

| Bảng | Kiểm tra |
|------|----------|
| `universities` | Có trường mới, `data_source_url` không rỗng |
| `admission_combos` | Đủ tổ hợp cho từng ngành |
| `cutoffs` | Có cột `combination`, điểm hợp lý (15–30) |
| `tuition_fees` | Học phí khớp nguồn |

### Query kiểm tra nhanh (SQL Editor)

```sql
-- Đếm trường verified
SELECT COUNT(*) FROM universities WHERE data_source_url IS NOT NULL;

-- Điểm chuẩn theo trường
SELECT u.short_name, c.major_id, c.combination, c.year, c.cutoff_score
FROM cutoffs c
JOIN universities u ON u.id = c.university_id
WHERE c.combination IS NOT NULL
ORDER BY u.short_name, c.major_id, c.year DESC;

-- Cutoff thiếu admission_combo (không nên có dòng nào)
SELECT c.*
FROM cutoffs c
LEFT JOIN admission_combos ac
  ON ac.university_id = c.university_id
 AND ac.major_id = c.major_id
 AND ac.combination = c.combination
WHERE c.combination IS NOT NULL AND ac.id IS NULL;
```

---

## Bước 6: Test trên web

1. `npm run dev`
2. Chọn tổ hợp **A00**, nhập điểm ví dụ: Toán 9.5, Lý 9, Hóa 9.5 → tổng **28**
3. Chọn lĩnh vực **CNTT**, khu vực **Miền Bắc**
4. Kết quả mong đợi: **HUST CNTT** xuất hiện với:
   - Điểm chuẩn ~28.85 (năm 2025)
   - Chênh lệch ~-0.85 → nhóm **Phù hợp**

---

## Cập nhật hàng năm (khi có điểm chuẩn mới)

1. Mở `data/cutoffs-verified.csv`
2. Thêm dòng năm mới cho từng cặp trường–ngành–tổ hợp
3. Cập nhật `verified_at`
4. `npm run validate:data` → `npm run import:data`

---

## Dữ liệu mẫu hiện có (8 trường)

| ID | Trường |
|----|--------|
| hust | ĐH Bách Khoa Hà Nội |
| vnu | ĐHQG Hà Nội |
| neu | ĐH Kinh tế Quốc dân |
| ftu | ĐH Ngoại thương |
| ueh | ĐH Kinh tế TP.HCM |
| hcmut | ĐH Bách Khoa TP.HCM |
| ump | ĐH Y Dược TP.HCM |
| vku | ĐH VKU (Đà Nẵng) |

Mục tiêu tiếp theo: mở rộng lên **30–40 trường** bằng cách lặp lại quy trình trên.

---

## Lỗi thường gặp

| Lỗi | Cách xử lý |
|-----|------------|
| `admission_combos does not exist` | Chưa chạy `supabase-migration-v2.sql` |
| `cutoffs trùng` | Kiểm tra trùng university+major+combination+year |
| `chưa khai báo trong admission-combos` | Thêm dòng tổ hợp trước khi thêm cutoff |
| Web không có kết quả | Chạy lại `import:data`, kiểm tra tổ hợp user chọn có trong DB |

---

## Phân công team (gợi ý)

- **Người A:** Thu thập điểm chuẩn từ website trường
- **Người B:** Nhập CSV + chạy validate
- **Người C:** Cross-check 2 người trên cùng 1 trường

Mỗi trường ~30 phút nếu chỉ lấy 5–10 ngành tiêu biểu.
