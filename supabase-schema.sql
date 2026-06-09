-- SQL Schema cho dự án UniMatch
-- Truy cập Supabase Dashboard -> SQL Editor -> New Query -> Dán toàn bộ mã này vào và nhấn Run.

-- 1. Xóa các bảng cũ nếu tồn tại (để làm sạch dữ liệu cũ khi tạo lại)
DROP TABLE IF EXISTS cutoffs CASCADE;

DROP TABLE IF EXISTS universities CASCADE;

DROP TABLE IF EXISTS majors CASCADE;

DROP TABLE IF EXISTS categories CASCADE;

-- 2. Bảng danh mục ngành học
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL
);

-- 3. Bảng ngành học
CREATE TABLE majors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    careers TEXT[],
    salary TEXT,
    difficulty INT,
    employment INT,
    combos TEXT[]
);

-- 4. Bảng trường đại học
CREATE TABLE universities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    type TEXT CHECK (type IN ('public', 'private')),
    city TEXT NOT NULL,
    region TEXT CHECK (region IN ('north', 'central', 'south', 'all')),
    website TEXT DEFAULT '#',
    tuition INT,
    students TEXT,
    majors_count INT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    categories TEXT[]
);

-- 5. Bảng điểm chuẩn các năm
CREATE TABLE cutoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    university_id TEXT REFERENCES universities (id) ON DELETE CASCADE,
    major_id TEXT REFERENCES majors (id) ON DELETE CASCADE,
    year INT NOT NULL,
    cutoff_score DOUBLE PRECISION NOT NULL,
    UNIQUE (university_id, major_id, year)
);

-- Bật tính năng bảo mật hàng (Row Level Security - RLS) cho các bảng (Tùy chọn)
-- Đối với dự án thử nghiệm/đọc dữ liệu công khai, chúng ta cho phép Read công khai:
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

ALTER TABLE majors ENABLE ROW LEVEL SECURITY;

ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

ALTER TABLE cutoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on categories" ON categories FOR
SELECT USING (true);

CREATE POLICY "Allow public read access on majors" ON majors FOR
SELECT USING (true);

CREATE POLICY "Allow public read access on universities" ON universities FOR
SELECT USING (true);

CREATE POLICY "Allow public read access on cutoffs" ON cutoffs FOR
SELECT USING (true);

-- Tắt RLS để cho phép Client đọc dữ liệu công khai từ các bảng
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;

ALTER TABLE majors DISABLE ROW LEVEL SECURITY;

ALTER TABLE universities DISABLE ROW LEVEL SECURITY;

ALTER TABLE cutoffs DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- GIAI ĐOẠN B: AUTHENTICATION & USER PERSISTENCE
-- ==========================================

-- 1. Bảng lưu danh sách trường học đã thích (bookmarks) của người dùng
CREATE TABLE IF NOT EXISTS user_bookmarks (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (user_id, university_id)
);

-- 2. Bảng lưu bản nháp cấu hình nguyện vọng (form draft) của người dùng
CREATE TABLE IF NOT EXISTS user_drafts (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    draft_data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Kích hoạt Row Level Security (RLS) để bảo vệ dữ liệu người dùng
ALTER TABLE user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_drafts ENABLE ROW LEVEL SECURITY;

-- 4. Tạo các chính sách (Policies) để người dùng chỉ được quản lý dữ liệu của chính họ
CREATE POLICY "Users can manage their own bookmarks" ON user_bookmarks
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own drafts" ON user_drafts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);




-- =============XUAN DUC FIX =======
-- XUAN DUC SƯA DATA BÁE ==================
-- lam box chat _crypto_aead_det_decrypt
-- 1. Bảng phòng chat (Dùng cho cả chat 1-1 hoặc chat nhóm)

create table community_messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references auth.users(id) on delete set null,
  sender_email text not null, -- Lưu email hoặc tên để hiển thị nhanh
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

// phan quyen
-- 1. Bật tính năng Row Level Security (RLS) trên bảng community_messages
alter table public.community_messages enable row level security;
-- 2. Cho phép mọi người (kể cả khách chưa đăng nhập) đọc danh sách tin nhắn
create policy "Allow public read-only access"
on public.community_messages
for select
using (true);
-- 3. Chỉ cho phép tài khoản đã đăng nhập được quyền gửi tin nhắn mới
create policy "Allow authenticated users to insert"
on public.community_messages
for insert
to authenticated
with check (auth.uid() = sender_id);


-- kich hoat real time
alter publication supabase_realtime add table community_messages;



-- êdit database

-- SQL Script nâng cấp tính năng Chat Cộng Đồng cho UniMatch
-- Thực hiện: Mở Supabase Dashboard -> SQL Editor -> Tạo query mới -> Dán toàn bộ mã này vào và nhấn Run.

-- 1. Nâng cấp bảng community_messages hiện có nếu thiếu các cột cần thiết
CREATE TABLE IF NOT EXISTS community_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    sender_email TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE community_messages 
ADD COLUMN IF NOT EXISTS sender_name TEXT,
ADD COLUMN IF NOT EXISTS sender_avatar TEXT,
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES community_messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 2. Tạo bảng lưu trữ cảm xúc (reactions)
CREATE TABLE IF NOT EXISTS community_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES community_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    reaction_type TEXT NOT NULL, -- 'like' (👍), 'love' (❤️), 'haha' (😂), 'wow' (😮), 'sad' (😢)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (message_id, user_id, reaction_type)
);

-- 3. Vô hiệu hóa RLS để đảm bảo client có thể đọc ghi trực tiếp dễ dàng
ALTER TABLE community_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE community_reactions DISABLE ROW LEVEL SECURITY;

-- KICH HOAT REAALTIME
alter publication supabase_realtime add table community_messages;
alter publication supabase_realtime add table community_reactions;

--- === ẢNH GỬI ẢNH ====
-- 1. Tạo bucket lưu trữ ảnh tên là 'chat-attachments' dạng công khai (Public)
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

-- 2. Xóa chính sách bảo mật cũ nếu có để tránh xung đột
drop policy if exists "Allow public uploads" on storage.objects;
drop policy if exists "Allow public read" on storage.objects;

-- 3. Tạo chính sách RLS cho phép tải ảnh lên (Insert) công khai vào bucket này
create policy "Allow public uploads"
on storage.objects for insert
to public
with check (bucket_id = 'chat-attachments');

-- 4. Tạo chính sách RLS cho phép xem ảnh (Select) công khai từ bucket này
create policy "Allow public read"
on storage.objects for select
to public
using (bucket_id = 'chat-attachments');



