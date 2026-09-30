# API Contract — Habit Check-in (v1)

> **Tài liệu này là nguồn sự thật duy nhất (single source of truth) cho contract frontend ↔ backend.**
> Backend và frontend BẮT BUỘC khớp 100% với tài liệu này. Thiết kế nghiệp vụ: xem `docs/habit-checkin-design.md`.

## 0. Quy ước chung

- Base URL: `/api` (frontend gọi relative, dev proxy về `http://localhost:5080`).
- JSON: `camelCase`. Tiền: số nguyên VND (đ).
- Datetime: ISO-8601 UTC, ví dụ `"2026-09-25T18:05:00Z"`. Date: `"2026-09-25"`. Time: `"06:00"`.
- Auth: `Authorization: Bearer <accessToken>` (JWT 15 phút). Refresh token: cookie httpOnly tên `hc_refresh`, `Secure; SameSite=Strict; Path=/api/auth`, 30 ngày, xoay vòng (rotation) mỗi lần refresh.
- Lỗi: RFC 7807 `ProblemDetails`:

  ```json
  {
    "type": "https://.../validation",
    "title": "Dữ liệu không hợp lệ",
    "status": 400,
    "detail": "...",
    "errors": { "fieldName": ["thông báo"] }
  }
  ```

  - `400` validation (kèm `errors`), `401` chưa đăng nhập/token hết hạn, `403` không có quyền, `404` không tìm thấy, `409` xung đột (challenge chồng ngày, thành viên tồn tại, đã check-in trong ngày...), `422` vi phạm nghiệp vụ (challenge đã khoá, intent hết hạn, ngoài cửa sổ check-in ±5 phút của DEADLINE...).
  - `detail` viết bằng **tiếng Việt**.

- Enum (giá trị chuỗi):
  - `ActivityType`: `DEADLINE` | `DURATION` | `WINDOW`
  - `ProofType`: `PHOTO` | `VIDEO` | `ANY`
  - `ChallengeStatus`: `DRAFT` | `ACTIVE` | `COMPLETED` | `CANCELLED`
  - `CheckInStatus`: `OPEN` | `COMPLETED` | `ABANDONED` | `REJECTED`
  - `ResultStatus`: `PROVISIONAL` | `FINAL`
  - `MemberRole`: `OWNER` | `ADMIN` | `MEMBER`
  - Lý do fail (`failReason`/`reason`): `LATE` | `MISSING` | `INSUFFICIENT` | `REJECTED`
  - `LedgerKind`: `PENALTY` | `PAYMENT` | `ADJUSTMENT`
- Bậc phạt mặc định của nhóm: `{ "tiers": [0, 20000, 50000, 70000], "extraPerActivity": 20000 }`.
- Múi giờ hiển thị/luận: `Asia/Ho_Chi_Minh` (UTC+7, cố định).

## 1. DTOs

```ts
UserDto = {
  id: string; googleSub: string; email: string;
  displayName: string; avatarUrl: string | null;
  reminder: { deadlineAheadMinutes: number | null; endOfDayReminder: boolean };
  createdAt: string; lastLoginAt: string | null;
}

MediaDto = {
  publicId: string; url: string; thumbnailUrl: string | null;
  type: "image" | "video"; bytes: number | null;
}

MemberDto = {
  userId: string; displayName: string; avatarUrl: string | null;
  role: MemberRole; joinedAt: string;
}

GroupDto = {
  id: string; name: string; inviteCode: string; ownerId: string;
  penaltyTiers: { tiers: number[]; extraPerActivity: number };
  reviewWindowHours: number; createdAt: string;
  members: MemberDto[];
}

ActivityDto = {
  id: string; challengeId: string;
  name: string; description: string | null; icon: string | null; // icon: emoji hoặc tên icon
  type: ActivityType;
  deadlineTime: string | null; graceMinutes: number;      // DEADLINE — không còn dùng (cửa sổ ±5 phút cố định), giữ cho tương thích DB
  targetMinutes: number | null; // DURATION: thời lượng mục tiêu (phút, hiển thị); check-in là tick + 1 ảnh
  minSessionMinutes: number | null; // deprecated — luôn null với hoạt động mới
  windowStart: string | null; windowEnd: string | null;   // WINDOW
  proofType: ProofType;
  sortOrder: number;
}

ChallengeDto = {
  id: string; groupId: string; userId: string; ownerName: string;
  title: string; startDate: string; endDate: string;
  status: ChallengeStatus; lockedAt: string | null; createdAt: string;
  activities: ActivityDto[];
}

CheckInDto = {
  id: string; activityId: string; activityName: string; icon: string | null;
  userId: string; localDate: string;
  checkinAt: string; checkoutAt: string | null; durationMinutes: number | null;
  checkinMedia: MediaDto; checkoutMedia: MediaDto | null;
  note: string | null; status: CheckInStatus; createdAt: string;
}

UploadIntentResponse = {
  intentId: string;
  expiresAt: string; // intent_at + 15 phút
  upload: {
    cloudName: string; apiKey: string; uploadPreset: string;
    folder: string; publicId: string; // publicId = intentId (không dấu -)
    timestamp: number; signature: string;
    allowedTypes: Array<"image" | "video">; // theo proofType của activity
  };
}

TodayItemDto = {
  activity: ActivityDto;
  state: "PENDING" | "PASS" | "FAIL";
  failReason: "LATE" | "MISSING" | "INSUFFICIENT" | "REJECTED" | null;
  isLate: boolean;                 // DEADLINE: đã quá hạn và chưa đạt
  deadlineAt: string | null;       // instant tuyệt đối (UTC) = deadline_time hôm nay (giờ VN) — không còn cộng grace; frontend tự tính cửa sổ ±5 phút
  session: {                       // deprecated — luôn null (DURATION giờ là tick + 1 ảnh, không còn phiên)
    openCheckinId: string | null; startedAt: string | null;
    totalTodayMinutes: number; targetMinutes: number;
  } | null;
  checkins: CheckInDto[];          // các check-in hôm nay của activity này
}

TodayDto = {
  date: string;                    // ngày hiện tại (giờ VN)
  serverTime: string;              // UTC — client dùng để tính offset đồng hồ
  timezone: "Asia/Ho_Chi_Minh";
  activeChallenge: ChallengeDto | null;
  items: TodayItemDto[];
  expectedPenalty: number;         // phạt dự kiến nếu ngày kết thúc với trạng thái hiện tại
  result: { total: number; passed: number; failed: number; penalty: number; status: ResultStatus } | null; // có khi ngày đã được chốt tạm thời
}

LiveItemDto = {
  activityId: string;
  status: "PENDING" | "PASS" | "FAIL";
  failReason: string | null;
  name: string; icon: string | null;
  isLate: boolean;                 // DEADLINE: đã qua mốc giờ và chưa đạt
}

LiveMemberDto = {                  // phẳng (không lồng `user`)
  userId: string; displayName: string; avatarUrl: string | null;
  online: boolean;
  items: LiveItemDto[];
  expectedPenalty: number;         // phạt dự kiến hôm nay nếu ngày kết thúc ở trạng thái hiện tại
}

TickerItem = {
  checkinId: string; userId: string; userName: string; activityName: string;
  text: string;                    // chữ do server định dạng sẵn, VD "An vừa check-in Dậy sớm lúc 05:48"
  at: string; thumbnailUrl: string | null;
};

LiveBoardDto = {
  groupId: string; groupName: string;
  date: string; serverTime: string;
  members: LiveMemberDto[];
  ticker: TickerItem[];            // tối đa 20 sự kiện gần nhất hôm nay, mới nhất trước
  totalExpectedPenalty: number;
}

ProofFeedItemDto = {
  checkin: CheckInDto;
  user: { userId: string; displayName: string; avatarUrl: string | null };
  activity: { name: string; icon: string | null; type: ActivityType };
  challenge: { id: string; title: string; status: ChallengeStatus };
  reports: Array<{ reason: string; reporterName: string; at: string }>;  // vẫn trả về — UI không hiển thị
  review: { action: "APPROVE" | "REJECT"; reason: string | null; reviewerName: string; at: string } | null; // vẫn trả về — UI không hiển thị
}

ProofFeedDto = {
  date: string;
  finalizeAt: string | null;       // 12:00 (giờ VN) ngày hôm sau — lúc kết quả ngày chốt FINAL; null nếu đã FINAL
  items: ProofFeedItemDto[];
}

PersonalStatsDto = {
  from: string; to: string;
  totalDays: number; passedDays: number; completionRate: number; // 0..1
  currentStreak: number; bestStreak: number; totalPenalty: number;
  byDay: Array<{ date: string; passed: number; failed: number; total: number; penalty: number }>;
  byActivity: Array<{
    activityId: string; name: string; icon: string | null;
    completionRate: number;
    avgCheckinTime: string | null;  // "HH:mm" — chỉ DEADLINE
    avgMinutes: number | null;      // — chỉ DURATION
  }>;
  byChallenge: Array<{ challengeId: string; title: string; from: string; to: string; completionRate: number; totalPenalty: number }>;
}

HeatmapDto = { year: number; days: Array<{ date: string; state: "PASS" | "PARTIAL" | "FAIL" | "NONE"; failed: number; total: number }> };
// PASS = fail 0, PARTIAL = fail 1, FAIL = fail >= 2, NONE = không có dữ liệu

LeaderboardRowDto = {
  rank: number; userId: string; displayName: string; avatarUrl: string | null;
  totalActivities: number; passedActivities: number; completionRate: number;
  totalPenalty: number; currentStreak: number; bestStreak: number;
}

FundDto = {
  groupId: string;
  totalPenalty: number;      // tổng phạt đã ghi sổ
  totalPaid: number;         // tổng đã đóng
  totalOutstanding: number;  // tổng còn nợ
  debts: Array<{ userId: string; displayName: string; avatarUrl: string | null; totalPenalty: number; totalPaid: number; balance: number }>;
  history: Array<{ id: string; userId: string; displayName: string; amount: number; kind: LedgerKind; note: string | null; refDate: string | null; createdBy: string | null; createdAt: string }>; // mới nhất trước, tối đa 200
}
```

## 2. Endpoints

### Health

| Method | Path      | Mô tả                                                    |
| ------ | --------- | -------------------------------------------------------- |
| GET    | `/health` | `200 { "status": "ok", "time": "ISO" }` — không cần auth |

### Auth

| Method | Path            | Request               | Response                                                                                                                  |
| ------ | --------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/auth/google`  | `{ idToken: string }` | `200 { accessToken, tokenType: "Bearer", expiresIn: 900 }` + Set-Cookie `hc_refresh`. `401` nếu token Google không hợp lệ |
| POST   | `/auth/refresh` | (cookie)              | `200` như trên + cookie mới (rotation). `401` nếu không có cookie/đã thu hồi                                              |
| POST   | `/auth/logout`  | —                     | `204`, xoá cookie                                                                                                         |

### Me / Profile

| Method | Path                | Request                                                                                                      | Response                                                                                         |
| ------ | ------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| GET    | `/me`               | —                                                                                                            | `200 UserDto`                                                                                    |
| PATCH  | `/me`               | `{ displayName?: string; reminder?: { deadlineAheadMinutes?: number \| null; endOfDayReminder?: boolean } }` | `200 UserDto` (broadcast `ProfileUpdated` nếu đổi tên/avatar)                                    |
| POST   | `/me/avatar/intent` | —                                                                                                            | `200 UploadIntentResponse` (kind `AVATAR`, folder `avatars/{userId}`, `allowedTypes: ["image"]`) |
| PUT    | `/me/avatar`        | `{ publicId: string }`                                                                                       | `200 UserDto` (xoá avatar cũ trên Cloudinary, broadcast `ProfileUpdated`)                        |

### Groups

| Method | Path                            | Request                                                               | Response                                                                                                                        |
| ------ | ------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/groups`                       | `{ name: string }`                                                    | `201 GroupDto` (người tạo là OWNER)                                                                                             |
| POST   | `/groups/join`                  | `{ inviteCode: string }`                                              | `200 GroupDto`. `404` sai mã, `409` đã là thành viên                                                                            |
| GET    | `/groups/mine`                  | —                                                                     | `200 GroupDto[]` — mọi nhóm user tham gia (theo thứ tự tham gia); user được tạo/tham gia nhiều nhóm, không có endpoint xoá nhóm |
| GET    | `/groups/{id}`                  | —                                                                     | `200 GroupDto` (chỉ thành viên)                                                                                                 |
| PATCH  | `/groups/{id}/penalty-tiers`    | `{ tiers: number[]; extraPerActivity: number }` (`tiers[0]` phải = 0) | `200 GroupDto` (chỉ OWNER)                                                                                                      |
| GET    | `/groups/{id}/live`             | —                                                                     | `200 LiveBoardDto`                                                                                                              |
| DELETE | `/groups/{id}/members/{userId}` | —                                                                     | `204` (chỉ OWNER, không được xoá chính mình)                                                                                    |

### Challenges & Activities

| Method | Path                                       | Request                                  | Response                                                                                                                                                                                                             |
| ------ | ------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/challenges`                              | `{ groupId, title, startDate, endDate }` | `201 ChallengeDto`. `409` nếu đã có challenge ACTIVE hoặc chồng ngày trong cùng nhóm                                                                                                                                 |
| GET    | `/challenges/mine?groupId=`                | —                                        | `200 ChallengeDto[]` (theo `createdAt` giảm)                                                                                                                                                                         |
| GET    | `/challenges/group/{groupId}`              | —                                        | `200 ChallengeDto[]` của **mọi** thành viên nhóm, chỉ xem; `ACTIVE` → `DRAFT` → `COMPLETED`/`CANCELLED`, cùng trạng thái theo `startDate` giảm; `ownerName` theo chủ sở hữu từng kỳ; `401` nếu không phải thành viên |
| PATCH  | `/challenges/{id}`                         | `{ title?; startDate?; endDate? }`       | `200 ChallengeDto` — **chỉ khi DRAFT**, `422` nếu đã ACTIVE                                                                                                                                                          |
| DELETE | `/challenges/{id}`                         | —                                        | `204` (chỉ DRAFT → chuyển `CANCELLED`)                                                                                                                                                                               |
| POST   | `/challenges/{id}/activities`              | `ActivityInput` (bên dưới)               | `201 ActivityDto` — chỉ DRAFT                                                                                                                                                                                        |
| PUT    | `/challenges/{id}/activities/{activityId}` | `ActivityInput`                          | `200 ActivityDto` — chỉ DRAFT                                                                                                                                                                                        |
| DELETE | `/challenges/{id}/activities/{activityId}` | —                                        | `204` — chỉ DRAFT                                                                                                                                                                                                    |
| PUT    | `/challenges/{id}/activities/order`        | `{ activityIds: string[] }`              | `200 ActivityDto[]` — chỉ DRAFT                                                                                                                                                                                      |

`ActivityInput` (các field theo type, validate chéo):

```ts
{
  name: string; description?: string | null; icon?: string | null;
  type: ActivityType;
  deadlineTime?: string | null; graceMinutes?: number;   // DEADLINE: deadlineTime bắt buộc — graceMinutes không còn dùng (cửa sổ ±5 phút cố định)
  targetMinutes?: number | null; // DURATION: targetMinutes > 0 bắt buộc (thời lượng mô tả, VD 60 = 1 giờ)
  minSessionMinutes?: number | null; // deprecated — server bỏ qua
  windowStart?: string | null; windowEnd?: string | null; // WINDOW: cả hai bắt buộc, windowEnd > windowStart
  proofType?: ProofType;                                  // mặc định ANY
}
```

### Check-in

| Method | Path                                  | Request                                                                             | Response                                                                                                                                                                                                                                     |
| ------ | ------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/today?groupId=`                     | `groupId` **bắt buộc**                                                              | `200 TodayDto`                                                                                                                                                                                                                               |
| POST   | `/uploads/intent`                     | `{ activityId: string; kind: "CHECKIN" \| "CHECKOUT" }`                             | `200 UploadIntentResponse`. Rate limit 30/lphút/user. Validate: challenge ACTIVE, hôm nay trong khoảng ngày, activity đúng loại (CHECKOUT legacy: chỉ cho DURATION đang có phiên OPEN cũ)                                                    |
| POST   | `/checkins`                           | `{ activityId: string; intentId: string; publicId: string; note?: string \| null }` | `201 CheckInDto`. `checkinAt = intent_at`. Mọi loại: 1 check-in hợp lệ duy nhất/ngày — `409` nếu đã check-in (trừ check-in REJECTED). DEADLINE: `422` nếu ngoài khung ±5 phút quanh mốc giờ ("Chưa đến giờ check-in…" / "Quá giờ check-in…") |
| POST   | `/checkins/{id}/checkout`             | `{ intentId: string; publicId: string }`                                            | `200 CheckInDto` (status `COMPLETED`, `durationMinutes` = phút từ checkin → checkout, làm tròn lên). Legacy — chỉ cho phiên OPEN tạo trước thay đổi "tick + 1 ảnh"                                                                           |
| GET    | `/checkins?userId=&date=&activityId?` | query params                                                                        | `200 CheckInDto[]` (chỉ thành viên cùng nhóm xem được userId khác)                                                                                                                                                                           |

### Bằng chứng (trang check-in — chỉ đọc)

Trang bằng chứng là **chỉ đọc**: bằng chứng hợp lệ ngay khi upload, UI không dùng report/approve/reject (3 endpoint dưới vẫn giữ trong code).

| Method | Path                                        | Request                                                                                                                                             | Response                                                                                                                                                                                                                 |
| ------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/groups/{id}/proofs?date=&status=&userId?` | `status`: `ALL` \| `REPORTED` \| `PENDING` \| `APPROVED` \| `REJECTED` (mặc định `ALL`); `date` mặc định hôm nay (VN); `userId` lọc theo thành viên | `200 ProofFeedDto`                                                                                                                                                                                                       |
| POST   | `/checkins/{id}/report`                     | `{ reason: string }`                                                                                                                                | `204` — bất kỳ thành viên cùng nhóm, chỉ khi ngày chưa FINAL. Giữ trong code, UI không dùng                                                                                                                              |
| POST   | `/checkins/{id}/approve`                    | `{ reason?: string \| null }` (body tuỳ chọn)                                                                                                       | `204` — chỉ OWNER/ADMIN, chỉ khi ngày chưa FINAL. Giữ trong code, UI không dùng                                                                                                                                          |
| POST   | `/checkins/{id}/reject`                     | `{ reason?: string \| null }` (bỏ trống → "Bị từ chối")                                                                                             | `204` — chỉ OWNER/ADMIN, chỉ khi ngày chưa FINAL. Giữ trong code, UI không dùng. Check-in chuyển `REJECTED`, **tính lại ngay** `daily_results` PROVISIONAL của ngày đó, broadcast `DailyResultUpdated` + `ProofRejected` |

### Stats & Fund

| Method | Path                         | Query                                                       | Response                                                                            |
| ------ | ---------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| GET    | `/stats/me`                  | `from?, to?` (mặc định 30 ngày gần nhất)                    | `200 PersonalStatsDto`                                                              |
| GET    | `/stats/me/heatmap`          | `year?` (mặc định năm nay)                                  | `200 HeatmapDto`                                                                    |
| GET    | `/groups/{id}/leaderboard`   | `from?, to?`                                                | `200 LeaderboardRowDto[]` (sắp theo `completionRate` giảm, rồi `totalPenalty` tăng) |
| GET    | `/groups/{id}/fund`          | —                                                           | `200 FundDto`                                                                       |
| POST   | `/groups/{id}/fund/payments` | `{ userId: string; amount: number; note?: string \| null }` | `201 { id, amount, kind: "PAYMENT", note, createdAt }` (chỉ OWNER)                  |

## 3. Luồng upload media (Cloudinary signed)

1. Client chọn file (hỗ trợ `capture` camera). Ảnh: nén bằng `browser-image-compression` (max ~1600px) trước khi upload. Video: kiểm tra ≤ 60s/50MB phía client.
2. `POST /api/uploads/intent { activityId, kind }` → `UploadIntentResponse`.
3. Upload thẳng lên Cloudinary bằng form-data POST tới `https://api.cloudinary.com/v1_1/{cloudName}/{resourceType}/upload` với các field: `file`, `folder`, `public_id`, `timestamp`, `signature`, `upload_preset` (và `api_key` không cần cho signed upload — giữ đúng field server trả).
4. `POST /api/checkins { activityId, intentId, publicId, note? }` — server xác minh bằng Admin API: asset tồn tại, đúng `public_id`, `resource_type` hợp lệ theo `proofType`, `bytes` trong giới hạn (ảnh ≤ 10MB, video ≤ 50MB), `created_at` ≤ `intent_at + 15 phút`. Mỗi `publicId` chỉ dùng 1 lần (intent `usedAt`).

Avatar: bước 1-4 với `POST /me/avatar/intent` rồi `PUT /me/avatar { publicId }`. Transformation avatar: `c_fill,g_face,w_256,h_256,r_max`.

## 4. SignalR

- Hub: `/hubs/live?access_token=<accessToken>` (JWT).
- Client → server: `JoinGroup(groupId: string)`, `LeaveGroup(groupId: string)` (server verify quyền thành viên trước khi add vào group `group:{groupId}`).
- Server → client (nhóm `group:{groupId}`):

| Event                | Payload                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `CheckInCreated`     | `{ userId, activityId, activityName, checkinAt, isLate, thumbnailUrl }`                   |
| `CheckOutCompleted`  | `{ userId, activityId, durationMinutes, totalTodayMinutes }` (legacy — chỉ phiên OPEN cũ) |
| `SessionStarted`     | `{ userId, activityId, startedAt }` (legacy — không còn gửi)                              |
| `ProofRejected`      | `{ checkinId, userId, reason }`                                                           |
| `DailyResultUpdated` | `{ userId, date, failedCount, penaltyAmount, status }`                                    |
| `MemberPresence`     | `{ userId, online }` (online = đang có ≥1 hub connection)                                 |
| `ProfileUpdated`     | `{ userId, displayName, avatarUrl }`                                                      |

- Reconnect: client gọi lại `GET /groups/{id}/live` hoặc query liên quan để đồng bộ snapshot.

## 5. Config (môi trường / appsettings)

```
ConnectionStrings__Default   Host=...;Database=habit;Username=habit;Password=...
Google__ClientId             Google OAuth Client ID (audience của ID token)
Jwt__Secret                  chuỗi bí mật ký JWT nội bộ (>= 32 ký tự)
Cloudinary__CloudName
Cloudinary__ApiKey
Cloudinary__ApiSecret
Cloudinary__ProofPreset      upload preset SIGNED cho bằng chứng (folder mặc định, resize ảnh 1600px, q_auto,f_auto; video sinh thumbnail)
Cloudinary__AvatarPreset     upload preset SIGNED cho avatar
App__TimeZone                Asia/Ho_Chi_Minh
App__CorsOrigin              origin frontend được phép (dev: http://localhost:5173)
```

Frontend (Vite env): `VITE_API_URL` (mặc định `/api`), `VITE_GOOGLE_CLIENT_ID`.
