import { api } from "./client";
import type {
  ActivityDto,
  ActivityInput,
  ChallengeDto,
  CreateChallengeRequest,
  UpdateChallengeRequest,
} from "@/types/api";

export const challengesApi = {
  /** POST /challenges */
  create(payload: CreateChallengeRequest): Promise<ChallengeDto> {
    return api.post<ChallengeDto>("/challenges", payload).then((r) => r.data);
  },

  /** GET /challenges/mine?groupId= */
  mine(groupId: string): Promise<ChallengeDto[]> {
    return api
      .get<ChallengeDto[]>("/challenges/mine", { params: { groupId } })
      .then((r) => r.data);
  },

  /** PATCH /challenges/{id} — DRAFT only. */
  update(id: string, payload: UpdateChallengeRequest): Promise<ChallengeDto> {
    return api.patch<ChallengeDto>(`/challenges/${id}`, payload).then((r) => r.data);
  },

  /** DELETE /challenges/{id} — DRAFT only (cancels it). */
  remove(id: string): Promise<void> {
    return api.delete(`/challenges/${id}`).then(() => undefined);
  },

  /** POST /challenges/{id}/activities — DRAFT only. */
  addActivity(challengeId: string, input: ActivityInput): Promise<ActivityDto> {
    return api
      .post<ActivityDto>(`/challenges/${challengeId}/activities`, input)
      .then((r) => r.data);
  },

  /** PUT /challenges/{id}/activities/{activityId} — DRAFT only. */
  updateActivity(
    challengeId: string,
    activityId: string,
    input: ActivityInput
  ): Promise<ActivityDto> {
    return api
      .put<ActivityDto>(`/challenges/${challengeId}/activities/${activityId}`, input)
      .then((r) => r.data);
  },

  /** DELETE /challenges/{id}/activities/{activityId} — DRAFT only. */
  removeActivity(challengeId: string, activityId: string): Promise<void> {
    return api
      .delete(`/challenges/${challengeId}/activities/${activityId}`)
      .then(() => undefined);
  },

  /** PUT /challenges/{id}/activities/order — DRAFT only. */
  reorder(challengeId: string, activityIds: string[]): Promise<ActivityDto[]> {
    return api
      .put<ActivityDto[]>(`/challenges/${challengeId}/activities/order`, { activityIds })
      .then((r) => r.data);
  },
};
