import type { GroupDto } from "@/types/api";
import { vnNow } from "./format";

/**
 * Nhóm "hết hạn" khi kỳ gần nhất (chưa huỷ) của user trong nhóm đã có
 * end_date trước hôm nay (giờ VN). Không có kỳ → chưa hết hạn.
 */
export function isGroupExpired(group: GroupDto): boolean {
  if (!group.myChallenge) return false;
  return group.myChallenge.endDate < vnNow().format("YYYY-MM-DD");
}

/** Bộ màu pastel cho avatar nhóm — cố định theo id để màu không nhảy khi refresh. */
const GROUP_AVATAR_PALETTE = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
] as const;

export function groupAvatarClass(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return GROUP_AVATAR_PALETTE[Math.abs(hash) % GROUP_AVATAR_PALETTE.length];
}

export function groupInitial(name: string): string {
  const word = name.trim().split(/\s+/).find(Boolean) ?? "";
  return word.charAt(0).toUpperCase() || "?";
}
