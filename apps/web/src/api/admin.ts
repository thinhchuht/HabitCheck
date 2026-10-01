import { api } from "./client";
import type {
  AdminActivityList,
  AdminAuditLogList,
  AdminFund,
  AdminGroupDetail,
  AdminGroupList,
  AdminJobStatus,
  AdminStats,
  AdminStatsOverview,
  AdminUserDetail,
  AdminUserList,
  UserDto,
} from "@/types/api";

/** Các endpoint /api/admin/* — chỉ trả 200 với user có quyền admin. */
export const adminApi = {
  stats(): Promise<AdminStats> {
    return api.get<AdminStats>("/admin/stats").then((r) => r.data);
  },

  users(search?: string, page = 1, pageSize = 20): Promise<AdminUserList> {
    return api
      .get<AdminUserList>("/admin/users", {
        params: { search, page, pageSize },
      })
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

  /** Cấm tài khoản — mọi request của user này bị chặn (403). */
  ban(id: string): Promise<UserDto> {
    return api.post<UserDto>(`/admin/users/${id}/ban`).then((r) => r.data);
  },

  /** Bỏ cấm tài khoản. */
  unban(id: string): Promise<UserDto> {
    return api.delete<UserDto>(`/admin/users/${id}/ban`).then((r) => r.data);
  },

  /** Đổi tên hiển thị thay user. */
  rename(id: string, displayName: string): Promise<UserDto> {
    return api
      .patch<UserDto>(`/admin/users/${id}`, { displayName })
      .then((r) => r.data);
  },

  /** Đặt lại mật khẩu (chỉ user có tài khoản username). */
  setPassword(id: string, newPassword: string): Promise<void> {
    return api
      .post(`/admin/users/${id}/password`, { newPassword })
      .then((r) => r.data);
  },

  groups(): Promise<AdminGroupList> {
    return api.get<AdminGroupList>("/admin/groups").then((r) => r.data);
  },

  group(id: string): Promise<AdminGroupDetail> {
    return api.get<AdminGroupDetail>(`/admin/groups/${id}`).then((r) => r.data);
  },

  /** Tất cả hoạt động mọi nhóm, lọc theo tên/kỳ + kiểu hoạt động. */
  activities(
    search?: string,
    type?: string,
    page = 1,
    pageSize = 20,
  ): Promise<AdminActivityList> {
    return api
      .get<AdminActivityList>("/admin/activities", {
        params: { search, type, page, pageSize },
      })
      .then((r) => r.data);
  },

  /** Quỹ phạt toàn hệ thống + sổ cái gần đây. */
  fund(): Promise<AdminFund> {
    return api.get<AdminFund>("/admin/fund").then((r) => r.data);
  },

  /** Xu hướng 14 ngày, xếp hạng nhóm, top user phạt nhiều. */
  statsOverview(): Promise<AdminStatsOverview> {
    return api
      .get<AdminStatsOverview>("/admin/stats/overview")
      .then((r) => r.data);
  },

  /** Trạng thái các job định kỳ (cron, lần chạy tới, lần chạy gần nhất). */
  jobs(): Promise<AdminJobStatus[]> {
    return api.get<AdminJobStatus[]>("/admin/jobs").then((r) => r.data);
  },

  /** Lịch sử thao tác admin. */
  auditLogs(page = 1, pageSize = 30): Promise<AdminAuditLogList> {
    return api
      .get<AdminAuditLogList>("/admin/audit-logs", {
        params: { page, pageSize },
      })
      .then((r) => r.data);
  },

  /** Broadcast thông báo tới tất cả client online (SignalR). */
  announce(message: string): Promise<{
    message: string;
    senderName: string;
    sentAt: string;
  }> {
    return api.post("/admin/announce", { message }).then((r) => r.data);
  },

  /** Chốt ngày PROVISIONAL (chỉ môi trường Development phía server). */
  settle(date?: string): Promise<{ date: string; status: string }> {
    return api
      .post("/admin/settle", null, { params: { date } })
      .then((r) => r.data);
  },

  /** Chốt FINAL + ghi sổ quỹ (chỉ Development). */
  finalize(date?: string): Promise<{ date: string; status: string }> {
    return api
      .post("/admin/finalize", null, { params: { date } })
      .then((r) => r.data);
  },

  /** Kích hoạt DRAFT có start_date = hôm nay → ACTIVE (chỉ Development). */
  activate(): Promise<{ status: string }> {
    return api.post("/admin/activate").then((r) => r.data);
  },
};
