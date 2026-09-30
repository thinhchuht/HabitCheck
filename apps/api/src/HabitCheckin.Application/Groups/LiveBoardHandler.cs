using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Services;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Domain.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Groups;

// Snapshot bảng realtime hôm nay của nhóm.
public sealed record GetGroupLiveQuery(Guid GroupId) : IRequest<LiveBoardDto>;

public sealed class LiveBoardHandler(
    IAppDbContext db, ICurrentUser user, IClock clock, IPresenceTracker presence)
    : IRequestHandler<GetGroupLiveQuery, LiveBoardDto>
{
    public async Task<LiveBoardDto> Handle(GetGroupLiveQuery request, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var today = clock.TodayLocal;
        var tz = clock.LocalTimeZone;

        var member = await db.GroupMembers
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.GroupId == request.GroupId && m.UserId == user.Id, ct)
            ?? throw new UnauthorizedException("Bạn không phải thành viên của nhóm");

        var group = await db.Groups.AsNoTracking().FirstAsync(g => g.Id == request.GroupId, ct);
        var members = await db.GroupMembers.AsNoTracking()
            .Where(m => m.GroupId == request.GroupId)
            .OrderBy(m => m.JoinedAt)
            .ToListAsync(ct);
        var users = await db.Users.AsNoTracking()
            .Where(u => members.Select(m => m.UserId).Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);

        // Challenge đang active của từng thành viên phủ hôm nay — PHẢI lọc theo nhóm,
        // không thì kỳ của cùng thành viên ở nhóm khác bị trộn vào bảng này.
        var userIds = members.Select(m => m.UserId).ToList();
        var challenges = await db.Challenges.AsNoTracking()
            .Include(c => c.Activities)
            .Where(c => c.GroupId == request.GroupId
                        && c.Status == ChallengeStatus.Active
                        && c.StartDate <= today && c.EndDate >= today
                        && userIds.Contains(c.UserId))
            .ToListAsync(ct);
        foreach (var ch in challenges)
            ch.Activities.Sort((a, b) => a.SortOrder.CompareTo(b.SortOrder));

        var challengeByUser = challenges.ToDictionary(c => c.UserId);
        var challengeIds = challenges.Select(c => c.Id).ToList();
        var dayCheckins = await db.CheckIns.AsNoTracking()
            .Include(c => c.CheckinMedia)
            .Include(c => c.CheckoutMedia)
            .Where(c => c.LocalDate == today && challengeIds.Contains(c.Activity.ChallengeId))
            .OrderBy(c => c.CheckinAt)
            .ToListAsync(ct);

        var online = presence.GetOnlineUsers(request.GroupId);
        var memberDtos = new List<LiveMemberDto>();
        var totalExpectedPenalty = 0L;

        foreach (var m in members)
        {
            if (!users.TryGetValue(m.UserId, out var u)) continue;

            var items = new List<LiveItemDto>();
            long expected = 0;
            if (challengeByUser.TryGetValue(m.UserId, out var ch))
            {
                var userCheckins = dayCheckins.Where(c => c.UserId == m.UserId).ToList();
                var evals = new List<(Activity Activity, ActivityEvaluation Eval)>();
                foreach (var a in ch.Activities)
                {
                    var eval = ActivityEvaluator.Evaluate(a, today, userCheckins, tz);
                    evals.Add((a, eval));
                    var (state, failReason) = LiveStateHelper.Resolve(a, eval, userCheckins, today, now, tz);
                    var isLate = LiveStateHelper.IsLate(a, eval, today, now, tz);
                    items.Add(new LiveItemDto(a.Id.ToString(), state, failReason, a.Name, a.Icon, isLate));
                }
                expected = PenaltyCalculator.Calculate(
                    evals.Select(e => e.Eval), group.PenaltyTiers);
            }
            totalExpectedPenalty += expected;

            memberDtos.Add(new LiveMemberDto(
                u.Id.ToString(), u.DisplayName, u.AvatarUrl,
                online.Contains(u.Id), items, expected));
        }

        // Ticker: hoạt động mới nhất hôm nay
        var allActivities = challenges.SelectMany(ch => ch.Activities).ToList();
        var ticker = dayCheckins
            .TakeLast(20)
            .Reverse()
            .Select(c =>
            {
                var act = allActivities.FirstOrDefault(a => a.Id == c.ActivityId);
                var uname = users.TryGetValue(c.UserId, out var uu) ? uu.DisplayName : "Unknown";
                var actName = act?.Name ?? "Hoạt động";
                // DateTimeOffset.ToString("HH:mm") — KHÔNG dùng .TimeOfDay (TimeSpan không có format "HH").
                var localTime = c.CheckinAt.ToOffset(tz.GetUtcOffset(c.CheckinAt)).ToString("HH:mm");
                string text = c.CheckoutAt is not null
                    ? $"{uname} vừa kết thúc phiên {actName} ({c.DurationMinutes ?? 0} phút)"
                    : $"{uname} vừa check-in {actName} lúc {localTime}";
                var thumb = c.CheckinMedia?.ThumbnailUrl ?? c.CheckinMedia?.SecureUrl;
                return new TickerItemDto(c.Id.ToString(), c.UserId.ToString(), uname, actName, text,
                    Fmt.Iso(c.CheckinAt), thumb);
            })
            .ToList();

        return new LiveBoardDto(request.GroupId.ToString(), group.Name, Fmt.Date(today),
            Fmt.Iso(now), memberDtos, totalExpectedPenalty, ticker);
    }
}
