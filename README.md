# Habit Check-in

Web todo list theo ngày, check-in có bằng chứng (ảnh/video), tính tiền phạt tự động, theo dõi realtime từng người trong nhóm.

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite + Tailwind (shadcn-style) + SignalR client |
| Backend | ASP.NET Core (net8.0) Web API + SignalR + Hangfire |
| Database | PostgreSQL 16 |
| Đăng nhập | Google Sign-In (ID token) → JWT nội bộ + refresh cookie |
| Lưu media | Cloudinary (signed upload trực tiếp từ client) |
| Job định kỳ | Hangfire (storage Postgres) — chốt ngày 00:05, FINAL 12:00 |
| Triển khai | Docker Compose + Nginx |

## Tài liệu

- [`docs/habit-checkin-design.md`](docs/habit-checkin-design.md) — tài liệu thiết kế hệ thống đầy đủ.
- [`docs/api-contract.md`](docs/api-contract.md) — **contract API** (nguồn sự thật frontend ↔ backend).

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

### 1. Database

```bash
docker run -d --name habit-pg -e POSTGRES_DB=habit -e POSTGRES_USER=habit -e POSTGRES_PASSWORD=habit -p 5432:5432 postgres:16
```

### 2. Backend (http://localhost:5080)

```bash
cd apps/api
# sửa appsettings.Development.json: Google__ClientId, Jwt__Secret, Cloudinary__*
dotnet run --project src/HabitCheckin.Api
```

- Migration tự chạy khi khởi động (`Database.MigrateAsync`, có retry).
- Swagger: http://localhost:5080/swagger
- Hangfire dashboard (chỉ Development): http://localhost:5080/hangfire

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

| Key | Ở đâu | Ý nghĩa |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | deploy/.env, apps/web/.env, api appsettings.Development.json | Google OAuth Client ID (Web), thêm URI redirect của app |
| `JWT_SECRET` | deploy/.env, api | Bí mật ký JWT nội bộ (≥ 32 ký tự) |
| `CLOUDINARY_*` | deploy/.env, api | Cloud name + API key/secret + 2 upload preset **signed** (`habit_proof_signed`, `habit_avatar_signed`) |
| `DB_PASSWORD` | deploy/.env | Mật khẩu Postgres |

Tạo upload preset signed trong Cloudinary console: preset proof (folder `habit`, ảnh resize 1600px + `q_auto,f_auto`, video sinh thumbnail) và preset avatar (folder `avatars`).

## Quy tắc nghiệp vụ chính (tóm tắt)

- Mỗi user mỗi nhóm tạo 1 **challenge** (kỳ thử thách) có ngày bắt đầu/kết thúc; trong đó tự định nghĩa các **hoạt động** (DEADLINE mốc giờ / DURATION thời lượng / WINDOW khung giờ).
- Check-in/check-out **bắt buộc kèm ảnh hoặc video**. Giờ check-in lấy theo giờ **server** (`intent_at`), media phải upload xong trong 15 phút sau intent.
- Challenge **khoá toàn bộ hoạt động** từ 00:00 (giờ VN) ngày `start_date` — chặn cả ở API lẫn trigger DB.
- **00:05** hằng ngày: chốt ngày hôm qua `PROVISIONAL` (phiên DURATION chưa check-out → bỏ, không tính). **12:00**: chốt `FINAL`, ghi quỹ. Cửa sổ báo cáo/từ chối bằng chứng: tới 12:00 hôm sau.
- Bảng phạt theo **nhóm** (mặc định 0/20k/50k/70k, sau đó +20k/activity); hoạt động có `override_penalty` thì tính riêng, không đếm bậc.

## Chạy test

```bash
cd apps/api
dotnet build && dotnet test        # Domain + Application chạy mọi nơi; Integration cần Docker daemon (Postgres Testcontainers)
```

## Điểm còn mở (từ thiết kế §13)

1. Mức phạt riêng 10k cho "Dậy sớm" → đã hỗ trợ `override_penalty` theo hoạt động (mặc định trống = dùng bảng bậc).
2. `DURATION` cho phép nhiều phiên trong ngày (cộng dồn) — có.
3. Phiên quên check-out: không tính (`ABANDONED`).
4. Từ chối bằng chứng: chỉ Owner/Admin.
5. Chưa có tính năng ngày nghỉ phép (mở rộng sau).
