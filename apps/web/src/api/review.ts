import { api } from "./client";
import type { ProofFeedDto, ProofQueryParams } from "@/types/api";

export const reviewApi = {
  /** GET /groups/{id}/proofs?date=&status=&userId? — feed chỉ đọc, hợp lệ ngay khi upload. */
  feed(groupId: string, params: ProofQueryParams): Promise<ProofFeedDto> {
    return api
      .get<ProofFeedDto>(`/groups/${groupId}/proofs`, { params })
      .then((r) => r.data);
  },

  // Ba phương thức dưới đây giữ cho khớp API — UI không còn dùng (không cần duyệt).

  /** POST /checkins/{id}/report — any group member. 204. */
  report(checkinId: string, reason: string): Promise<void> {
    return api
      .post<void>(`/checkins/${checkinId}/report`, { reason })
      .then(() => undefined);
  },

  /** POST /checkins/{id}/approve — OWNER/ADMIN only. 204. */
  approve(checkinId: string): Promise<void> {
    return api
      .post<void>(`/checkins/${checkinId}/approve`)
      .then(() => undefined);
  },

  /** POST /checkins/{id}/reject — OWNER/ADMIN only, recomputes the day. 204. */
  reject(checkinId: string, reason: string): Promise<void> {
    return api
      .post<void>(`/checkins/${checkinId}/reject`, { reason })
      .then(() => undefined);
  },
};
