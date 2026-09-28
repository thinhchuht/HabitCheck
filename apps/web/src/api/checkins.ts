import { api } from "./client";
import type {
  CheckInDto,
  CheckInListParams,
  CheckoutRequest,
  CreateCheckinRequest,
  TodayDto,
  UploadIntentRequest,
  UploadIntentResponse,
} from "@/types/api";

export const checkinsApi = {
  /** GET /today?groupId= — today's activities + state + open sessions. */
  today(groupId: string): Promise<TodayDto> {
    return api
      .get<TodayDto>("/today", { params: { groupId } })
      .then((r) => r.data);
  },

  /** POST /uploads/intent — signed Cloudinary params for a check-in/checkout proof. */
  createUploadIntent(
    payload: UploadIntentRequest,
  ): Promise<UploadIntentResponse> {
    return api
      .post<UploadIntentResponse>("/uploads/intent", payload)
      .then((r) => r.data);
  },

  /** POST /checkins — checkinAt = intent_at (server time). */
  create(payload: CreateCheckinRequest): Promise<CheckInDto> {
    return api.post<CheckInDto>("/checkins", payload).then((r) => r.data);
  },

  /** POST /checkins/{id}/checkout — end an open DURATION session. */
  checkout(checkinId: string, payload: CheckoutRequest): Promise<CheckInDto> {
    return api
      .post<CheckInDto>(`/checkins/${checkinId}/checkout`, payload)
      .then((r) => r.data);
  },

  /** GET /checkins?userId=&date=&activityId? — history (same group only). */
  list(params: CheckInListParams): Promise<CheckInDto[]> {
    return api.get<CheckInDto[]>("/checkins", { params }).then((r) => r.data);
  },
};
