// Type definitions mirroring docs/api-contract.md §1 exactly.

// ---- Enums (string values) ----
export type ActivityType = "DEADLINE" | "DURATION" | "WINDOW";
export type ProofType = "PHOTO" | "VIDEO" | "ANY";
export type ChallengeStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type CheckInStatus = "OPEN" | "COMPLETED" | "ABANDONED" | "REJECTED";
export type ResultStatus = "PROVISIONAL" | "FINAL";
export type MemberRole = "OWNER" | "ADMIN" | "MEMBER";
export type FailReason = "LATE" | "MISSING" | "INSUFFICIENT" | "REJECTED";
export type LedgerKind = "PENALTY" | "PAYMENT" | "ADJUSTMENT";
export type UploadKind = "CHECKIN" | "CHECKOUT";
export type TodayItemState = "PENDING" | "PASS" | "FAIL";
export type ProofStatusFilter =
  | "ALL"
  | "REPORTED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";
export type MediaType = "image" | "video";

// ---- DTOs ----
export interface UserDto {
  id: string;
  googleSub: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  reminder: {
    deadlineAheadMinutes: number | null;
    endOfDayReminder: boolean;
  };
  createdAt: string;
  lastLoginAt: string | null;
}

export interface MediaDto {
  publicId: string;
  url: string;
  thumbnailUrl: string | null;
  type: MediaType;
  bytes: number | null;
}

export interface MemberDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: MemberRole;
  joinedAt: string;
}

export interface PenaltyTiers {
  tiers: number[];
  extraPerActivity: number;
}

export interface GroupDto {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  penaltyTiers: PenaltyTiers;
  reviewWindowHours: number;
  createdAt: string;
  members: MemberDto[];
}

export interface ActivityDto {
  id: string;
  challengeId: string;
  name: string;
  description: string | null;
  icon: string | null;
  type: ActivityType;
  deadlineTime: string | null;
  graceMinutes: number;
  targetMinutes: number | null;
  minSessionMinutes: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  proofType: ProofType;
  sortOrder: number;
}

export interface ChallengeDto {
  id: string;
  groupId: string;
  userId: string;
  ownerName: string;
  title: string;
  startDate: string;
  endDate: string;
  status: ChallengeStatus;
  lockedAt: string | null;
  createdAt: string;
  activities: ActivityDto[];
}

export interface CheckInDto {
  id: string;
  activityId: string;
  activityName: string;
  icon: string | null;
  userId: string;
  localDate: string;
  checkinAt: string;
  checkoutAt: string | null;
  durationMinutes: number | null;
  checkinMedia: MediaDto;
  checkoutMedia: MediaDto | null;
  note: string | null;
  status: CheckInStatus;
  createdAt: string;
}

export interface UploadIntentUpload {
  cloudName: string;
  apiKey: string;
  uploadPreset: string;
  folder: string;
  publicId: string;
  timestamp: number;
  signature: string;
  allowedTypes: Array<"image" | "video">;
}

export interface UploadIntentResponse {
  intentId: string;
  expiresAt: string;
  upload: UploadIntentUpload;
}

export interface TodaySession {
  openCheckinId: string | null;
  startedAt: string | null;
  totalTodayMinutes: number;
  targetMinutes: number;
}

export interface TodayItemDto {
  activity: ActivityDto;
  state: TodayItemState;
  failReason: FailReason | null;
  isLate: boolean;
  deadlineAt: string | null;
  session: TodaySession | null;
  checkins: CheckInDto[];
}

export interface TodayResult {
  total: number;
  passed: number;
  failed: number;
  penalty: number;
  status: ResultStatus;
}

export interface TodayDto {
  date: string;
  serverTime: string;
  timezone: "Asia/Ho_Chi_Minh";
  activeChallenge: ChallengeDto | null;
  items: TodayItemDto[];
  expectedPenalty: number;
  result: TodayResult | null;
}

export interface LiveBoardItem {
  activityId: string;
  status: TodayItemState;
  failReason: string | null;
  name: string;
  icon: string | null;
  isLate: boolean;
}

export interface LiveMemberDto {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  online: boolean;
  items: LiveBoardItem[];
  expectedPenalty: number;
}

export interface TickerItem {
  checkinId: string;
  userId: string;
  userName: string;
  activityName: string;
  text: string;
  at: string;
  thumbnailUrl: string | null;
}

export interface LiveBoardDto {
  groupId: string;
  groupName: string;
  date: string;
  serverTime: string;
  members: LiveMemberDto[];
  totalExpectedPenalty: number;
  ticker: TickerItem[];
}

export interface ProofReport {
  reason: string;
  reporterName: string;
  at: string;
}

export interface ProofReviewInfo {
  action: "APPROVE" | "REJECT";
  reason: string | null;
  reviewerName: string;
  at: string;
}

export interface ProofFeedItemDto {
  checkin: CheckInDto;
  user: { userId: string; displayName: string; avatarUrl: string | null };
  activity: { name: string; icon: string | null; type: ActivityType };
  challenge: { id: string; title: string; status: ChallengeStatus };
  reports: ProofReport[];
  review: ProofReviewInfo | null;
}

export interface ProofFeedDto {
  date: string;
  finalizeAt: string | null;
  items: ProofFeedItemDto[];
}

export interface PersonalStatsByDay {
  date: string;
  passed: number;
  failed: number;
  total: number;
  penalty: number;
}

export interface PersonalStatsByActivity {
  activityId: string;
  name: string;
  icon: string | null;
  completionRate: number;
  avgCheckinTime: string | null;
  avgMinutes: number | null;
}

export interface PersonalStatsByChallenge {
  challengeId: string;
  title: string;
  from: string;
  to: string;
  completionRate: number;
  totalPenalty: number;
}

export interface PersonalStatsDto {
  from: string;
  to: string;
  totalDays: number;
  passedDays: number;
  completionRate: number;
  currentStreak: number;
  bestStreak: number;
  totalPenalty: number;
  byDay: PersonalStatsByDay[];
  byActivity: PersonalStatsByActivity[];
  byChallenge: PersonalStatsByChallenge[];
}

export interface HeatmapDay {
  date: string;
  state: "PASS" | "PARTIAL" | "FAIL" | "NONE";
  failed: number;
  total: number;
}

export interface HeatmapDto {
  year: number;
  days: HeatmapDay[];
}

export interface LeaderboardRowDto {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalActivities: number;
  passedActivities: number;
  completionRate: number;
  totalPenalty: number;
  currentStreak: number;
  bestStreak: number;
}

export interface FundDebt {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  totalPenalty: number;
  totalPaid: number;
  balance: number;
}

export interface FundHistoryEntry {
  id: string;
  userId: string;
  displayName: string;
  amount: number;
  kind: LedgerKind;
  note: string | null;
  refDate: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface FundDto {
  groupId: string;
  totalPenalty: number;
  totalPaid: number;
  totalOutstanding: number;
  debts: FundDebt[];
  history: FundHistoryEntry[];
}

// ---- Request payloads ----
export interface GoogleLoginRequest {
  idToken: string;
}

export interface GoogleLoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface UpdateMeRequest {
  displayName?: string;
  reminder?: {
    deadlineAheadMinutes?: number | null;
    endOfDayReminder?: boolean;
  };
}

export interface CreateGroupRequest {
  name: string;
}

export interface JoinGroupRequest {
  inviteCode: string;
}

export interface PenaltyTiersPayload {
  tiers: number[];
  extraPerActivity: number;
}

export interface CreateChallengeRequest {
  groupId: string;
  title: string;
  startDate: string;
  endDate: string;
}

export interface UpdateChallengeRequest {
  title?: string;
  startDate?: string;
  endDate?: string;
}

export interface ActivityInput {
  name: string;
  description?: string | null;
  icon?: string | null;
  type: ActivityType;
  deadlineTime?: string | null;
  graceMinutes?: number;
  targetMinutes?: number | null;
  minSessionMinutes?: number | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  proofType?: ProofType;
}

export interface UploadIntentRequest {
  activityId: string;
  kind: UploadKind;
}

export interface CreateCheckinRequest {
  activityId: string;
  intentId: string;
  publicId: string;
  note?: string | null;
}

export interface CheckoutRequest {
  intentId: string;
  publicId: string;
}

export interface RecordPaymentRequest {
  userId: string;
  amount: number;
  note?: string | null;
}

export interface RecordPaymentResponse {
  id: string;
  amount: number;
  kind: "PAYMENT";
  note: string | null;
  createdAt: string;
}

export interface CheckInListParams {
  userId?: string;
  date?: string;
  activityId?: string;
}

export interface ProofQueryParams {
  date?: string;
  status?: ProofStatusFilter;
  userId?: string;
}

export interface StatsQueryParams {
  from?: string;
  to?: string;
}

// ---- SignalR events (design §6 + contract §4) ----
export interface CheckInCreatedEvent {
  userId: string;
  activityId: string;
  activityName: string;
  checkinAt: string;
  isLate: boolean;
  thumbnailUrl: string | null;
}

export interface CheckOutCompletedEvent {
  userId: string;
  activityId: string;
  durationMinutes: number;
  totalTodayMinutes: number;
}

export interface SessionStartedEvent {
  userId: string;
  activityId: string;
  startedAt: string;
}

export interface ProofRejectedEvent {
  checkinId: string;
  userId: string;
  reason: string;
}

export interface DailyResultUpdatedEvent {
  userId: string;
  date: string;
  failedCount: number;
  penaltyAmount: number;
  status: ResultStatus;
}

export interface MemberPresenceEvent {
  userId: string;
  online: boolean;
}

export interface ProfileUpdatedEvent {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}
