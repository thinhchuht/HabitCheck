# Habit Check-in

Web todo list theo ngày, check-in có bằng chứng (ảnh/video), tính tiền phạt tự động, theo dõi realtime từng người trong nhóm.

| Thành phần  | Công nghệ                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------ |
| Frontend    | React 18 + TypeScript + Vite + Tailwind (shadcn-style) + SignalR client                    |
| Backend     | ASP.NET Core (net8.0) Web API + SignalR + Hangfire                                         |
| Database    | PostgreSQL 16                                                                              |
| Đăng nhập   | Google Sign-In (ID token) **hoặc username/mật khẩu (admin)** → JWT nội bộ + refresh cookie |
| Lưu media   | Cloudinary (signed upload trực tiếp từ client)                                             |
| Job định kỳ | Hangfire (storage Postgres) — chốt ngày 00:05, FINAL 12:00                                 |
| Triển khai  | Docker Compose + Nginx                                                                     |

## Tài liệu

- [`docs/habit-checkin-design.md`](docs/habit-checkin-design.md) — tài liệu thiết kế hệ thống đầy đủ (quy tắc nghiệp vụ, DB, logic C# cốt lõi, triển khai).
- [`docs/api-contract.md`](docs/api-contract.md) — **contract API** (nguồn sự thật frontend ↔ backend).

## Tổng quan tính năng

- **Nhiều nhóm**: user tạo/tham gia nhiều nhóm bằng mã mời, tự do chuyển nhóm ở thanh trái (badge số việc chưa làm hôm nay từng nhóm). Sau đăng nhập tự vào nhóm đầu tiên chưa hết hạn — không cần chọn thủ công.
- **Kỳ thử thách (challenge)**: mỗi user mỗi nhóm 1 kỳ có ngày bắt đầu/kết thúc, trong đó định nghĩa các hoạt động:
  - `DEADLINE` — mốc giờ, chỉ nhận check-in trong **cửa sổ ±5 phút** quanh mốc;
  - `DURATION` — thời lượng mục tiêu, **tick + 1 ảnh**, 1 check-in/ngày;
  - `WINDOW` — check-in trong khung giờ.
- **Bằng chứng bắt buộc**: mỗi check-in kèm 1 ảnh hoặc video. Giờ check-in lấy theo **server** (`intent_at`), media phải upload xong trong 15 phút sau intent. **Không có bước duyệt** — bằng chứng hợp lệ ngay khi upload.
- **Phạt**: bảng bậc theo nhóm (mặc định 0/20k/50k/70k, sau đó +20k/activity), chủ nhóm chỉnh được. **Không có phạt riêng theo hoạt động.**
- **Cheat day (1/tuần/nhóm)**: user tự đánh dấu 1 ngày miễn phạt (hôm nay → +7 ngày, huỷ được trong hôm đó).
- **Realtime (SignalR)**: live board trạng thái từng thành viên + ticker hoạt động mới nhất + tổng phạt dự kiến hôm nay; thông báo toàn hệ thống (admin broadcast, toast).
- **Thống kê & quỹ**: thống kê cá nhân + lịch nhiệt + leaderboard nhóm; quỹ phạt theo nhóm, owner ghi nhận đóng tiền.
- **Khu admin** (`/admin`, login bằng username/mật khẩu): Tổng quan · User (chặn/bỏ chặn, cấp quyền, đổi tên, đặt lại mật khẩu) · Nhóm · Kỳ/hoạt động · Quỹ · Thống kê · Vận hành (trạng thái 5 job Hangfire, chạy lại settle/finalize/activate theo ngày — chỉ Development, gửi thông báo, audit log).

## Cấu trúc

```
habit-checkin/
├── apps/
│   ├── web/                      # React SPA
│   └── api/                      # .NET solution (Clean Architecture)
│       ├── src/
│       │   ├── HabitCheckin.Domain/            # Entity, enum, PenaltyCalculator, ActivityEvaluator
│       │   ├── HabitCheckin.Application/       # Use case (MediatR), DTO, validator
│       │   ├── HabitCheckin.Infrastructure/    # EF Core, Cloudinary, Google/JWT, Hangfire, SignalR
│       │   └── HabitCheckin.Api/               # Controllers, LiveHub, middleware
│       └── tests/                  # Domain.Tests, Application.Tests, Api.IntegrationTests (Testcontainers)
├── deploy/
│   ├── docker-compose.yml
│   ├── nginx/default.conf
│   └── .env.example
└── .github/workflows/ci.yml
```

## Chạy local (dev)

### 1. Database (port 5434 — khớp `appsettings.Development.json`)

```bash
docker run -d --name habit-dev-pg -e POSTGRES_DB=habit -e POSTGRES_USER=habit -e POSTGRES_PASSWORD=habit -p 5434:5432 postgres:16
```

### 2. Backend (http://localhost:5080)

```bash
cd apps/api
# appsettings.Development.json đã có giá trị dev (Google ClientId, Jwt secret, Cloudinary)
dotnet run --project src/HabitCheckin.Api
```

- Migration tự chạy khi khởi động (`Database.MigrateAsync`, có retry).
- Swagger: http://localhost:5080/swagger
- Hangfire dashboard: http://localhost:5080/hangfire — **nội bộ**, nginx (production) không proxy đường dẫn này.
- **Tài khoản admin**: seeder tự tạo khi API khởi động (`Admin:Username`, mặc định `thinhchuht`); mật khẩu đưa qua `Admin:Password` (env/appsettings) khi khởi động để xoay — repo chỉ chứa hash PBKDF2, không có plaintext.

### 3. Frontend (http://localhost:5173)

```bash
cd apps/web
copy .env.example .env   # điền VITE_GOOGLE_CLIENT_ID
npm install
npm run dev
```

Vite proxy `/api` và `/hubs` về `http://localhost:5080` (same-origin → refresh cookie hoạt động).

## Chạy production (Docker)

```bash
cp deploy/.env.example deploy/.env   # điền đủ key
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Truy cập http://localhost:8080 (Nginx proxy: `/` → web, `/api` + `/hubs` → api).

## Cần cấu hình

| Key                | Ở đâu                                                        | Ý nghĩa                                                                                                |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `GOOGLE_CLIENT_ID` | deploy/.env, apps/web/.env, api appsettings.Development.json | Google OAuth Client ID (Web), thêm URI redirect của app                                                |
| `JWT_SECRET`       | deploy/.env, api                                             | Bí mật ký JWT nội bộ (≥ 32 ký tự)                                                                      |
| `CLOUDINARY_*`     | deploy/.env, api                                             | Cloud name + API key/secret + 2 upload preset **signed** (`habit_proof_signed`, `habit_avatar_signed`) |
| `DB_PASSWORD`      | deploy/.env                                                  | Mật khẩu Postgres                                                                                      |

Tạo upload preset signed trong Cloudinary console: preset proof (folder `habit`, ảnh resize 1600px + `q_auto,f_auto`, video sinh thumbnail) và preset avatar (folder `avatars`).

## Quy tắc nghiệp vụ chính (tóm tắt)

- Mỗi user mỗi nhóm tạo 1 **challenge** (kỳ thử thách) có ngày bắt đầu/kết thúc; trong đó tự định nghĩa các **hoạt động** (DEADLINE mốc giờ ±5 phút / DURATION tick + 1 ảnh / WINDOW khung giờ).
- Check-in **bắt buộc kèm ảnh hoặc video**. Giờ check-in lấy theo giờ **server** (`intent_at`), media phải upload xong trong 15 phút sau intent. DEADLINE chỉ nhận check-in trong **±5 phút** quanh mốc giờ (ngoài khung → 422).
- Challenge **khoá toàn bộ hoạt động** từ 00:00 (giờ VN) ngày `start_date` — chặn cả ở API lẫn trigger DB.
- Bảng phạt theo **nhóm** (mặc định 0/20k/50k/70k, sau đó +20k/activity), chủ nhóm chỉnh được. **Không có phạt riêng theo hoạt động.**
- **Cheat day (1/tuần/nhóm)**: đánh dấu hôm nay → +7 ngày, huỷ được trong hôm đó; ngày cheat không cần check-in, 0 phạt, không ghi sổ quỹ.
- **00:05** hằng ngày: chốt ngày hôm qua `PROVISIONAL`. **12:00**: chốt `FINAL`, ghi quỹ. Không có cửa sổ duyệt bằng chứng — bằng chứng hợp lệ ngay khi upload.
- Phiên `DURATION` OPEN cũ (tạo trước thay đổi "tick + 1 ảnh") quên check-out → tự đóng `ABANDONED`, không tính.

## Chạy test

```bash
cd apps/api
dotnet build && dotnet test        # Domain + Application chạy mọi nơi; Integration cần Docker daemon (Postgres Testcontainers)
```

## Điểm còn mở (từ thiết kế §13)

1. ~~Mức phạt riêng 10k cho "Dậy sớm"~~ → **Đã chốt: bỏ** — chỉ dùng bảng bậc nhóm (`override_penalty` đã xoá khỏi code + DB).
2. ~~`DURATION` chia nhiều phiên trong ngày~~ → **Đã chốt: không** — tick + 1 ảnh, 1 check-in/ngày.
3. ~~Phiên quên check-out~~ → không còn check-out; phiên OPEN cũ tự đóng `ABANDONED` khi chốt ngày.
4. ~~Ai được từ chối bằng chứng~~ → **Đã chốt: không còn bước duyệt/từ chối** — bằng chứng hợp lệ ngay khi upload.
5. Ngày nghỉ phép (miễn phạt)? → chưa có; cheat day (1/tuần, 0 phạt) là phương án thay thế một phần.
