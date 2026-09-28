using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Stats;

// ---------- Stats cá nhân ----------

public sealed class GetUserStatsHandler(IAppDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<GetUserStatsCommand, PersonalStatsDto>
{
    public async Task<PersonalStatsDto> Handle(GetUserStatsCommand cmd, CancellationToken ct)
    {
        var today = clock.TodayLocal;
        var tz = clock.LocalTimeZone;

        var to = ParseDate(cmd.To) ?? today;
        var from = ParseDate(cmd.From) ?? to.AddDays(-29);
        if (from > to) (from, to) = (to, from);

        var challenges = await db.Challenges.AsNoTracking()
            .Include(c => c.Activities)
            .Where(c => c.UserId == user.Id && c.Status != ChallengeStatus.Cancelled
                        && c.StartDate <= to && c.EndDate >= from)
            .ToListAsync(ct);
        var challengeIds = challenges.Select(c => c.Id).ToList();

        var results = await db.DailyResults.AsNoTracking()
            .Include(d => d.Details)
            .Where(d => d.UserId == user.Id && challengeIds.Contains(d.ChallengeId)
                        && d.LocalDate >= from && d.LocalDate <= to)
            .ToListAsync(ct);
        var resultByDate = results.ToDictionary(r => r.LocalDate);

        // Streak trên các ngày theo lịch
        bool IsGoodDay(DateOnly d, out int? failed, out int? total)
        {
            if (resultByDate.TryGetValue(d, out var r))
            {
                failed = r.FailedCount; total = r.TotalCount;
                return r.FailedCount == 0 && r.TotalCount > 0;
            }
            failed = null; total = null;
            return false;
        }

        var currentStreak = 0;
        for (var d = to; d >= from; d = d.AddDays(-1))
        {
            if (d == today && !resultByDate.ContainsKey(d)) continue; // ngày chưa chốt → bỏ qua
            if (IsGoodDay(d, out _, out _)) currentStreak++;
            else break;
        }

        var bestStreak = 0; var run = 0;
        for (var d = from; d <= to; d = d.AddDays(1))
        {
            if (d == today && !resultByDate.ContainsKey(d)) { run = 0; continue; }
            if (IsGoodDay(d, out _, out _)) { run++; bestStreak = Math.Max(bestStreak, run); }
            else run = 0;
        }

        var byDay = new List<StatDayDto>();
        for (var d = from; d <= to; d = d.AddDays(1))
        {
            var r = resultByDate.GetValueOrDefault(d);
            byDay.Add(new StatDayDto(Fmt.Date(d), r?.PassedCount ?? 0, r?.FailedCount ?? 0,
                r?.TotalCount ?? 0, r?.PenaltyAmount ?? 0));
        }

        // Theo hoạt động
        var checkins = await db.CheckIns.AsNoTracking()
            .Include(c => c.Activity)
            .Where(c => c.UserId == user.Id && challengeIds.Contains(c.Activity.ChallengeId)
                        && c.LocalDate >= from && c.LocalDate <= to)
            .ToListAsync(ct);

        var detailByActivity = results
            .SelectMany(r => r.Details.Select(det => (det, r)))
            .GroupBy(x => x.det.ActivityId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var byActivity = challenges
            .SelectMany(c => c.Activities)
            .GroupBy(a => a.Id)
            .Select(g =>
            {
                var a = g.First();
                var details = detailByActivity.GetValueOrDefault(a.Id) ?? [];
                var totalDays = details.Count;
                var passedDays = details.Count(x => x.det.Passed);
                double rate = totalDays == 0 ? 0 : Math.Round((double)passedDays / totalDays, 4);

                string? avgCheckinTime = null;
                if (a.Type == ActivityType.Deadline)
                {
                    var times = checkins.Where(c => c.ActivityId == a.Id)
                        .Select(c => (int)(c.CheckinAt.ToOffset(tz.GetUtcOffset(c.CheckinAt)).TimeOfDay.TotalMinutes))
                        .ToList();
                    if (times.Count > 0)
                    {
                        var avg = (int)Math.Round(times.Average());
                        avgCheckinTime = $"{avg / 60:00}:{avg % 60:00}";
                    }
                }

                int? avgMinutes = null;
                if (a.Type == ActivityType.Duration)
                {
                    var sessions = checkins.Where(c => c.ActivityId == a.Id
                        && c.Status == CheckInStatus.Completed && c.DurationMinutes is not null)
                        .Select(c => c.DurationMinutes!.Value).ToList();
                    if (sessions.Count > 0) avgMinutes = (int)Math.Round(sessions.Average());
                }

                long activityPenalty = details
                    .Where(x => !x.det.Passed)
                    .Where(x => a.OverridePenalty.HasValue)
                    .Sum(x => a.OverridePenalty!.Value);

                return new StatActivityDto(a.Id.ToString(), a.Name, a.Icon, rate, activityPenalty,
                    avgCheckinTime, avgMinutes);
            })
            .OrderByDescending(x => x.CompletionRate)
            .ToList();

        var byChallenge = challenges
            .Select(c =>
            {
                var rs = results.Where(r => r.ChallengeId == c.Id).ToList();
                var total = rs.Sum(r => r.TotalCount);
                var passed = rs.Sum(r => r.PassedCount);
                return new StatChallengeDto(
                    c.Id.ToString(), c.Title, Fmt.Date(c.StartDate), Fmt.Date(c.EndDate),
                    total == 0 ? 0 : Math.Round((double)passed / total, 4),
                    rs.Sum(r => r.PenaltyAmount));
            })
            .OrderByDescending(x => x.CompletionRate)
            .ToList();

        var totalDays = results.Count;
        var passedDays = results.Count(r => r.FailedCount == 0 && r.TotalCount > 0);

        return new PersonalStatsDto(
            Fmt.Date(from), Fmt.Date(to),
            totalDays, passedDays,
            totalDays == 0 ? 0 : Math.Round((double)passedDays / totalDays, 4),
            currentStreak, bestStreak,
            results.Sum(r => r.PenaltyAmount),
            byDay, byActivity, byChallenge);
    }

    private static DateOnly? ParseDate(string? s) =>
        !string.IsNullOrWhiteSpace(s) && DateOnly.TryParse(s, out var d) ? d : null;
}

// ---------- Heatmap ----------

public sealed class GetHeatmapHandler(IAppDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<GetHeatmapCommand, HeatmapDto>
{
    public async Task<HeatmapDto> Handle(GetHeatmapCommand cmd, CancellationToken ct)
    {
        var year = cmd.Year ?? clock.TodayLocal.Year;
        var yearStart = new DateOnly(year, 1, 1);
        var yearEnd = new DateOnly(year, 12, 31);

        var challenges = await db.Challenges.AsNoTracking()
            .Where(c => c.UserId == user.Id && c.Status != ChallengeStatus.Cancelled
                        && c.StartDate <= yearEnd && c.EndDate >= yearStart)
            .ToListAsync(ct);
        var challengeIds = challenges.Select(c => c.Id).ToList();

        var results = await db.DailyResults.AsNoTracking()
            .Where(d => d.UserId == user.Id && challengeIds.Contains(d.ChallengeId)
                        && d.LocalDate >= yearStart && d.LocalDate <= yearEnd)
            .ToListAsync(ct);
        var resultByDate = results.ToDictionary(r => r.LocalDate);

        var days = new List<HeatmapDayDto>();
        foreach (var ch in challenges)
        {
            var start = ch.StartDate < yearStart ? yearStart : ch.StartDate;
            var end = ch.EndDate > yearEnd ? yearEnd : ch.EndDate;
            for (var d = start; d <= end; d = d.AddDays(1))
            {
                if (days.Any(x => x.Date == d.ToString("yyyy-MM-dd"))) continue;
                if (resultByDate.TryGetValue(d, out var r))
                {
                    var state = r.FailedCount == 0 ? "PASS" : r.FailedCount == 1 ? "PARTIAL" : "FAIL";
                    days.Add(new HeatmapDayDto(d.ToString("yyyy-MM-dd"), state, r.FailedCount, r.TotalCount));
                }
                else
                {
                    days.Add(new HeatmapDayDto(d.ToString("yyyy-MM-dd"), "NONE", 0, 0));
                }
            }
        }

        return new HeatmapDto(year, days.OrderBy(x => x.Date).ToList());
    }
}

// ---------- Leaderboard ----------

public sealed class GetLeaderboardHandler(IAppDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<GetLeaderboardCommand, List<LeaderboardRowDto>>
{
    public async Task<List<LeaderboardRowDto>> Handle(GetLeaderboardCommand cmd, CancellationToken ct)
    {
        var today = clock.TodayLocal;
        var to = !string.IsNullOrWhiteSpace(cmd.To) && DateOnly.TryParse(cmd.To, out var t) ? t : today;
        var from = !string.IsNullOrWhiteSpace(cmd.From) && DateOnly.TryParse(cmd.From, out var f) ? f : to.AddDays(-29);
        if (from > to) (from, to) = (to, from);

        var members = await db.GroupMembers.AsNoTracking()
            .Where(m => m.GroupId == cmd.GroupId)
            .ToListAsync(ct);
        var isMember = members.Any(m => m.UserId == user.Id);
        if (!isMember) throw new UnauthorizedException("Bạn không phải thành viên của nhóm");

        var userIds = members.Select(m => m.UserId).ToList();
        var users = await db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, ct);

        var challenges = await db.Challenges.AsNoTracking()
            .Where(c => c.GroupId == cmd.GroupId && c.Status != ChallengeStatus.Cancelled
                        && c.StartDate <= to && c.EndDate >= from
                        && userIds.Contains(c.UserId))
            .ToListAsync(ct);

        var challengeIds = challenges.Select(c => c.Id).ToList();
        var results = await db.DailyResults.AsNoTracking()
            .Where(d => challengeIds.Contains(d.ChallengeId) && d.LocalDate >= from && d.LocalDate <= to)
            .ToListAsync(ct);

        var rows = new List<(Guid UserId, int Total, int Passed, long Penalty, double Rate, int Current, int Best)>();
        foreach (var m in members)
        {
            if (!users.TryGetValue(m.UserId, out var u)) continue;
            var rs = results.Where(r => r.UserId == m.UserId).ToList();
            var total = rs.Sum(r => r.TotalCount);
            var passed = rs.Sum(r => r.PassedCount);
            var penalty = rs.Sum(r => r.PenaltyAmount);
            var rate = total == 0 ? 0 : Math.Round((double)passed / total, 4);

            // streak
            var resultByDate = rs.ToDictionary(r => r.LocalDate);
            bool Good(DateOnly d) => resultByDate.TryGetValue(d, out var r) && r.FailedCount == 0 && r.TotalCount > 0;

            var current = 0;
            for (var d = to; d >= from; d = d.AddDays(-1))
            {
                if (d == today && !resultByDate.ContainsKey(d)) continue;
                if (Good(d)) current++; else break;
            }
            var best = 0; var run = 0;
            for (var d = from; d <= to; d = d.AddDays(1))
            {
                if (d == today && !resultByDate.ContainsKey(d)) { run = 0; continue; }
                if (Good(d)) { run++; best = Math.Max(best, run); } else run = 0;
            }

            rows.Add((m.UserId, total, passed, penalty, rate, current, best));
        }

        var ranked = rows
            .OrderByDescending(r => r.Rate)
            .ThenBy(r => r.Penalty)
            .ToList();

        return ranked.Select((r, i) => new LeaderboardRowDto(
            i + 1,
            r.UserId.ToString(),
            users[r.UserId].DisplayName,
            users[r.UserId].AvatarUrl,
            r.Total, r.Passed, r.Rate, r.Penalty, r.Current, r.Best)).ToList();
    }
}
