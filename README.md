# Trg and you — English Listening & Shadowing Studio

Ứng dụng web học tiếng Anh qua video hoạt hình, tập trung vào kỹ năng **Nghe hiểu & Luyện nói Shadowing**, tự động tách câu thoại đồng bộ thời gian thực và sinh phiên âm **IPA** nối âm tự nhiên bằng AI.

---

## Tính năng chính

- **Xác thực & Phân quyền đơn giản**:
  - Đăng nhập / Đăng ký bằng `username` và `password` (JWT lưu trong HttpOnly cookie qua `jose` + `bcryptjs`).
  - Phân quyền `ADMIN` (quản lý bài học) và `USER` (học viên).
  - Trang quản lý tài khoản cá nhân (`/account`): đổi tên đăng nhập và đổi mật khẩu.
- **Quản trị bài học & Upload tối ưu (`/admin`)**:
  - Upload trực tiếp video (`.mp4`, `.mkv`, `.webm`) từ trình duyệt lên **Cloudflare R2** bằng Presigned URL kèm thanh tiến độ `%`.
  - Backend tự động tải tạm video về thư mục temp, tách âm thanh `.mp3` nhẹ (mono, 16kHz, 48kbps) bằng `ffmpeg-static` + `fluent-ffmpeg`, sau đó gửi tới **Gemini (`gemini-3.8-flash`)** với Structured Outputs để tách từng câu thoại (`startTime`, `endTime`, `speaker`, `text`, `ipa`) và lưu vào SQLite.
  - Hỗ trợ chỉnh sửa tiêu đề/mô tả bài học và xóa đồng bộ cả SQLite lẫn file trên Cloudflare R2.
- **Thư viện bài học (`/`)**:
  - Hiển thị danh sách bài học với khung hình preview thực tế từ video, thời lượng, số câu thoại và thanh tìm kiếm nhanh.
- **Phòng học Shadowing tương tác (`/learn/[videoId]`)**:
  - Tự động tải và phát video khi vào bài học.
  - Điều chỉnh tốc độ phát (`0.75x`, `1.0x`, `1.25x`).
  - Chế độ **Lặp lại câu hiện tại (Loop Sentence)** phục vụ luyện Shadowing.
  - Phím tắt nhanh: `Space` (Phát/Tạm dừng), `←` / `→` (Chuyển câu trước/sau).
  - Phụ đề đồng bộ thời gian thực, tự động highlight & cuộn mượt câu đang nói vào giữa màn hình, bật/tắt phiên âm IPA, bấm vào từng câu để tua và nghe lại ngay lập tức.
  - **Ghi chú cá nhân**: chèn nhanh mốc thời gian hiện tại (`[MM:SS]`) và tự động lưu (auto-save debounce).

---

## Công nghệ sử dụng

- **Frontend / Fullstack**: Next.js 16 (App Router, TypeScript), Tailwind CSS v4, `lucide-react`
- **Database & ORM**: SQLite + Prisma ORM (`prisma`, `@prisma/client`)
- **Authentication**: `jose` (JWT HttpOnly Cookie), `bcryptjs`
- **Object Storage**: Cloudflare R2 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- **Media & AI**: `fluent-ffmpeg`, `ffmpeg-static`, `@google/genai` (`gemini-3.8-flash`)

---

## Yêu cầu chuẩn bị

1. **Node.js** `>= 20`
2. **Google Gemini API Key** (từ [Google AI Studio](https://aistudio.google.com/))
3. **Cloudflare R2 Bucket**:
   - Bật **Public Development URL** (hoặc custom domain) để lấy `R2_PUBLIC_URL`.
   - Tạo **R2 API Token** với quyền Object Read & Write cho bucket.
   - Cấu hình **CORS Policy** trong `Bucket -> Settings -> CORS Policy`:
     ```json
     [
       {
         "AllowedOrigins": [
           "http://localhost:3000"
         ],
         "AllowedMethods": [
           "GET",
           "PUT",
           "POST",
           "DELETE",
           "HEAD"
         ],
         "AllowedHeaders": [
           "*"
         ],
         "ExposeHeaders": [
           "ETag"
         ],
         "MaxAgeSeconds": 3600
       }
     ]
     ```
     *(Khi deploy lên domain thật, hãy thêm `https://your-domain.com` vào `AllowedOrigins`.)*

---

## Cài đặt & Chạy Local

```bash
# 1. Cài đặt dependencies
npm install

# 2. Tạo file .env từ mẫu và điền đầy đủ giá trị
cp .env.example .env

# 3. Khởi tạo database SQLite và generate Prisma Client
npx prisma db push
npx prisma generate

# 4. Tạo tài khoản Admin mặc định (đọc từ ADMIN_USERNAME & ADMIN_PASSWORD trong .env)
npx prisma db seed

# 5. Chạy môi trường phát triển
npm run dev
```

Truy cập `http://localhost:3000`.

### Các biến môi trường (`.env`)

Xem chi tiết tại [`.env.example`](.env.example):

| Biến | Mô tả |
| :--- | :--- |
| `DATABASE_URL` | Đường dẫn SQLite, vd: `"file:./dev.db"` |
| `JWT_SECRET` | Chuỗi bí mật ký JWT (nên >= 32 ký tự ngẫu nhiên) |
| `ADMIN_USERNAME` | Tên đăng nhập tài khoản Admin khởi tạo bởi seed |
| `ADMIN_PASSWORD` | Mật khẩu tài khoản Admin khởi tạo bởi seed |
| `GEMINI_API_KEY` | API Key của Google Gemini |
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | R2 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 Secret Access Key |
| `R2_BUCKET_NAME` | Tên bucket R2 |
| `R2_PUBLIC_URL` | Public URL của bucket R2 (vd: `https://pub-xxx.r2.dev`) |

---

## Kiểm tra trước khi Push GitHub

- Tệp `.env` và các tệp database SQLite (`*.db`, `*.db-journal`) đã được loại trừ trong `.gitignore` để không lộ thông tin nhạy cảm.
- Chạy kiểm tra TypeScript và build production:
  ```bash
  npx tsc --noEmit
  npm run build
  ```

### Push lên GitHub

```bash
git init
git add .
git commit -m "feat: initial Trg and you english shadowing web app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

---

## Hướng dẫn Deploy (Phục vụ 2–3 người dùng)

> **Lưu ý quan trọng:** Ứng dụng sử dụng **SQLite** (lưu file cục bộ `dev.db`) và **FFmpeg** (`ffmpeg-static`) để tách âm thanh video trong tối đa 300 giây. Vì vậy **không phù hợp deploy lên Vercel Serverless** (filesystem không lưu trữ bền vững cho SQLite và giới hạn thời gian chạy ngắn).

### Lựa chọn 1: Render hoặc Railway (Nhanh, ít cấu hình)
Phù hợp nếu bạn muốn deploy thẳng từ GitHub và gắn 1 ổ đĩa lưu trữ (Persistent Disk / Volume) cho SQLite:
1. Tạo Web Service kết nối với repo GitHub.
2. Gắn một **Persistent Disk/Volume** (ví dụ mount vào `/data`) và đặt `DATABASE_URL="file:/data/dev.db"`.
3. Thêm toàn bộ biến môi trường vào mục Environment Variables của nền tảng.
4. Build Command:
   ```bash
   npm ci && npx prisma generate && npm run build
   ```
5. Start Command:
   ```bash
   npx prisma db push && npx prisma db seed && npm run start
   ```
6. Cập nhật `AllowedOrigins` trong CORS Policy của Cloudflare R2 thêm domain deploy (`https://...`).

### Lựa chọn 2: VPS (DigitalOcean / Vultr / Hetzner / Vietnix ~ 4–5$/tháng)
Phù hợp nếu muốn ổn định nhất, không bị ngủ đông (cold start) và toàn quyền sao lưu file SQLite:
1. Cài đặt Node.js 20+, `pm2` và `caddy` (hoặc `nginx`).
2. Clone repo, tạo `.env` sản phẩm với `DATABASE_URL="file:./dev.db"`.
3. Chạy setup & build:
   ```bash
   npm ci
   npx prisma db push
   npx prisma db seed
   npm run build
   pm2 start npm --name "trg-and-you" -- start
   pm2 save
   ```
4. Cấu hình Caddy làm reverse proxy kèm HTTPS tự động:
   ```caddyfile
   your-domain.com {
       reverse_proxy localhost:3000
   }
   ```
5. Thêm `https://your-domain.com` vào `AllowedOrigins` trong CORS Policy của Cloudflare R2.
