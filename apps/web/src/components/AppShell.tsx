import {
  BarChart3,
  CalendarCheck,
  ChevronUp,
  Flame,
  LogOut,
  Shield,
  ShieldCheck,
  Target,
  UserCircle,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { authApi } from "@/api/auth";
import { meApi } from "@/api/me";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GroupSwitcher } from "@/components/GroupSwitcher";
import { onRealtimeEvent, stopRealtime } from "@/realtime/connection";
import { firstName } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useLiveEvents } from "@/realtime/useLiveEvents";
import type { AnnouncementEvent } from "@/types/api";

const NAV_ITEMS = [
  { to: "/today", label: "Hôm nay", icon: CalendarCheck },
  { to: "/challenge", label: "Thử thách", icon: Target },
  { to: "/live-board", label: "Bảng live", icon: Users },
  { to: "/review", label: "Kiểm tra", icon: ShieldCheck },
  { to: "/stats", label: "Thống kê", icon: BarChart3 },
  { to: "/fund", label: "Quỹ", icon: Wallet },
  { to: "/group", label: "Nhóm", icon: UsersRound },
] as const;

/** Mục chỉ hiện với user có quyền quản trị. */
const ADMIN_NAV_ITEM = { to: "/admin", label: "Admin", icon: Shield } as const;

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

/**
 * Khối user ở góc dưới sidebar (mobile: avatar trên thanh trên cùng):
 * bấm mở menu "Hồ sơ" / "Đăng xuất".
 */
function UserMenu({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  if (!user) return null;

  async function handleLogout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // Ignore — clear local state anyway.
    }
    await stopRealtime();
    useAuthStore.getState().clearAuth();
    navigate("/login", { replace: true });
  }

  const menu = (
    <DropdownMenuContent
      side={compact ? "bottom" : "top"}
      align="end"
      className="w-56"
    >
      <DropdownMenuLabel>
        <p className="truncate text-sm font-semibold text-slate-800">
          {user.displayName}
        </p>
        <p className="truncate text-xs font-normal text-slate-400">
          {user.email}
        </p>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => navigate("/profile")}>
        <UserCircle />
        Hồ sơ
      </DropdownMenuItem>
      <DropdownMenuItem
        className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"
        onClick={() => void handleLogout()}
      >
        <LogOut />
        Đăng xuất
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Menu tài khoản"
            className="rounded-full transition-opacity hover:opacity-80"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage
                src={user.avatarUrl ?? undefined}
                alt={user.displayName}
              />
              <AvatarFallback>
                {user.displayName.trim().charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menu tài khoản"
          className="flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors hover:bg-slate-100/70"
        >
          <Avatar className="h-9 w-9">
            <AvatarImage
              src={user.avatarUrl ?? undefined}
              alt={user.displayName}
            />
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
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      {menu}
    </DropdownMenu>
  );
}

export function AppShell() {
  useLiveEvents();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const navItems = user?.isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  // Sync user từ server mỗi lần mở app: user trong store persist có thể lỗi thời
  // (avatar/tên đổi từ thiết bị khác) → gây hiện tượng avatar "lúc có lúc không".
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    meApi
      .get()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        // Giữ user local; interceptor axios xử lý token hết hạn.
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, setUser]);

  // Thông báo toàn hệ thống từ admin (SignalR): hiện toast cho mọi user online.
  useEffect(() => {
    if (!accessToken) return;
    return onRealtimeEvent<AnnouncementEvent>("Announcement", (evt) => {
      toast.info(`Thông báo từ ${evt.senderName}`, {
        description: evt.message,
        duration: 8000,
      });
    });
  }, [accessToken]);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-5 py-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
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
          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-1.5">
            <UserMenu />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <UserMenu compact />
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
