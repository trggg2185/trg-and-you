# Hướng dẫn chọn nơi & cách Deploy Miễn Phí (2–3 người dùng)

Ứng dụng **Trg and you** có 2 đặc điểm kỹ thuật quan trọng cần lưu ý khi chọn nơi deploy:
1. **Dữ liệu hiện lưu bằng SQLite** (`prisma/dev.db`) — cần ổ đĩa lưu trữ bền vững (Persistent Disk), nếu chạy trên nền tảng xóa ổ đĩa sau mỗi lần khởi động lại thì dữ liệu user/bài học sẽ mất.
2. **Backend xử lý FFmpeg (`ffmpeg-static`) + gọi Gemini AI** — cần môi trường Node.js có thể chạy tiến trình tách âm thanh `.mp3` (tối đa ~60–300 giây) và đủ RAM (khuyên dùng từ 512MB–1GB trở lên).

> **Vì sao không dùng Vercel Free?** Vercel là Serverless không giữ được file SQLite `dev.db`, đồng thời giới hạn thời gian chạy API (timeout) và dung lượng bundle không phù hợp để chạy `ffmpeg-static`.

---

## Bảng so sánh nhanh các lựa chọn Miễn Phí

| Phương án | Chi phí | Cần thẻ Visa? | Lưu SQLite an toàn? | Độ ổn định FFmpeg | Độ khó |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. Cloudflare Tunnel** (chạy từ máy cá nhân) | **0đ** | Không | Rất tốt | Rất mạnh | Rất dễ |
| **2. Oracle Cloud / GCP Always Free VPS** | **0đ** | Có (xác minh) | Rất tốt | Rất mạnh | Trung bình |
| **3. Render Free + Neon PostgreSQL** *(nâng cấp DB)* | **0đ** | Không | Tốt (dùng Postgres) | Trung bình (512MB RAM) | Dễ |

---

## Phương án 1: Cloudflare Tunnel (Miễn phí 100%, dễ nhất, không sửa code)

Phù hợp nhất cho nhóm **2–3 người học cùng nhau** khi bạn có sẵn máy tính/laptop/mini-PC bật lúc cần học, hoặc máy chạy thường xuyên.
- **Ưu điểm:** Không tốn tiền thuê server, không cần thẻ tín dụng, FFmpeg chạy cực nhanh, giữ nguyên 100% SQLite, có sẵn HTTPS bảo mật.
- **Nhược điểm:** Máy tính chạy server phải đang bật thì người khác mới truy cập được.

### Các bước thực hiện
1. **Build ứng dụng ở chế độ production:**
   ```powershell
   npx prisma db push
   npx prisma db seed
   npm run build
   npm run start
   ```
   *(Ứng dụng sẽ chạy tại `http://localhost:3000`.)*

2. **Tải và chạy Cloudflare Tunnel (`cloudflared`):**
   - Cài `cloudflared` trên Windows (qua `winget` hoặc tải từ Cloudflare):
     ```powershell
     winget install --id Cloudflare.cloudflared
     ```
   - **Chạy thử nhanh (link tạm miễn phí, không cần tên miền):**
     ```powershell
     cloudflared tunnel --url http://localhost:3000
     ```
     Terminal sẽ in ra một đường dẫn dạng `https://xxxx.trycloudflare.com`. Gửi link này cho bạn bè là học được ngay.
   - *(Khuyên dùng nếu có tên miền riêng ~ 100k–200k/năm)*: Tạo **Zero Trust Tunnel** cố định trên Cloudflare Dashboard trỏ về `http://localhost:3000` để có link cố định vĩnh viễn (vd: `https://learn.yourdomain.com`).

3. **Cập nhật CORS trên Cloudflare R2:**
   - Thêm domain tunnel (`https://xxxx.trycloudflare.com` hoặc `https://learn.yourdomain.com`) vào `AllowedOrigins` trong CORS Policy của bucket R2.

---

## Phương án 2: VPS Miễn Phí Trọn Đời (Oracle Cloud Always Free / Google Cloud `e2-micro`)

Phù hợp nếu bạn muốn web chạy **24/7 trên cloud hoàn toàn miễn phí** và giữ nguyên kiến trúc SQLite + FFmpeg.
- **Oracle Cloud Always Free:** Tặng máy ảo Ubuntu miễn phí trọn đời (lên tới 4 vCPU ARM, 24GB RAM hoặc AMD 1GB RAM) — chạy cực kỳ dư dả. *(Lưu ý: cần thẻ Visa/Mastercard để xác minh danh tính lúc đăng ký, không trừ tiền duy trì nếu chỉ tạo máy trong mục Always Free).*
- **Google Cloud Free Tier:** Tặng 1 máy `e2-micro` (1GB RAM, vùng US) miễn phí trọn đời.

### Các bước cài đặt trên Ubuntu VPS
1. **SSH vào VPS và cài Node.js 20, PM2, Caddy:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs git
   sudo npm install -g pm2

   # Cài Caddy (tự động cấp chứng chỉ SSL HTTPS miễn phí)
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update && sudo apt install -y caddy
   ```

2. **Clone code từ GitHub và cấu hình `.env`:**
   ```bash
   git clone https://github.com/<your-username>/<your-repo>.git trg-and-you
   cd trg-and-you
   cp .env.example .env
   nano .env   # Điền đầy đủ biến môi trường thật
   ```

3. **Khởi tạo DB, build và chạy ngầm bằng PM2:**
   ```bash
   npm ci
   npx prisma db push
   npx prisma db seed
   npm run build
   pm2 start npm --name "trg-and-you" -- start
   pm2 save
   pm2 startup
   ```

4. **Mở cổng 80/443 và cấu hình Caddy HTTPS:**
   - Mở port `80` và `443` trong Firewall/Security List của VPS.
   - Sửa `/etc/caddy/Caddyfile`:
     ```caddyfile
     your-domain.com {
         reverse_proxy localhost:3000
     }
     ```
   - Khởi động lại Caddy:
     ```bash
     sudo systemctl reload caddy
     ```
   *(Nếu chưa có tên miền, có thể trỏ tên miền miễn phí dạng `sslip.io` hoặc DuckDNS tới IP VPS để Caddy vẫn cấp được HTTPS.)*

5. **Cập nhật CORS trên Cloudflare R2:**
   - Thêm `https://your-domain.com` vào `AllowedOrigins` của bucket R2.

---

## Phương án 3: Render Free + Neon PostgreSQL (Không cần thẻ, không cần mở máy ở nhà)

> **Lưu ý quan trọng:** Gói **Render Free** không hỗ trợ ổ đĩa lưu trữ bền vững cho SQLite (mất dữ liệu khi server ngủ/redeploy), có giới hạn **512MB RAM**, tự ngủ sau **15 phút** không có người truy cập và giới hạn timeout HTTP khoảng **100 giây**. Để dùng miễn phí trên Render mà **không mất dữ liệu**, cần chuyển Database từ SQLite sang **PostgreSQL miễn phí của Neon**.

### Bước 1: Tạo Database PostgreSQL miễn phí trên Neon
1. Truy cập [neon.tech](https://neon.tech) và đăng nhập bằng **GitHub**.
2. Chọn **New Project**:
   - **Project name:** `trg-and-you`
   - **Postgres version:** mặc định (16/17)
   - **Region:** chọn gần Việt Nam nhất (ví dụ **Singapore - `ap-southeast-1`**) để tốc độ truy vấn nhanh nhất.
3. Sau khi tạo xong, bấm **Connect** → copy chuỗi **Connection string** (dạng):
   ```text
   postgresql://neondb_owner:xxxxxxxx@ep-xxxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   *(Lưu giữ chuỗi này để dán vào biến `DATABASE_URL` trên Render ở Bước 3).*

### Bước 2: Chuyển Prisma sang PostgreSQL và Push lên GitHub
1. Mở [`prisma/schema.prisma`](prisma/schema.prisma), sửa dòng `provider`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
   *(Tất cả các bảng `User`, `Video`, `Subtitle`, `Note` đã dùng kiểu dữ liệu chuẩn nên không cần sửa thêm gì khác).*
2. Kiểm tra file `.gitignore` đảm bảo không push `.env` và `*.db`, rồi commit & push lên GitHub:
   ```bash
   git add .
   git commit -m "chore: switch prisma datasource to postgresql for deploy"
   git push origin main
   ```

### Bước 3: Tạo Web Service miễn phí trên Render
1. Truy cập [dashboard.render.com](https://dashboard.render.com) → đăng nhập bằng **GitHub**.
2. Chọn **New + → Web Service** → chọn repository GitHub của bạn.
3. Điền các thông số sau:
   - **Name:** `trg-and-you` (URL sẽ là `https://trg-and-you.onrender.com`)
   - **Region:** **Singapore** (cùng vùng với Neon để giảm độ trễ)
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Instance Type:** **Free** ($0/month)
   - **Build Command:**
     ```bash
     npm ci --include=dev && npx prisma generate && npm run build
     ```
     *(Dùng `--include=dev` để chắc chắn `prisma`, `tsx`, `typescript` luôn được cài đầy đủ lúc build).*
   - **Start Command:**
     ```bash
     npx prisma db push --accept-data-loss && npx prisma db seed && npm run start
     ```
     *(Tự động đồng bộ bảng/cột mới trên Neon kể cả khi thêm `@unique` index như `googleId`/`email` trong môi trường non-interactive mà vẫn giữ nguyên dữ liệu cũ, tạo sẵn Admin nếu chưa có và khởi chạy Next.js. Lưu ý: KHÔNG dùng `--force-reset`.)*
4. Kéo xuống mục **Environment Variables**, bấm **Add Environment Variable** và thêm đầy đủ các biến sau (lấy giá trị từ `.env` của bạn, riêng `DATABASE_URL` dùng chuỗi Neon ở Bước 1):
   - `DATABASE_URL` = `postgresql://...` *(chuỗi Neon ở Bước 1)*
   - `JWT_SECRET` = `<chuỗi bí mật trong .env>`
   - `ADMIN_USERNAME` = `<tên đăng nhập admin>`
   - `ADMIN_PASSWORD` = `<mật khẩu admin>`
   - `GEMINI_API_KEY` = `<API key Gemini>`
   - `R2_ACCOUNT_ID` = `<Account ID R2>`
   - `R2_ACCESS_KEY_ID` = `<Access Key R2>`
   - `R2_SECRET_ACCESS_KEY` = `<Secret Key R2>`
   - `R2_BUCKET_NAME` = `<Tên bucket R2>`
   - `R2_PUBLIC_URL` = `<Public URL R2>`
   *(Lưu ý: Không cần tự thêm `NODE_ENV=production` trong danh sách biến môi trường để tránh xung đột lúc cài package; Render tự bật production khi chạy).*
5. Bấm **Create Web Service** và chờ ~3–5 phút để Render build và khởi chạy lần đầu.

### Bước 4: Cập nhật CORS trên Cloudflare R2
Sau khi Render deploy xong và có URL dạng `https://trg-and-you.onrender.com`:
1. Vào **Cloudflare Dashboard → R2 → chọn Bucket → Settings → CORS Policy**.
2. Thêm domain Render vào `AllowedOrigins`:
   ```json
   [
     {
       "AllowedOrigins": [
         "http://localhost:3000",
         "https://trg-and-you.onrender.com"
       ],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

### Lưu ý khi vận hành trên Render Free
- **Ngủ đông (Cold Start):** Nếu 15 phút không có ai vào, Render Free sẽ tạm ngủ; lượt truy cập đầu tiên sau đó mất khoảng 30–50 giây để khởi động lại.
- **Giới hạn 512MB RAM & Timeout ~100s:** Nên upload các video hoạt hình ngắn (khoảng **1–4 phút**, dung lượng dưới **~50MB**) để quá trình tách âm thanh FFmpeg + gọi Gemini hoàn tất nhanh trong vòng 20–60 giây, không bị quá tải RAM hay timeout.
- **Dữ liệu cũ trên local SQLite:** Khi chuyển sang Neon PostgreSQL, database mới trên cloud sẽ trống (chỉ có tài khoản Admin được seed sẵn). Bạn có thể vào `/admin` trên bản deploy để upload video, hoặc giữ lại nếu các video trước đó chỉ là test.

---

## Khuyến nghị chọn nhanh

- **Không muốn động vào cấu hình server, chỉ cần 2–3 người học cùng nhau:** Chọn **Phương án 1 (Cloudflare Tunnel)**.
- **Muốn web chạy 24/7 trên cloud mà vẫn giữ nguyên SQLite + FFmpeg khỏe:** Chọn **Phương án 2 (Oracle Cloud Always Free)**.
- **Không có thẻ Visa và vẫn muốn chạy trên cloud:** Chọn **Phương án 3 (Render Free + Neon PostgreSQL)**.
