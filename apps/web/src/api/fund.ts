import { api } from "./client";
import type { FundDto, RecordPaymentRequest, RecordPaymentResponse } from "@/types/api";

export const fundApi = {
  /** GET /groups/{id}/fund */
  get(groupId: string): Promise<FundDto> {
    return api.get<FundDto>(`/groups/${groupId}/fund`).then((r) => r.data);
  },

  /** POST /groups/{id}/fund/payments — OWNER only. */
  recordPayment(groupId: string, payload: RecordPaymentRequest): Promise<RecordPaymentResponse> {
    return api
      .post<RecordPaymentResponse>(`/groups/${groupId}/fund/payments`, payload)
      .then((r) => r.data);
  },
};
