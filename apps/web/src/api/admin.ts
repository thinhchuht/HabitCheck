import { api } from "./client";
import type {
  AdminGroupDetail,
  AdminGroupList,
  AdminStats,
  AdminUserDetail,
  AdminUserList,
} from "@/types/api";

/** Các endpoint /api/admin/* — chỉ trả 200 với user có quyền admin. */
export const adminApi = {
  stats(): Promise<AdminStats> {
    return api.get<AdminStats>("/admin/stats").then((r) => r.data);
  },

  users(search?: string, page = 1, pageSize = 20): Promise<AdminUserList> {
    return api
      .get<AdminUserList>("/admin/users", { params: { search, page, pageSize } })
      .then((r) => r.data);
  },

  user(id: string): Promise<AdminUserDetail> {
    return api.get<AdminUserDetail>(`/admin/users/${id}`).then((r) => r.data);
  },

  makeAdmin(id: string): Promise<void> {
    return api.post(`/admin/users/${id}/admin`).then((r) => r.data);
  },

  revokeAdmin(id: string): Promise<void> {
    return api.delete(`/admin/users/${id}/admin`).then((r) => r.data);
  },

  groups(): Promise<AdminGroupList> {
    return api.get<AdminGroupList>("/admin/groups").then((r) => r.data);
  },

  group(id: string): Promise<AdminGroupDetail> {
    return api.get<AdminGroupDetail>(`/admin/groups/${id}`).then((r) => r.data);
  },

  /** Chốt ngày PROVISIONAL (chỉ môi trường Development phía server). */
  settle(date?: string): Promise<{ date: string; status: string }> {
    return api.post("/admin/settle", null, { params: { date } }).then((r) => r.data);
  },

  /** Chốt FINAL + ghi sổ quỹ (chỉ Development). */
  finalize(date?: string): Promise<{ date: string; status: string }> {
    return api.post("/admin/finalize", null, { params: { date } }).then((r) => r.data);
  },

  /** Kích hoạt DRAFT có start_date = hôm nay → ACTIVE (chỉ Development). */
  activate(): Promise<{ status: string }> {
    return api.post("/admin/activate").then((r) => r.data);
  },
};
