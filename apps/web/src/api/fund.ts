import { api } from "./client";
import type {
  FundDto,
  FundHistoryPage,
  RecordPaymentRequest,
  RecordPaymentResponse,
} from "@/types/api";

export const fundApi = {
  /** GET /groups/{id}/fund — tổng quan + bảng nợ phân trang. */
  get(groupId: string, page = 1, pageSize = 10): Promise<FundDto> {
    return api
      .get<FundDto>(`/groups/${groupId}/fund`, { params: { page, pageSize } })
      .then((r) => r.data);
  },

  /** GET /groups/{id}/fund/history — lịch sử quỹ phân trang. */
  history(groupId: string, page = 1, pageSize = 20): Promise<FundHistoryPage> {
    return api
      .get<FundHistoryPage>(`/groups/${groupId}/fund/history`, {
        params: { page, pageSize },
      })
      .then((r) => r.data);
  },

  /** POST /groups/{id}/fund/payments — OWNER only. */
  recordPayment(
    groupId: string,
    payload: RecordPaymentRequest,
  ): Promise<RecordPaymentResponse> {
    return api
      .post<RecordPaymentResponse>(`/groups/${groupId}/fund/payments`, payload)
      .then((r) => r.data);
  },
};
