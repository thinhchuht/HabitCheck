import { api } from "./client";
import type { UploadIntentResponse, UpdateMeRequest, UserDto } from "@/types/api";

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
    return api.post<UploadIntentResponse>("/me/avatar/intent").then((r) => r.data);
  },

  /** PUT /me/avatar — confirm uploaded avatar (removes the old one). */
  setAvatar(publicId: string): Promise<UserDto> {
    return api.put<UserDto>("/me/avatar", { publicId }).then((r) => r.data);
  },
};
