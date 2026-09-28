import { api } from "./client";
import type {
  HeatmapDto,
  LeaderboardRowDto,
  PersonalStatsDto,
  StatsQueryParams,
} from "@/types/api";

export const statsApi = {
  /** GET /stats/me?from=&to= */
  me(params: StatsQueryParams): Promise<PersonalStatsDto> {
    return api.get<PersonalStatsDto>("/stats/me", { params }).then((r) => r.data);
  },

  /** GET /stats/me/heatmap?year= */
  heatmap(year?: number): Promise<HeatmapDto> {
    return api.get<HeatmapDto>("/stats/me/heatmap", { params: { year } }).then((r) => r.data);
  },

  /** GET /groups/{id}/leaderboard?from=&to= */
  leaderboard(groupId: string, params: StatsQueryParams): Promise<LeaderboardRowDto[]> {
    return api
      .get<LeaderboardRowDto[]>(`/groups/${groupId}/leaderboard`, { params })
      .then((r) => r.data);
  },
};
