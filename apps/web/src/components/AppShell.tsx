import {
  BarChart3,
  CalendarCheck,
  Flame,
  ShieldCheck,
  Target,
  UserCircle,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GroupSwitcher } from "@/components/GroupSwitcher";
import { firstName } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useLiveEvents } from "@/realtime/useLiveEvents";

const NAV_ITEMS = [
  { to: "/today", label: "Hôm nay", icon: CalendarCheck },
  { to: "/challenge", label: "Thử thách", icon: Target },
  { to: "/live-board", label: "Bảng live", icon: Users },
  { to: "/review", label: "Kiểm tra", icon: ShieldCheck },
  { to: "/stats", label: "Thống kê", icon: BarChart3 },
  { to: "/fund", label: "Quỹ", icon: Wallet },
  { to: "/group", label: "Nhóm", icon: UsersRound },
  { to: "/profile", label: "Hồ sơ", icon: UserCircle },
] as const;

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
        <Flame className="h-5 w-5" />
      </span>
      <span className="text-base font-bold tracking-tight text-slate-900">
        Habit <span className="text-indigo-600">Check-in</span>
      </span>
    </div>
  );
}

function UserChip() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return (
    <div className="flex items-center gap-2.5">
      <Avatar className="h-9 w-9">
        {user.avatarUrl ? (
          <AvatarImage src={user.avatarUrl} alt={user.displayName} />
        ) : null}
        <AvatarFallback>
          {firstName(user.displayName).toUpperCase().slice(0, 1)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">
          {user.displayName}
        </p>
        <p className="truncate text-xs text-slate-400">{user.email}</p>
      </div>
    </div>
  );
}

export function AppShell() {
  useLiveEvents();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-5 py-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-indigo-50 font-semibold text-indigo-700"
                    : "font-medium text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      isActive ? "text-indigo-600" : "text-slate-400"
                    }`}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
          <GroupSwitcher />
        </nav>
        <div className="border-t border-slate-100 px-3 py-3">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
            <UserChip />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <Avatar className="h-9 w-9">
          {user?.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user.displayName} />
          ) : null}
          <AvatarFallback>
            {(user?.displayName ?? "?").trim().charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </header>

      <main className="px-4 py-6 md:ml-64 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-6xl pb-20 md:pb-0">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tab bar (first 4 items) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        {NAV_ITEMS.slice(0, 4).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                isActive ? "text-indigo-600" : "text-slate-500"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
