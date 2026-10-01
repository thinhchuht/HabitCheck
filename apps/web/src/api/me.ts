import { api } from "./client";
import type {
  CheatDayDto,
  UploadIntentResponse,
  UpdateMeRequest,
  UserDto,
} from "@/types/api";

export const meApi = {
  /** GET /me */
  get(): Promise<UserDto> {
    return api.get<UserDto>("/me").then((r) => r.data);
  },

  /** PATCH /me — display name and/or reminder settings. */
  update(payload: UpdateMeRequest): Promise<UserDto> {
    return api.patch<UserDto>("/me", payload).then((r) => r.data);
  },

  /** POST /me/avatar/intent — signed upload params for a new avatar. */
  avatarIntent(): Promise<UploadIntentResponse> {
    return api
      .post<UploadIntentResponse>("/me/avatar/intent")
      .then((r) => r.data);
  },

  /** PUT /me/avatar — confirm uploaded avatar (removes the old one). */
  setAvatar(publicId: string): Promise<UserDto> {
    return api.put<UserDto>("/me/avatar", { publicId }).then((r) => r.data);
  },

  /** POST /me/cheat-days — mark a cheat day (today or within 7 days, 1/week per group). */
  markCheatDay(groupId: string, date?: string): Promise<CheatDayDto> {
    return api
      .post<CheatDayDto>("/me/cheat-days", { groupId, date: date ?? null })
      .then((r) => r.data);
  },

  /** DELETE /me/cheat-days/{date} — unmark (today only). */
  unmarkCheatDay(groupId: string, date: string): Promise<void> {
    return api
      .delete<void>(`/me/cheat-days/${date}`, { params: { groupId } })
      .then((r) => r.data);
  },
};
