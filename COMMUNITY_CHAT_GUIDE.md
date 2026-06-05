# HƯỚNG DẪN KỸ THUẬT & CÀI ĐẶT HỆ THỐNG CHAT CỘNG ĐỒNG UNIMATCH

Tài liệu này hướng dẫn chi tiết về các tính năng đã phát triển, kiến trúc công nghệ áp dụng, các file sửa đổi và quy trình thiết lập cơ sở dữ liệu khi clone dự án về máy mới.

---

## 🌟 1. Tổng Quan & Các Tính Năng Đã Triển Khai

Hệ thống Chat Cộng Đồng được thiết kế theo phong cách giao diện **Neo-Brutalism** hiện đại, hoạt động thời gian thực (realtime) không độ trễ và hỗ trợ đầy đủ các tính năng trò chuyện nâng cao:

*   **Chat Realtime (Thời gian thực)**: Gửi và hiển thị tin nhắn tức thì không cần tải lại trang.
*   **Trạng thái hoạt động (Presence)**: Tự động hiển thị danh sách người dùng Online/Offline/Away. Trạng thái tự chuyển sang **Tạm vắng (Away)** nếu không có tương tác chuột/bàn phím sau 5 phút.
*   **Chỉ báo đang gõ (Typing Indicator)**: Hiển thị hiệu ứng ba chấm động "Nguyễn Văn A đang nhập..." khi đối phương đang gõ phím.
*   **Tương tác tin nhắn nâng cao**:
    *   **Phản hồi (Reply)**: Trích dẫn tin nhắn cũ, bấm vào trích dẫn sẽ cuộn mượt về tin nhắn gốc.
    *   **Chỉnh sửa (Edit)**: Sửa nội dung tin nhắn trong vòng 5 phút (kèm nhãn *Đã chỉnh sửa*).
    *   **Thu hồi (Recall)**: Xóa tin nhắn phía người gửi và hiển thị thông báo thu hồi.
    *   **Cảm xúc (Reactions)**: Thả và thống kê 5 loại emoji tương tác (👍, ❤️, 😂, 😮, 😢).
*   **Đính kèm tệp & Chụp ảnh**:
    *   Biểu tượng kẹp giấy `📎` mở hộp thoại chọn tệp hình ảnh trong máy (hoặc mở camera/thư viện ảnh trên điện thoại).
    *   Hỗ trợ **dán ảnh từ clipboard (Ctrl+V)** trực tiếp vào khung nhập để tải lên và gửi tức thì.
*   **Bảo mật & Trải nghiệm**:
    *   **Optimistic UI Updates**: Cập nhật tin nhắn lên màn hình ngay khi nhấn gửi (không đợi phản hồi mạng) giúp app cực kỳ snappy.
    *   **Bộ lọc từ tục tĩu (Profanity Filter)**: Tự động che các từ nhạy cảm thành `****`.
    *   **Chống spam**: Giới hạn tần suất gửi tin nhắn tối đa 1 tin nhắn/giây.

---

## 🛠️ 2. Công Nghệ Áp Dụng

1.  **Frontend**:
    *   **Next.js (App Router)** & **React Hook** (`useState`, `useEffect`, `useRef`).
    *   **Web Clipboard & File API**: Hỗ trợ bắt sự kiện `onPaste` và xử lý tệp ảnh nhị phân trực tiếp từ trình duyệt.
    *   **Neo-Brutalism CSS**: Sử dụng biến màu sắc CSS nguyên bản, đường viền dày đen (`border: 3px solid var(--ink)`), và đổ bóng góc cạnh (`box-shadow`).
2.  **Backend & Realtime (Supabase)**:
    *   **Supabase Database**: Lưu trữ dữ liệu tin nhắn và cảm xúc.
    *   **Supabase Realtime (Postgres Changes)**: Lắng nghe sự kiện `INSERT`, `UPDATE`, `DELETE` trên PostgreSQL WAL để phát sóng tới client.
    *   **Supabase Broadcast & Presence**: Quản lý tín hiệu gõ phím và trạng thái online của người dùng thông qua kết nối WebSocket hiệu năng cao.
    *   **Supabase Storage**: Lưu trữ hình ảnh đính kèm công khai (Public Bucket) với chính sách bảo mật RLS.

---

## 📂 3. Các File Đã Sửa Đổi/Tạo Mới

*   **`app/chat/page.js`** [MODIFY]: Chứa toàn bộ giao diện và logic phòng chat chính (Presence, upload ảnh, paste clipboard, emoji picker, xử lý realtime).
*   **`components/CommunityChatBox.js`** [MODIFY]: Sidebar chat box mini hiển thị đồng bộ tin nhắn đã thu hồi và các thông tin avatar người dùng mới.
*   **`css/components.css`** [MODIFY]: Bổ sung style Neo-Brutalism cho bong bóng chat, bảng chọn emoji, chỉ báo đang gõ, menu thao tác nằm trên 1 hàng ngang không bị rớt dòng.
*   **`lib/supabase.js`** [VIEW]: Cấu hình khởi tạo Supabase Client.

---

## 🚀 4. Hướng Dẫn Cài Đặt Cho Người Clone Dự Án

Khi clone dự án về máy tính mới, để chức năng Chat Cộng Đồng hoạt động đầy đủ, vui lòng làm theo các bước sau:

### Bước 1: Cấu hình biến môi trường
Tạo file `.env.local` ở thư mục gốc của dự án (nếu chưa có) và điền thông tin kết nối Supabase của bạn:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

### Bước 2: Tạo các bảng dữ liệu trong SQL Editor
Vào **Supabase Dashboard -> SQL Editor -> New Query**, copy và chạy đoạn mã tạo bảng sau:

```sql
-- 1. Tạo bảng lưu trữ tin nhắn chat
CREATE TABLE IF NOT EXISTS public.community_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    sender_avatar TEXT,
    content TEXT NOT NULL,
    reply_to_id UUID REFERENCES public.community_messages(id) ON DELETE SET NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tạo bảng lưu trữ cảm xúc (Reaction) của tin nhắn
CREATE TABLE IF NOT EXISTS public.community_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES public.community_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    reaction_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_message_user_reaction UNIQUE (message_id, user_id, reaction_type)
);

-- 3. Tắt RLS để tất cả mọi người có thể nhắn tin tự do (hoặc cấu hình RLS tuỳ nhu cầu dự án)
ALTER TABLE public.community_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reactions DISABLE ROW LEVEL SECURITY;
```

### Bước 3: Kích hoạt Realtime cho các bảng
Trong **SQL Editor**, chạy lệnh sau để kích hoạt tính năng phát tin nhắn thời gian thực:

```sql
-- Kiểm tra và tạo publication phát sóng Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

-- Đăng ký sạch sẽ các bảng vào Realtime
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS community_messages, community_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE community_messages, community_reactions;
```

### Bước 4: Tạo kho lưu trữ ảnh đính kèm (Storage Bucket)
Trong **SQL Editor**, chạy lệnh sau để tạo và phân quyền cho thư mục tải ảnh:

```sql
-- 1. Tạo bucket lưu trữ ảnh công khai tên 'chat-attachments'
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

-- 2. Xoá chính sách bảo mật cũ nếu có tránh xung đột
drop policy if exists "Allow public uploads" on storage.objects;
drop policy if exists "Allow public read" on storage.objects;

-- 3. Cấp quyền upload ảnh cho mọi người dùng
create policy "Allow public uploads"
on storage.objects for insert
to public
with check (bucket_id = 'chat-attachments');

-- 4. Cấp quyền xem ảnh cho mọi người dùng
create policy "Allow public read"
on storage.objects for select
to public
using (bucket_id = 'chat-attachments');
```

### Bước 5: Chạy dự án
Mở terminal tại thư mục dự án và chạy các lệnh:
```bash
# Cài đặt thư viện (nếu chưa cài)
npm install

# Khởi động môi trường phát triển
npm run dev
```

Truy cập địa chỉ `http://localhost:3000/chat` để kiểm tra hoạt động.
