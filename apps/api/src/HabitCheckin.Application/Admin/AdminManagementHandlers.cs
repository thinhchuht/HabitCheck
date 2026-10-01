using FluentValidation;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Admin;

// ---------- Ghi log thao tác admin ----------

public sealed record LogAdminAuditCommand(
    Guid AdminId, string Action, string? TargetType, Guid? TargetId, string? Detail) : IRequest<Unit>;

public sealed class LogAdminAuditHandler(IAppDbContext db, IClock clock)
    : IRequestHandler<LogAdminAuditCommand, Unit>
{
    public async Task<Unit> Handle(LogAdminAuditCommand request, CancellationToken ct)
    {
        db.AdminAuditLogs.Add(new AdminAuditLog
        {
            AdminId = request.AdminId,
            Action = request.Action,
            TargetType = request.TargetType,
            TargetId = request.TargetId,
            Detail = request.Detail,
            CreatedAt = clock.UtcNow
        });
        await db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

public sealed record AdminAuditLogDto(
    string Id, string AdminId, string AdminName, string Action,
    string? TargetType, string? TargetId, string? Detail, string CreatedAt);

public sealed record AdminAuditLogListDto(int Total, List<AdminAuditLogDto> Logs);

public sealed record AuditLogsQuery(int Page, int PageSize) : IRequest<AdminAuditLogListDto>;

public sealed class AuditLogsHandler(IAppDbContext db) : IRequestHandler<AuditLogsQuery, AdminAuditLogListDto>
{
    public async Task<AdminAuditLogListDto> Handle(AuditLogsQuery request, CancellationToken ct)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var q = db.AdminAuditLogs.AsNoTracking()
            .Include(l => l.Admin)
            .OrderByDescending(l => l.CreatedAt);
        var total = await q.CountAsync(ct);
        var rows = await q.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);

        return new AdminAuditLogListDto(total, rows.Select(l => new AdminAuditLogDto(
            l.Id.ToString(), l.AdminId.ToString(), l.Admin?.DisplayName ?? "Unknown",
            l.Action, l.TargetType, l.TargetId?.ToString(), l.Detail,
            Fmt.Iso(l.CreatedAt)!)).ToList());
    }
}

// ---------- Cấm / bỏ cấm user ----------

public sealed record BanUserCommand(Guid UserId, bool Banned) : IRequest<UserDto>;

public sealed class BanUserHandler(IAppDbContext db, ICurrentUser current, IClock clock)
    : IRequestHandler<BanUserCommand, UserDto>
{
    public async Task<UserDto> Handle(BanUserCommand request, CancellationToken ct)
    {
        if (request.UserId == current.Id && request.Banned)
            throw new BusinessRuleException("Không thể tự cấm tài khoản của chính mình");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, ct)
            ?? throw new NotFoundException("Không tìm thấy người dùng");
        user.IsBanned = request.Banned;
        await db.SaveChangesAsync(ct);

        db.AdminAuditLogs.Add(new AdminAuditLog
        {
            AdminId = current.Id,
            Action = request.Banned ? "BAN" : "UNBAN",
            TargetType = "USER",
            TargetId = user.Id,
            Detail = $"User {user.DisplayName} <{user.Email}> đã được {(request.Banned ? "cấm" : "bỏ cấm")}",
            CreatedAt = clock.UtcNow
        });
        await db.SaveChangesAsync(ct);
        return user.ToDto();
    }
}

// ---------- Đổi tên hiển thị thay user ----------

public sealed record RenameUserCommand(Guid UserId, string DisplayName) : IRequest<UserDto>;

public sealed class RenameUserValidator : AbstractValidator<RenameUserCommand>
{
    public RenameUserValidator()
    {
        RuleFor(x => x.UserId).NotEmpty().WithMessage("Thiếu userId");
        RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(100).WithMessage("Tên hiển thị 1-100 ký tự");
    }
}

public sealed class RenameUserHandler(IAppDbContext db, ICurrentUser current, IClock clock)
    : IRequestHandler<RenameUserCommand, UserDto>
{
    public async Task<UserDto> Handle(RenameUserCommand request, CancellationToken ct)
    {
        var name = request.DisplayName.Trim();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, ct)
            ?? throw new NotFoundException("Không tìm thấy người dùng");

        var oldName = user.DisplayName;
        user.DisplayName = name;
        await db.SaveChangesAsync(ct);

        db.AdminAuditLogs.Add(new AdminAuditLog
        {
            AdminId = current.Id,
            Action = "RENAME",
            TargetType = "USER",
            TargetId = user.Id,
            Detail = $"Đổi tên user: {oldName} → {name}",
            CreatedAt = clock.UtcNow
        });
        await db.SaveChangesAsync(ct);
        return user.ToDto();
    }
}

// ---------- Đặt lại mật khẩu tài khoản password (admin) ----------

public sealed record SetUserPasswordCommand(Guid UserId, string NewPassword) : IRequest<Unit>;

public sealed class SetUserPasswordValidator : AbstractValidator<SetUserPasswordCommand>
{
    public SetUserPasswordValidator()
    {
        RuleFor(x => x.UserId).NotEmpty().WithMessage("Thiếu userId");
        RuleFor(x => x.NewPassword).MinimumLength(8).MaximumLength(128)
            .WithMessage("Mật khẩu mới 8-128 ký tự");
    }
}

public sealed class SetUserPasswordHandler(IAppDbContext db, ICurrentUser current, IClock clock)
    : IRequestHandler<SetUserPasswordCommand, Unit>
{
    public async Task<Unit> Handle(SetUserPasswordCommand request, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, ct)
            ?? throw new NotFoundException("Không tìm thấy người dùng");
        if (user.Username is null)
            throw new BusinessRuleException("User đăng nhập bằng Google không có mật khẩu để đặt lại");

        user.PasswordHash = Pbkdf2PasswordHasher.Hash(request.NewPassword);
        db.AdminAuditLogs.Add(new AdminAuditLog
        {
            AdminId = current.Id,
            Action = "SET_PASSWORD",
            TargetType = "USER",
            TargetId = user.Id,
            Detail = $"Đổi mật khẩu tài khoản @{user.Username}",
            CreatedAt = clock.UtcNow
        });
        await db.SaveChangesAsync(ct);
        return Unit.Value;
    }
}

// ---------- Broadcast thông báo toàn hệ thống ----------

public sealed record AnnounceCommand(string Message) : IRequest<AnnounceResultDto>;

public sealed record AnnounceResultDto(string Message, string SenderName, string SentAt);

public sealed class AnnounceValidator : AbstractValidator<AnnounceCommand>
{
    public AnnounceValidator() =>
        RuleFor(x => x.Message).NotEmpty().MaximumLength(500).WithMessage("Thông báo 1-500 ký tự");
}

public sealed class AnnounceHandler(IAppDbContext db, ICurrentUser current, IClock clock, IRealtimeNotifier realtime)
    : IRequestHandler<AnnounceCommand, AnnounceResultDto>
{
    public async Task<AnnounceResultDto> Handle(AnnounceCommand request, CancellationToken ct)
    {
        var message = request.Message.Trim();
        var admin = await db.Users.AsNoTracking().FirstAsync(u => u.Id == current.Id, ct);
        var at = clock.UtcNow;

        await realtime.BroadcastAsync(EventNames.Announcement,
            new AnnouncementEvent(message, admin.DisplayName, at), ct);

        db.AdminAuditLogs.Add(new AdminAuditLog
        {
            AdminId = current.Id,
            Action = "ANNOUNCE",
            Detail = message.Length <= 500 ? message : message[..500],
            CreatedAt = at
        });
        await db.SaveChangesAsync(ct);
        return new AnnounceResultDto(message, admin.DisplayName, Fmt.Iso(at)!);
    }
}

// ---------- Tất cả hoạt động (mọi nhóm) ----------

public sealed record AdminActivityDto(
    string Id, string Name, string? Icon, string Type, string ProofType,
    string ChallengeTitle, string ChallengeStatus, string StartDate, string EndDate,
    string GroupName, string OwnerName, int CheckinCount);

public sealed record AdminActivityListDto(int Total, List<AdminActivityDto> Activities);

public sealed record AdminActivitiesQuery(string? Search, string? Type, int Page, int PageSize)
    : IRequest<AdminActivityListDto>;

public sealed class AdminActivitiesHandler(IAppDbContext db)
    : IRequestHandler<AdminActivitiesQuery, AdminActivityListDto>
{
    public async Task<AdminActivityListDto> Handle(AdminActivitiesQuery request, CancellationToken ct)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var s = request.Search?.Trim().ToLowerInvariant();
        ActivityType? type = Enum.TryParse<ActivityType>(request.Type, ignoreCase: true, out var t) ? t : null;

        var q = from a in db.Activities.AsNoTracking()
                join c in db.Challenges.AsNoTracking() on a.ChallengeId equals c.Id
                join g in db.Groups.AsNoTracking() on c.GroupId equals g.Id
                join o in db.Users.AsNoTracking() on c.UserId equals o.Id
                where (type == null || a.Type == type)
                where string.IsNullOrEmpty(s) || a.Name.ToLower().Contains(s) || c.Title.ToLower().Contains(s)
                select new { a, c, g, o };

        var total = await q.CountAsync(ct);
        var rows = await q
            .OrderByDescending(x => x.c.StartDate)
            .ThenBy(x => x.a.SortOrder)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        // Enum trả chuỗi HOA — khớp UpperEnumNamingPolicy của JSON toàn API.
        var activities = rows.Select(x => new AdminActivityDto(
            x.a.Id.ToString(), x.a.Name, x.a.Icon,
            x.a.Type.ToString().ToUpperInvariant(), x.a.ProofType.ToString().ToUpperInvariant(),
            x.c.Title, x.c.Status.ToString().ToUpperInvariant(),
            x.c.StartDate.ToString("yyyy-MM-dd"), x.c.EndDate.ToString("yyyy-MM-dd"),
            x.g.Name, x.o.DisplayName,
            db.CheckIns.Count(ci => ci.ActivityId == x.a.Id)))
            .ToList();

        return new AdminActivityListDto(total, activities);
    }
}

// ---------- Quỹ phạt toàn hệ thống ----------

public sealed record AdminGroupFundDto(
    string GroupId, string Name, long TotalPenalty, long TotalPaid, long Outstanding);

public sealed record AdminLedgerEntryDto(
    string Id, string GroupName, string UserId, string UserName,
    long Amount, string Kind, string? Note, string? CreatedBy, string CreatedAt);

public sealed record AdminFundDto(
    long GrandTotalPenalty, long GrandTotalPaid, long GrandOutstanding,
    List<AdminGroupFundDto> Groups, List<AdminLedgerEntryDto> RecentEntries);

public sealed record AdminFundQuery : IRequest<AdminFundDto>;

public sealed class AdminFundHandler(IAppDbContext db) : IRequestHandler<AdminFundQuery, AdminFundDto>
{
    public async Task<AdminFundDto> Handle(AdminFundQuery request, CancellationToken ct)
    {
        var groups = await db.Groups.AsNoTracking().OrderByDescending(g => g.CreatedAt).ToListAsync(ct);
        var groupIds = groups.Select(g => g.Id).ToList();

        // Phạt theo nhóm: tổng daily_results của các challenge không bị huỷ.
        var challengeGroups = await db.Challenges
            .Where(c => groupIds.Contains(c.GroupId) && c.Status != ChallengeStatus.Cancelled)
            .Select(c => new { c.GroupId, c.Id })
            .ToListAsync(ct);
        var challengeIds = challengeGroups.Select(c => c.Id).ToList();
        var challengeToGroup = challengeGroups.ToDictionary(c => c.Id, c => c.GroupId);

        var penaltyByGroup = new Dictionary<Guid, long>();
        if (challengeIds.Count > 0)
        {
            var rows = await db.DailyResults.AsNoTracking()
                .Where(d => challengeIds.Contains(d.ChallengeId))
                .GroupBy(d => d.ChallengeId)
                .Select(g => new { ChallengeId = g.Key, Total = g.Sum(x => x.PenaltyAmount) })
                .ToListAsync(ct);
            foreach (var r in rows)
            {
                if (!challengeToGroup.TryGetValue(r.ChallengeId, out var gid)) continue;
                penaltyByGroup[gid] = penaltyByGroup.GetValueOrDefault(gid) + r.Total;
            }
        }

        var paidRows = await db.PenaltyLedger.AsNoTracking()
            .Where(l => l.Kind == LedgerKind.Payment && groupIds.Contains(l.GroupId))
            .GroupBy(l => l.GroupId)
            .Select(g => new { GroupId = g.Key, Total = g.Sum(x => x.Amount) })
            .ToListAsync(ct);
        var paidByGroup = paidRows.ToDictionary(r => r.GroupId, r => r.Total);

        var groupFunds = groups.Select(g =>
        {
            var penalty = penaltyByGroup.GetValueOrDefault(g.Id);
            var paid = paidByGroup.GetValueOrDefault(g.Id);
            return new AdminGroupFundDto(g.Id.ToString(), g.Name, penalty, paid, penalty - paid);
        }).ToList();

        var recent = await db.PenaltyLedger.AsNoTracking()
            .Include(l => l.User)
            .Include(l => l.CreatedByUser)
            .OrderByDescending(l => l.CreatedAt)
            .Take(50)
            .ToListAsync(ct);
        var recentEntries = recent.Select(l => new AdminLedgerEntryDto(
            l.Id.ToString(),
            groups.FirstOrDefault(g => g.Id == l.GroupId)?.Name ?? "Unknown",
            l.UserId.ToString(), l.User?.DisplayName ?? "Unknown",
            l.Amount, l.Kind.ToString().ToUpperInvariant(), l.Note,
            l.CreatedByUser?.DisplayName,
            Fmt.Iso(l.CreatedAt)!)).ToList();

        var grandPenalty = groupFunds.Sum(f => f.TotalPenalty);
        var grandPaid = groupFunds.Sum(f => f.TotalPaid);
        return new AdminFundDto(grandPenalty, grandPaid, grandPenalty - grandPaid, groupFunds, recentEntries);
    }
}

// ---------- Thống kê mở rộng (xu hướng, xếp hạng, top phạt) ----------

public sealed record AdminDailyStatDto(string Date, int Checkins, long PenaltyVnd);

public sealed record AdminGroupRankDto(
    string GroupId, string Name, int MemberCount,
    int SettledDays, int FailedDays, long TotalPenalty, double? PassRate);

public sealed record AdminTopPenaltyUserDto(
    string UserId, string DisplayName, string Email, long TotalPenalty, int FailedDays);

public sealed record AdminStatsOverviewDto(
    List<AdminDailyStatDto> DailyTrend,
    List<AdminGroupRankDto> GroupRanking,
    List<AdminTopPenaltyUserDto> TopPenaltyUsers);

public sealed record AdminStatsOverviewQuery : IRequest<AdminStatsOverviewDto>;

public sealed class AdminStatsOverviewHandler(IAppDbContext db, IClock clock)
    : IRequestHandler<AdminStatsOverviewQuery, AdminStatsOverviewDto>
{
    private const int TrendDays = 14;

    public async Task<AdminStatsOverviewDto> Handle(AdminStatsOverviewQuery request, CancellationToken ct)
    {
        var today = clock.TodayLocal;
        var from = today.AddDays(-(TrendDays - 1));

        // 1) Xu hướng 14 ngày: số check-in + tiền phạt (daily_results) theo ngày.
        var checkins = await db.CheckIns.AsNoTracking()
            .Where(c => c.LocalDate >= from && c.LocalDate <= today)
            .GroupBy(c => c.LocalDate)
            .Select(g => new { Date = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Date, x => x.Count, ct);
        var penalties = await db.DailyResults.AsNoTracking()
            .Where(d => d.LocalDate >= from && d.LocalDate <= today)
            .GroupBy(d => d.LocalDate)
            .Select(g => new { Date = g.Key, Total = g.Sum(x => x.PenaltyAmount) })
            .ToDictionaryAsync(x => x.Date, x => x.Total, ct);

        var trend = new List<AdminDailyStatDto>(TrendDays);
        for (var d = from; d <= today; d = d.AddDays(1))
        {
            trend.Add(new AdminDailyStatDto(
                d.ToString("yyyy-MM-dd"),
                checkins.GetValueOrDefault(d),
                penalties.GetValueOrDefault(d)));
        }

        // 2) Xếp hạng nhóm.
        var groups = await db.Groups.AsNoTracking().ToListAsync(ct);
        var groupIds = groups.Select(g => g.Id).ToList();
        var memberCounts = await db.GroupMembers
            .GroupBy(m => m.GroupId)
            .Select(g => new { GroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.GroupId, x => x.Count, ct);

        var challengeGroups = await db.Challenges
            .Where(c => groupIds.Contains(c.GroupId) && c.Status != ChallengeStatus.Cancelled)
            .Select(c => new { c.GroupId, c.Id })
            .ToListAsync(ct);
        var challengeIds = challengeGroups.Select(c => c.Id).ToList();
        var challengeToGroup = challengeGroups.ToDictionary(c => c.Id, c => c.GroupId);

        var statByChallenge = new Dictionary<Guid, (int Settled, int Failed, long Penalty)>();
        if (challengeIds.Count > 0)
        {
            var rows = await db.DailyResults.AsNoTracking()
                .Where(d => challengeIds.Contains(d.ChallengeId))
                .GroupBy(d => d.ChallengeId)
                .Select(g => new
                {
                    ChallengeId = g.Key,
                    Settled = g.Count(),
                    Failed = g.Count(x => x.FailedCount > 0),
                    Penalty = g.Sum(x => x.PenaltyAmount)
                })
                .ToDictionaryAsync(x => x.ChallengeId, x => (x.Settled, x.Failed, x.Penalty), ct);
            statByChallenge = rows;
        }

        var ranking = groups
            .Select(g =>
            {
                var settled = 0; var failed = 0; long penalty = 0;
                foreach (var (cid, gg) in challengeToGroup)
                {
                    if (gg != g.Id) continue;
                    if (!statByChallenge.TryGetValue(cid, out var st)) continue;
                    settled += st.Settled;
                    failed += st.Failed;
                    penalty += st.Penalty;
                }
                double? passRate = settled > 0 ? Math.Round((settled - failed) / (double)settled, 4) : null;
                return new AdminGroupRankDto(
                    g.Id.ToString(), g.Name, memberCounts.GetValueOrDefault(g.Id),
                    settled, failed, penalty, passRate);
            })
            .OrderByDescending(r => r.PassRate ?? 0)
            .ThenByDescending(r => r.TotalPenalty * -1)
            .ToList();

        // 3) Top user nhiều phạt nhất.
        var topUsers = await db.DailyResults.AsNoTracking()
            .GroupBy(d => d.UserId)
            .Select(g => new
            {
                UserId = g.Key,
                TotalPenalty = g.Sum(x => x.PenaltyAmount),
                FailedDays = g.Count(x => x.FailedCount > 0)
            })
            .Where(x => x.TotalPenalty > 0)
            .OrderByDescending(x => x.TotalPenalty)
            .Take(10)
            .ToListAsync(ct);
        var topUserIds = topUsers.Select(t => t.UserId).ToList();
        var users = await db.Users.AsNoTracking()
            .Where(u => topUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);

        return new AdminStatsOverviewDto(trend, ranking, topUsers.Select(t => new AdminTopPenaltyUserDto(
            t.UserId.ToString(),
            users.TryGetValue(t.UserId, out var u) ? u.DisplayName : "Unknown",
            users.TryGetValue(t.UserId, out var u2) ? u2.Email : "",
            t.TotalPenalty, t.FailedDays)).ToList());
    }
}
