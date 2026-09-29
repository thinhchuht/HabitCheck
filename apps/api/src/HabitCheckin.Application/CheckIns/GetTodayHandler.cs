using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Challenges;
using HabitCheckin.Application.Common;
using HabitCheckin.Application.Dtos;
using HabitCheckin.Application.Services;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Domain.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace HabitCheckin.Application.CheckIns;

/// <summary>Trang "Hôm nay": hoạt động của tôi + trạng thái live + phiên đang mở + phạt dự kiến.</summary>
public sealed record GetTodayQuery(Guid GroupId) : IRequest<TodayDto>;

public sealed class GetTodayHandler(IAppDbContext db, ICurrentUser user, IClock clock)
    : IRequestHandler<GetTodayQuery, TodayDto>
{
    public async Task<TodayDto> Handle(GetTodayQuery request, CancellationToken ct)
    {
        var now = clock.UtcNow;
        var today = clock.TodayLocal;
        var tz = clock.LocalTimeZone;

        var isMember = await db.GroupMembers.AnyAsync(m => m.GroupId == request.GroupId && m.UserId == user.Id, ct);
        if (!isMember) throw new UnauthorizedException("Bạn không phải thành viên của nhóm");

        var challenge = await db.Challenges
            .Include(c => c.Activities)
            .FirstOrDefaultAsync(c => c.UserId == user.Id && c.GroupId == request.GroupId
                                      && (c.Status == ChallengeStatus.Active || c.Status == ChallengeStatus.Draft)
                                      && c.StartDate <= today && c.EndDate >= today, ct);
        challenge?.Activities.Sort((a, b) => a.SortOrder.CompareTo(b.SortOrder));
        // Kỳ DRAFT đặt sẵn (start_date đã đến) tự kích hoạt khi mở trang Hôm nay.
        if (challenge is not null)
            await ChallengeAccess.ActivateIfDueAsync(db, challenge, today, now, ct);

        List<TodayItemDto> items = [];
        long expectedPenalty = 0;
        ChallengeDto? challengeDto = null;

        if (challenge is not null)
        {
            var ownerName = await db.Users.AsNoTracking()
                .Where(u => u.Id == user.Id).Select(u => u.DisplayName).FirstAsync(ct);
            challengeDto = challenge.ToDto(ownerName, challenge.Activities);
            var dayCheckins = await db.CheckIns.AsNoTracking()
                .Include(c => c.CheckinMedia)
                .Include(c => c.CheckoutMedia)
                .Where(c => c.UserId == user.Id && c.LocalDate == today
                            && c.Activity.ChallengeId == challenge.Id)
                .OrderBy(c => c.CheckinAt)
                .ToListAsync(ct);

            var group = await db.Groups.AsNoTracking().FirstAsync(g => g.Id == challenge.GroupId, ct);

            var evals = new List<(Activity Activity, ActivityEvaluation Eval)>();
            items = challenge.Activities.Select(a =>
            {
                var eval = ActivityEvaluator.Evaluate(a, today, dayCheckins, tz);
                evals.Add((a, eval));

                var (state, failReason) = LiveStateHelper.Resolve(a, eval, dayCheckins, today, now, tz);
                var isLate = LiveStateHelper.IsLate(a, eval, today, now, tz);

                string? deadlineAt = null;
                if (a.Type == ActivityType.Deadline && a.DeadlineTime is TimeOnly t)
                    // Mốc giờ chính xác — frontend tự tính cửa sổ check-in ±5 phút.
                    deadlineAt = Fmt.Iso(ActivityEvaluator.ToInstant(today, t, tz));
                else if (a.Type == ActivityType.Window && a.WindowEnd is TimeOnly w)
                    deadlineAt = Fmt.Iso(ActivityEvaluator.ToInstant(today, w, tz));

                var checkins = dayCheckins
                    .Where(c => c.ActivityId == a.Id)
                    .Select(c => c.ToDto(a.Name, a.Icon))
                    .ToList();

                return new TodayItemDto(a.ToDto(), state, failReason, isLate, deadlineAt, null, checkins);
            }).ToList();

            expectedPenalty = PenaltyCalculator.Calculate(
                evals.Select(e => e.Eval), group.PenaltyTiers);
        }

        TodayResultDto? result = null;
        if (challenge is not null)
        {
            var dr = await db.DailyResults.AsNoTracking()
                .FirstOrDefaultAsync(d => d.ChallengeId == challenge.Id && d.LocalDate == today, ct);
            if (dr is not null)
                result = new TodayResultDto(dr.TotalCount, dr.PassedCount, dr.FailedCount, dr.PenaltyAmount, dr.Status);
        }

        return new TodayDto(
            Fmt.Date(today),
            Fmt.Iso(now),
            tz.Id,
            challengeDto,
            items,
            expectedPenalty,
            result);
    }
}
