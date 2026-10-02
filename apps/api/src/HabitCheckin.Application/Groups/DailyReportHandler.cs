using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Domain.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.Groups;

// Bảng kiểm tra của cả nhóm theo khoảng ngày (mặc định hôm nay → hôm nay).
public sealed record GetGroupDailyReportQuery(Guid GroupId, DateOnly? From, DateOnly? To) : IRequest<DailyReportDto>;

public sealed class GetGroupDailyReportHandler(
    IAppDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<GetGroupDailyReportQuery, DailyReportDto>
{
    public async Task<DailyReportDto> Handle(GetGroupDailyReportQuery request, CancellationToken ct)
    {
        var today = clock.TodayLocal;
        var tz = clock.LocalTimeZone;
        var to = request.To ?? today;
        var from = request.From ?? to;
        if (to > today)
            throw new BusinessRuleException("Không xem được báo cáo cho ngày trong tương lai");
        if (from > to)
            throw new BusinessRuleException("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
        if (to.DayNumber - from.DayNumber > 91)
            throw new BusinessRuleException("Khoảng ngày tối đa 92 ngày");

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

        // Lọc theo khoảng ngày chứ KHÔNG theo Status == Active: kỳ quá khứ đã
        // COMPLETED vẫn phải xem được. CANCELLED thì loại.
        var userIds = members.Select(m => m.UserId).ToList();
        var challenges = await db.Challenges.AsNoTracking()
            .Include(c => c.Activities)
            .Where(c => c.GroupId == request.GroupId
                        && c.Status != ChallengeStatus.Cancelled
                        && c.StartDate <= to && c.EndDate >= from
                        && userIds.Contains(c.UserId))
            .ToListAsync(ct);
        foreach (var ch in challenges)
            ch.Activities.Sort((a, b) => a.SortOrder.CompareTo(b.SortOrder));

        var challengeByUser = challenges.ToDictionary(c => c.UserId);
        var challengeIds = challenges.Select(c => c.Id).ToList();
        var dayCheckins = await db.CheckIns.AsNoTracking()
            .Where(c => c.LocalDate >= from && c.LocalDate <= to
                        && challengeIds.Contains(c.Activity.ChallengeId))
            .ToListAsync(ct);
        var checkinsByUserDay = dayCheckins
            .GroupBy(c => (UserId: c.UserId, Date: c.LocalDate))
            .ToDictionary(g => g.Key, g => g.ToList());

        // Kết quả đã chốt trong khoảng (job 00:05/12:00) — nếu có thì hiển thị trạng thái.
        var settled = await db.DailyResults.AsNoTracking()
            .Where(d => d.LocalDate >= from && d.LocalDate <= to
                        && challengeIds.Contains(d.ChallengeId))
            .ToListAsync(ct);
        var settledByChallengeDate = settled
            .GroupBy(d => (ChallengeId: d.ChallengeId, Date: d.LocalDate))
            .ToDictionary(g => g.Key, g => g.First().Status);

        // Ngày cheat trong khoảng: trung lập, không tính phạt.
        var cheatUserDays = await db.CheatDays.AsNoTracking()
            .Where(c => c.GroupId == request.GroupId && c.LocalDate >= from && c.LocalDate <= to)
            .Select(c => new ValueTuple<Guid, DateOnly>(c.UserId, c.LocalDate))
            .ToListAsync(ct);
        var cheatSet = new HashSet<(Guid, DateOnly)>(cheatUserDays);

        var memberDtos = new List<DailyReportMemberDto>();
        var totalPenalty = 0L;

        foreach (var m in members)
        {
            if (!users.TryGetValue(m.UserId, out var u)) continue;

            var days = new List<DailyReportDayDto>();
            var memberPenalty = 0L;
            var noFailDays = 0;

            for (var d = from; d <= to; d = d.AddDays(1))
            {
                if (challengeByUser.TryGetValue(m.UserId, out var ch)
                    && ch.StartDate <= d && ch.EndDate >= d)
                {
                    var isCheat = cheatSet.Contains((m.UserId, d));
                    ResultStatus? resultStatus = null;
                    if (settledByChallengeDate.TryGetValue((ch.Id, d), out var drStatus))
                        resultStatus = drStatus;

                    var chDto = new DailyReportChallengeDto(
                        ch.Id.ToString(), ch.Title, Fmt.Date(ch.StartDate), Fmt.Date(ch.EndDate),
                        ch.Status);

                    if (isCheat)
                    {
                        days.Add(new DailyReportDayDto(
                            Fmt.Date(d), chDto, true, ch.Activities.Count, 0, 0, 0, resultStatus,
                            ch.Activities
                                .Select(a => new DailyReportActivityDto(
                                    a.Id.ToString(), a.Name, a.Icon, a.Type, null, null, null))
                                .ToList()));
                    }
                    else
                    {
                        checkinsByUserDay.TryGetValue((m.UserId, d), out var userCheckins);
                        userCheckins ??= [];
                        var evals = new List<(Activity Activity, ActivityEvaluation Eval)>();
                        var activityDtos = new List<DailyReportActivityDto>();
                        int passed = 0, failed = 0;
                        foreach (var a in ch.Activities)
                        {
                            var eval = ActivityEvaluator.Evaluate(a, d, userCheckins, tz);
                            evals.Add((a, eval));
                            if (eval.Passed) passed++; else failed++;
                            activityDtos.Add(new DailyReportActivityDto(
                                a.Id.ToString(), a.Name, a.Icon, a.Type,
                                eval.Passed, eval.Reason, Fmt.Iso(eval.FirstCheckinAt)));
                        }
                        var penalty = PenaltyCalculator.Calculate(
                            evals.Select(e => e.Eval), group.PenaltyTiers);
                        memberPenalty += penalty;
                        if (failed == 0) noFailDays++;
                        days.Add(new DailyReportDayDto(
                            Fmt.Date(d), chDto, false, ch.Activities.Count, passed, failed,
                            penalty, resultStatus, activityDtos));
                    }
                }
                else
                {
                    // Ngày không có kỳ nào phủ: hàng trống (—).
                    days.Add(new DailyReportDayDto(
                        Fmt.Date(d), null, false, 0, 0, 0, 0, null, []));
                }
            }

            totalPenalty += memberPenalty;
            memberDtos.Add(new DailyReportMemberDto(
                u.Id.ToString(), u.DisplayName, u.AvatarUrl, days, memberPenalty, noFailDays));
        }

        return new DailyReportDto(request.GroupId.ToString(), group.Name,
            Fmt.Date(from), Fmt.Date(to), memberDtos, totalPenalty);
    }
}
