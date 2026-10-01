using FluentValidation;
using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Groups;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Admin;

// ---------- DTOs ----------

public sealed record AdminUserSummaryDto(
    string Id, string DisplayName, string Email, string? AvatarUrl,
    bool IsAdmin, bool IsBanned, int GroupCount, string CreatedAt, string? LastLoginAt);

public sealed record AdminStatsDto(
    int TotalUsers,
    int TotalGroups,
    int ActiveChallenges,
    int DraftChallenges,
    int CheckinsToday,
    long PenaltyTodayVnd,
    long PenaltyTotalVnd,
    List<AdminUserSummaryDto> RecentUsers);

public sealed record AdminUserDto(
    string Id, string DisplayName, string Email, string? Username, string? AvatarUrl, bool IsAdmin, bool IsBanned,
    string CreatedAt, string? LastLoginAt, int GroupCount,
    int SettledDays, int FailedDays, long TotalPenaltyVnd);

public sealed record AdminUserListDto(int Total, List<AdminUserDto> Users);

/// <summary>Một challenge kèm số liệu chốt ngày (tái dùng ChallengeDto có sẵn).</summary>
public sealed record AdminChallengeStatsDto(ChallengeDto Challenge, int SettledDays, int FailedDays, long TotalPenaltyVnd);

public sealed record AdminUserGroupDto(
    string GroupId, string GroupName, string Role, string OwnerName, List<AdminChallengeStatsDto> Challenges);

public sealed record AdminUserDetailDto(AdminUserDto User, List<AdminUserGroupDto> Groups);

public sealed record AdminGroupDto(
    string Id, string Name, string OwnerId, string OwnerName,
    int MemberCount, int ChallengeCount, string CreatedAt);

public sealed record AdminGroupListDto(int Total, List<AdminGroupDto> Groups);

public sealed record AdminGroupDetailDto(GroupDto Group, List<AdminChallengeStatsDto> Challenges);

// ---------- Stats ----------

public sealed record AdminStatsQuery : IRequest<AdminStatsDto>;

public sealed class AdminStatsHandler(IAppDbContext db, IClock clock) : IRequestHandler<AdminStatsQuery, AdminStatsDto>
{
    public async Task<AdminStatsDto> Handle(AdminStatsQuery request, CancellationToken ct)
    {
        var today = clock.TodayLocal;
        var totalUsers = await db.Users.CountAsync(ct);
        var totalGroups = await db.Groups.CountAsync(ct);
        var activeChallenges = await db.Challenges.CountAsync(c => c.Status == ChallengeStatus.Active, ct);
        var draftChallenges = await db.Challenges.CountAsync(c => c.Status == ChallengeStatus.Draft, ct);
        var checkinsToday = await db.CheckIns.CountAsync(c => c.LocalDate == today, ct);
        var penaltyToday = await db.DailyResults.Where(r => r.LocalDate == today).SumAsync(r => (long?)r.PenaltyAmount) ?? 0;
        var penaltyTotal = await db.DailyResults.SumAsync(r => (long?)r.PenaltyAmount) ?? 0;

        var recentUsers = await db.Users.AsNoTracking()
            .OrderByDescending(u => u.CreatedAt)
            .Take(5)
            .ToListAsync(ct);
        var recentIds = recentUsers.Select(u => u.Id).ToList();
        var groupCounts = await db.GroupMembers
            .Where(m => recentIds.Contains(m.UserId))
            .GroupBy(m => m.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, x => x.Count, ct);

        return new AdminStatsDto(
            totalUsers, totalGroups, activeChallenges, draftChallenges,
            checkinsToday, penaltyToday, penaltyTotal,
            recentUsers.Select(u => new AdminUserSummaryDto(
                u.Id.ToString(), u.DisplayName, u.Email, u.AvatarUrl, u.IsAdmin, u.IsBanned,
                groupCounts.GetValueOrDefault(u.Id), Fmt.Iso(u.CreatedAt)!, Fmt.Iso(u.LastLoginAt))).ToList());
    }
}

// ---------- Users ----------

public sealed record AdminUsersQuery(string? Search, int Page, int PageSize) : IRequest<AdminUserListDto>;

public sealed class AdminUsersHandler(IAppDbContext db) : IRequestHandler<AdminUsersQuery, AdminUserListDto>
{
    public async Task<AdminUserListDto> Handle(AdminUsersQuery request, CancellationToken ct)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);
        var s = request.Search?.Trim().ToLowerInvariant();

        var q = db.Users.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(s))
            q = q.Where(u => u.DisplayName.ToLower().Contains(s) || u.Email.ToLower().Contains(s));

        var total = await q.CountAsync(ct);
        var users = await q
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id,
                u.DisplayName,
                u.Email,
                u.Username,
                u.AvatarUrl,
                u.IsAdmin,
                u.IsBanned,
                u.CreatedAt,
                u.LastLoginAt,
                GroupCount = db.GroupMembers.Count(m => m.UserId == u.Id),
                SettledDays = db.DailyResults.Count(r => r.UserId == u.Id),
                FailedDays = db.DailyResults.Count(r => r.UserId == u.Id && r.FailedCount > 0),
                TotalPenalty = db.DailyResults.Where(r => r.UserId == u.Id).Sum(r => (long?)r.PenaltyAmount) ?? 0L
            })
            .ToListAsync(ct);

        return new AdminUserListDto(total, users.Select(u => new AdminUserDto(
            u.Id.ToString(), u.DisplayName, u.Email, u.Username, u.AvatarUrl, u.IsAdmin, u.IsBanned,
            Fmt.Iso(u.CreatedAt)!, Fmt.Iso(u.LastLoginAt),
            u.GroupCount, u.SettledDays, u.FailedDays, u.TotalPenalty)).ToList());
    }
}

// ---------- User detail ----------

public sealed record AdminUserDetailQuery(Guid UserId) : IRequest<AdminUserDetailDto>;

public sealed class AdminUserDetailHandler(IAppDbContext db) : IRequestHandler<AdminUserDetailQuery, AdminUserDetailDto>
{
    public async Task<AdminUserDetailDto> Handle(AdminUserDetailQuery request, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == request.UserId, ct)
            ?? throw new NotFoundException("Không tìm thấy người dùng");

        var groupCount = await db.GroupMembers.CountAsync(m => m.UserId == user.Id, ct);
        var settledDays = await db.DailyResults.CountAsync(r => r.UserId == user.Id, ct);
        var failedDays = await db.DailyResults.CountAsync(r => r.UserId == user.Id && r.FailedCount > 0, ct);
        var totalPenalty = await db.DailyResults.Where(r => r.UserId == user.Id).SumAsync(r => (long?)r.PenaltyAmount) ?? 0;
        var userDto = new AdminUserDto(
            user.Id.ToString(), user.DisplayName, user.Email, user.Username, user.AvatarUrl,
            user.IsAdmin, user.IsBanned,
            Fmt.Iso(user.CreatedAt)!, Fmt.Iso(user.LastLoginAt), groupCount, settledDays, failedDays, totalPenalty);

        var memberships = await db.GroupMembers.AsNoTracking()
            .Where(m => m.UserId == user.Id)
            .ToListAsync(ct);
        var groupIds = memberships.Select(m => m.GroupId).ToList();
        var groups = await db.Groups.AsNoTracking()
            .Where(g => groupIds.Contains(g.Id))
            .ToListAsync(ct);
        var ownerIds = groups.Select(g => g.OwnerId).Distinct().ToList();
        var owners = await db.Users.AsNoTracking()
            .Where(u => ownerIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);

        var challenges = await db.Challenges.AsNoTracking()
            .Where(c => c.UserId == user.Id)
            .ToListAsync(ct);
        var (challengeDtos, statsByChallenge) = await BuildChallengeStatsAsync(db, challenges, ct);

        var userGroups = groups
            .OrderBy(g => g.CreatedAt)
            .Select(g =>
            {
                var role = memberships.First(m => m.GroupId == g.Id).Role.ToString().ToUpperInvariant();
                return new AdminUserGroupDto(
                    g.Id.ToString(), g.Name, role,
                    owners.TryGetValue(g.OwnerId, out var o) ? o.DisplayName : "?",
                    challenges.Where(c => c.GroupId == g.Id)
                        .OrderBy(c => c.StartDate)
                        .Select(c =>
                        {
                            var st = statsByChallenge[c.Id];
                            return new AdminChallengeStatsDto(challengeDtos[c.Id], st.Settled, st.Failed, st.Penalty);
                        })
                        .ToList());
            })
            .ToList();

        return new AdminUserDetailDto(userDto, userGroups);
    }

    internal static async Task<(Dictionary<Guid, ChallengeDto> Dtos, Dictionary<Guid, (int Settled, int Failed, long Penalty)> Stats)>
        BuildChallengeStatsAsync(IAppDbContext db, List<Challenge> challenges, CancellationToken ct)
    {
        var ids = challenges.Select(c => c.Id).ToList();
        var activities = await db.Activities.AsNoTracking()
            .Where(a => ids.Contains(a.ChallengeId))
            .ToListAsync(ct);
        var ownerIds = challenges.Select(c => c.UserId).Distinct().ToList();
        var owners = await db.Users.AsNoTracking()
            .Where(u => ownerIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);
        var results = await db.DailyResults.AsNoTracking()
            .Where(r => ids.Contains(r.ChallengeId))
            .ToListAsync(ct);

        var dtos = new Dictionary<Guid, ChallengeDto>();
        var stats = new Dictionary<Guid, (int, int, long)>();
        foreach (var c in challenges)
        {
            dtos[c.Id] = c.ToDto(owners[c.UserId].DisplayName, activities.Where(a => a.ChallengeId == c.Id).ToList());
            var rs = results.Where(r => r.ChallengeId == c.Id);
            stats[c.Id] = (rs.Count(), rs.Count(r => r.FailedCount > 0), rs.Sum(r => r.PenaltyAmount));
        }
        return (dtos, stats);
    }
}

// ---------- Groups ----------

public sealed record AdminGroupsQuery(int Page, int PageSize) : IRequest<AdminGroupListDto>;

public sealed class AdminGroupsHandler(IAppDbContext db) : IRequestHandler<AdminGroupsQuery, AdminGroupListDto>
{
    public async Task<AdminGroupListDto> Handle(AdminGroupsQuery request, CancellationToken ct)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var total = await db.Groups.AsNoTracking().CountAsync(ct);
        var groups = await db.Groups.AsNoTracking()
            .OrderByDescending(g => g.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
        if (groups.Count == 0) return new AdminGroupListDto(total, []);
        var ownerIds = groups.Select(g => g.OwnerId).Distinct().ToList();
        var owners = await db.Users.AsNoTracking()
            .Where(u => ownerIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);
        var ids = groups.Select(g => g.Id).ToList();
        // Chỉ đếm thành viên / kỳ của các nhóm trong trang hiện tại.
        var memberCounts = await db.GroupMembers.AsNoTracking()
            .Where(m => ids.Contains(m.GroupId))
            .GroupBy(m => m.GroupId)
            .Select(g => new { GroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.GroupId, x => x.Count, ct);
        var challengeCounts = await db.Challenges.AsNoTracking()
            .Where(c => ids.Contains(c.GroupId))
            .GroupBy(c => c.GroupId)
            .Select(g => new { GroupId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.GroupId, x => x.Count, ct);

        return new AdminGroupListDto(total, groups.Select(g => new AdminGroupDto(
            g.Id.ToString(), g.Name, g.OwnerId.ToString(),
            owners.TryGetValue(g.OwnerId, out var o) ? o.DisplayName : "?",
            memberCounts.GetValueOrDefault(g.Id), challengeCounts.GetValueOrDefault(g.Id),
            Fmt.Iso(g.CreatedAt)!)).ToList());
    }
}

// ---------- Group detail ----------

public sealed record AdminGroupDetailQuery(Guid GroupId) : IRequest<AdminGroupDetailDto>;

public sealed class AdminGroupDetailHandler(IAppDbContext db, ICurrentUser user) : IRequestHandler<AdminGroupDetailQuery, AdminGroupDetailDto>
{
    public async Task<AdminGroupDetailDto> Handle(AdminGroupDetailQuery request, CancellationToken ct)
    {
        var group = await db.Groups.AsNoTracking()
            .FirstOrDefaultAsync(g => g.Id == request.GroupId, ct)
            ?? throw new NotFoundException("Không tìm thấy nhóm");

        var groupDto = await GroupDtoHelper.ToDtoAsync(db, group, user.Id, ct);
        var challenges = await db.Challenges.AsNoTracking()
            .Where(c => c.GroupId == group.Id)
            .ToListAsync(ct);
        var (challengeDtos, stats) = await AdminUserDetailHandler.BuildChallengeStatsAsync(db, challenges, ct);

        return new AdminGroupDetailDto(groupDto, challenges
            .OrderBy(c => c.StartDate)
            .Select(c =>
            {
                var st = stats[c.Id];
                return new AdminChallengeStatsDto(challengeDtos[c.Id], st.Settled, st.Failed, st.Penalty);
            })
            .ToList());
    }
}

// ---------- Cấp / thu hồi quyền admin ----------

public sealed record SetUserAdminCommand(Guid UserId, bool IsAdmin) : IRequest<UserDto>;

public sealed class SetUserAdminHandler(IAppDbContext db, ICurrentUser current, IClock clock)
    : IRequestHandler<SetUserAdminCommand, UserDto>
{
    public async Task<UserDto> Handle(SetUserAdminCommand request, CancellationToken ct)
    {
        if (request.UserId == current.Id && !request.IsAdmin)
            throw new BusinessRuleException("Không thể tự thu hồi quyền admin của chính mình");

        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, ct)
            ?? throw new NotFoundException("Không tìm thấy người dùng");
        user.IsAdmin = request.IsAdmin;
        db.AdminAuditLogs.Add(new AdminAuditLog
        {
            AdminId = current.Id,
            Action = request.IsAdmin ? "GRANT_ADMIN" : "REVOKE_ADMIN",
            TargetType = "USER",
            TargetId = user.Id,
            Detail = $"User {user.DisplayName} <{user.Email}> {(request.IsAdmin ? "được cấp" : "bị thu hồi")} quyền admin",
            CreatedAt = clock.UtcNow
        });
        await db.SaveChangesAsync(ct);
        return user.ToDto();
    }
}
