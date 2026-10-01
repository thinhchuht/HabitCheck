import {
  Activity,
  BarChart3,
  LayoutDashboard,
  Settings2,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

/**
 * Thanh tab của khu admin — admin không chơi thử thách, chỉ vận hành hệ thống:
 * Tổng quan / User / Nhóm / Hoạt động / Quỹ / Thống kê / Vận hành.
 */
const ADMIN_TABS = [
  { to: "/admin", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "User", icon: Users, end: false },
  { to: "/admin/groups", label: "Nhóm", icon: UsersRound, end: false },
  { to: "/admin/activities", label: "Hoạt động", icon: Activity, end: false },
  { to: "/admin/fund", label: "Quỹ", icon: Wallet, end: false },
  { to: "/admin/stats", label: "Thống kê", icon: BarChart3, end: false },
  { to: "/admin/ops", label: "Vận hành", icon: Settings2, end: false },
] as const;

export function AdminLayout() {
  return (
    <div>
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">
        {ADMIN_TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
