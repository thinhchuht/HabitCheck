import { api } from "./client";
import type {
  DailyReportDto,
  GroupDto,
  LiveBoardDto,
  PenaltyTiersPayload,
} from "@/types/api";

export const groupsApi = {
  /** POST /groups — create a group (creator becomes OWNER). */
  create(name: string): Promise<GroupDto> {
    return api.post<GroupDto>("/groups", { name }).then((r) => r.data);
  },

  /** POST /groups/join — join via invite code. */
  join(inviteCode: string): Promise<GroupDto> {
    return api
      .post<GroupDto>("/groups/join", { inviteCode })
      .then((r) => r.data);
  },

  /** GET /groups/mine — mọi nhóm user tham gia (không giới hạn số nhóm). */
  mine(): Promise<GroupDto[]> {
    return api.get<GroupDto[]>("/groups/mine").then((r) => r.data);
  },

  /** GET /groups/{id} */
  get(id: string): Promise<GroupDto> {
    return api.get<GroupDto>(`/groups/${id}`).then((r) => r.data);
  },

  /** PATCH /groups/{id}/penalty-tiers — OWNER only. */
  updatePenaltyTiers(
    id: string,
    payload: PenaltyTiersPayload,
  ): Promise<GroupDto> {
    return api
      .patch<GroupDto>(`/groups/${id}/penalty-tiers`, payload)
      .then((r) => r.data);
  },

  /** GET /groups/{id}/live — realtime board snapshot. */
  live(id: string): Promise<LiveBoardDto> {
    return api.get<LiveBoardDto>(`/groups/${id}/live`).then((r) => r.data);
  },

  /** GET /groups/{id}/daily-report — bảng kiểm tra cả nhóm theo khoảng ngày (mặc định hôm nay). */
  dailyReport(id: string, from?: string, to?: string): Promise<DailyReportDto> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return api
      .get<DailyReportDto>(`/groups/${id}/daily-report`, { params })
      .then((r) => r.data);
  },

  /** DELETE /groups/{id}/members/{userId} — OWNER only. */
  removeMember(id: string, userId: string): Promise<void> {
    return api.delete(`/groups/${id}/members/${userId}`).then(() => undefined);
  },
};
