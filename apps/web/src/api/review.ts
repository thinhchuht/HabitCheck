import { api } from "./client";
import type { ProofFeedDto, ProofFeedItemDto, ProofQueryParams } from "@/types/api";

export const reviewApi = {
  /** GET /groups/{id}/proofs?date=&status=&userId? */
  feed(groupId: string, params: ProofQueryParams): Promise<ProofFeedDto> {
    return api.get<ProofFeedDto>(`/groups/${groupId}/proofs`, { params }).then((r) => r.data);
  },

  /** POST /checkins/{id}/report — any group member. */
  report(checkinId: string, reason: string): Promise<ProofFeedItemDto> {
    return api
      .post<ProofFeedItemDto>(`/checkins/${checkinId}/report`, { reason })
      .then((r) => r.data);
  },

  /** POST /checkins/{id}/approve — OWNER/ADMIN only. */
  approve(checkinId: string): Promise<ProofFeedItemDto> {
    return api.post<ProofFeedItemDto>(`/checkins/${checkinId}/approve`).then((r) => r.data);
  },

  /** POST /checkins/{id}/reject — OWNER/ADMIN only, recomputes the day. */
  reject(checkinId: string, reason: string): Promise<ProofFeedItemDto> {
    return api
      .post<ProofFeedItemDto>(`/checkins/${checkinId}/reject`, { reason })
      .then((r) => r.data);
  },
};
