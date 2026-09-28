import type {
  ActivityType,
  ChallengeStatus,
  CheckInStatus,
  FailReason,
  LedgerKind,
  MemberRole,
  ProofStatusFilter,
  ProofType,
} from "@/types/api";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "/api";
export const HUB_URL: string = import.meta.env.VITE_HUB_URL ?? "/hubs/live";
export const GOOGLE_CLIENT_ID: string =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

export const TZ = "Asia/Ho_Chi_Minh";

// Media limits (contract §1.3 / §2)
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_VIDEO_SECONDS = 60;

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  DEADLINE: "Giờ chính xác",
  DURATION: "Thời lượng",
  WINDOW: "Khung giờ",
};

export const PROOF_TYPE_LABELS: Record<ProofType, string> = {
  PHOTO: "Ảnh",
  VIDEO: "Video",
  ANY: "Ảnh hoặc video",
};

export const FAIL_REASON_LABELS: Record<FailReason, string> = {
  LATE: "Trễ",
  MISSING: "Thiếu",
  INSUFFICIENT: "Chưa đủ",
  REJECTED: "Bị từ chối",
};

export const CHALLENGE_STATUS_LABELS: Record<ChallengeStatus, string> = {
  DRAFT: "Bản nháp",
  ACTIVE: "Đang diễn ra",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã huỷ",
};

export const CHECKIN_STATUS_LABELS: Record<CheckInStatus, string> = {
  OPEN: "Đang mở",
  COMPLETED: "Hoàn thành",
  ABANDONED: "Bỏ dở",
  REJECTED: "Bị từ chối",
};

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  OWNER: "Chủ nhóm",
  ADMIN: "Quản trị",
  MEMBER: "Thành viên",
};

export const LEDGER_KIND_LABELS: Record<LedgerKind, string> = {
  PENALTY: "Phạt",
  PAYMENT: "Đóng tiền",
  ADJUSTMENT: "Điều chỉnh",
};

export const PROOF_FILTER_LABELS: Record<ProofStatusFilter, string> = {
  ALL: "Tất cả",
  REPORTED: "Bị báo cáo",
  PENDING: "Chưa duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
};

/** Default penalty tiers per contract §0 (used only as fallback display). */
export const DEFAULT_TIERS = [0, 20000, 50000, 70000];
export const DEFAULT_EXTRA_PER_ACTIVITY = 20000;
