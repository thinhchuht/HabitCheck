using HabitCheckin.Application.Abstractions;
using HabitCheckin.Application.Common;
using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;
using HabitCheckin.Domain.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace HabitCheckin.Application.Services;

public class DaySettlementService : ISettlementService
{
    private readonly IAppDbContext _db;
    private readonly IClock _clock;
    private readonly IRealtimeNotifier _realtime;
    private readonly IMediaStorage _media;
    private readonly ILogger<DaySettlementService> _logger;

    public DaySettlementService(
        IAppDbContext db,
        IClock clock,
        IRealtimeNotifier realtime,
        IMediaStorage media,
        ILogger<DaySettlementService> logger)
    {
        _db = db;
        _clock = clock;
        _realtime = realtime;
        _media = media;
        _logger = logger;
    }

    public async Task ActivateChallengesAsync(CancellationToken ct = default)
    {
        var today = _clock.TodayLocal;
        // <= (không phải ==): lưới an toàn cho kỳ DRAFT tạo trong ngày, chưa bao giờ
        // được kích hoạt lazy (chưa ai mở trang Hôm nay / check-in).
        // Kỳ rỗng (0 hoạt động) giữ DRAFT — không có gì để khoá.
        var drafts = await _db.Challenges
            .Where(c => c.Status == ChallengeStatus.Draft && c.StartDate <= today && c.Activities.Any())
            .ToListAsync(ct);

        foreach (var c in drafts)
        {
            c.Status = ChallengeStatus.Active;
            c.LockedAt = _clock.UtcNow;
        }
        if (drafts.Count > 0)
        {
            await _db.SaveChangesAsync(ct);
            _logger.LogInformation("Kích hoạt {Count} challenge từ DRAFT sang ACTIVE", drafts.Count);
        }
    }

    public async Task SettleDayAsync(DateOnly date, bool closeOpenSessions, CancellationToken ct = default)
    {
        if (closeOpenSessions)
        {
            var open = await _db.CheckIns
                .Where(c => c.LocalDate == date && c.Status == CheckInStatus.Open)
                .ToListAsync(ct);
            foreach (var c in open) c.Status = CheckInStatus.Abandoned;
            if (open.Count > 0) await _db.SaveChangesAsync(ct);
        }

        var challenges = await _db.Challenges
            .Where(c => c.StartDate <= date && date <= c.EndDate
                        && (c.Status == ChallengeStatus.Active || c.Status == ChallengeStatus.Completed))
            .Select(c => c.Id)
            .ToListAsync(ct);

        foreach (var id in challenges)
            await SettleChallengeDayAsync(id, date, ct);
    }

    public async Task SettleChallengeDayAsync(Guid challengeId, DateOnly date, CancellationToken ct = default)
    {
        var challenge = await _db.Challenges.Include(c => c.User).FirstOrDefaultAsync(c => c.Id == challengeId, ct);
        if (challenge is null) return;

        var group = await _db.Groups.AsNoTracking().FirstAsync(g => g.Id == challenge.GroupId, ct);

        var activities = await _db.Activities
            .Where(a => a.ChallengeId == challengeId)
            .OrderBy(a => a.SortOrder)
            .ToListAsync(ct);
        if (activities.Count == 0) return;

        var activityIds = activities.Select(a => a.Id).ToList();
        var checkins = await _db.CheckIns
            .Where(c => c.UserId == challenge.UserId && c.LocalDate == date && activityIds.Contains(c.ActivityId))
            .ToListAsync(ct);

        var evaluations = activities
            .Select(a => (Activity: a, Eval: ActivityEvaluator.Evaluate(
                a, date, checkins.Where(c => c.ActivityId == a.Id).ToList(), _clock.LocalTimeZone)))
            .ToList();

        var penalty = PenaltyCalculator.Calculate(
            evaluations.Select(e => (e.Eval, e.Activity.OverridePenalty)), group.PenaltyTiers);

        var result = await _db.DailyResults
            .FirstOrDefaultAsync(r => r.ChallengeId == challengeId && r.LocalDate == date, ct);
        if (result is null)
        {
            result = new DailyResult { ChallengeId = challengeId, UserId = challenge.UserId, LocalDate = date };
            _db.DailyResults.Add(result);
        }

        result.TotalCount = activities.Count;
        result.PassedCount = evaluations.Count(e => e.Eval.Passed);
        result.FailedCount = evaluations.Count(e => !e.Eval.Passed);
        result.PenaltyAmount = penalty;
        result.Status = ResultStatus.Provisional;
        result.ComputedAt = _clock.UtcNow;

        var oldDetails = await _db.ActivityDayResults.Where(d => d.DailyResultId == result.Id).ToListAsync(ct);
        _db.ActivityDayResults.RemoveRange(oldDetails);
        foreach (var e in evaluations)
        {
            _db.ActivityDayResults.Add(new ActivityDayResult
            {
                DailyResultId = result.Id,
                ActivityId = e.Activity.Id,
                Passed = e.Eval.Passed,
                Reason = e.Eval.Reason,
                ActualMinutes = e.Eval.ActualMinutes,
                FirstCheckinAt = e.Eval.FirstCheckinAt
            });
        }

        await _db.SaveChangesAsync(ct);

        await _realtime.GroupAsync(challenge.GroupId, EventNames.DailyResultUpdated, new DailyResultUpdatedEvent(
            challenge.UserId.ToString(), Fmt.Date(date), result.FailedCount, result.PenaltyAmount, result.Status.ToString().ToUpperInvariant()), ct);
    }

    public async Task FinalizeDayAsync(DateOnly date, CancellationToken ct = default)
    {
        var results = await _db.DailyResults
            .Include(r => r.Challenge)
            .Where(r => r.LocalDate == date && r.Status == ResultStatus.Provisional)
            .ToListAsync(ct);

        foreach (var r in results)
        {
            r.Status = ResultStatus.Final;
            r.ComputedAt = _clock.UtcNow;

            if (r.PenaltyAmount > 0 && r.Challenge is not null)
            {
                var exists = await _db.PenaltyLedger.AnyAsync(e => e.DailyResultId == r.Id, ct);
                if (!exists)
                {
                    _db.PenaltyLedger.Add(new PenaltyLedgerEntry
                    {
                        GroupId = r.Challenge.GroupId,
                        UserId = r.UserId,
                        DailyResultId = r.Id,
                        Amount = r.PenaltyAmount,
                        Kind = LedgerKind.Penalty,
                        Note = $"Phạt ngày {Fmt.Date(r.LocalDate)} — {r.FailedCount} hoạt động fail",
                        CreatedAt = _clock.UtcNow
                    });
                }
            }
        }
        if (results.Count > 0) await _db.SaveChangesAsync(ct);

        // Challenge kết thúc (end_date == date) và mọi ngày đã FINAL → COMPLETED
        var finished = await _db.Challenges
            .Where(c => c.EndDate == date && c.Status == ChallengeStatus.Active)
            .ToListAsync(ct);
        foreach (var c in finished)
        {
            var allFinal = await _db.DailyResults
                .Where(r => r.ChallengeId == c.Id)
                .GroupBy(r => new { })
                .Select(g => g.All(r => r.Status == ResultStatus.Final))
                .FirstOrDefaultAsync(ct);
            if (allFinal)
            {
                c.Status = ChallengeStatus.Completed;
                await _db.SaveChangesAsync(ct);
            }
        }
    }

    public async Task SendRemindersAsync(CancellationToken ct = default)
    {
        var today = _clock.TodayLocal;
        var now = _clock.UtcNow;
        var evening = _clock.ToLocalTime(now) >= new TimeOnly(20, 0);

        var challenges = await _db.Challenges
            .Where(c => c.Status == ChallengeStatus.Active && c.StartDate <= today && today <= c.EndDate)
            .Include(c => c.Activities)
            .ToListAsync(ct);
        if (challenges.Count == 0) return;

        var users = await _db.Users
            .Where(u => challenges.Select(c => c.UserId).Contains(u.Id))
            .ToListAsync(ct);

        foreach (var challenge in challenges)
        {
            var user = users.FirstOrDefault(u => u.Id == challenge.UserId);
            if (user is null) continue;

            var dayCheckins = await _db.CheckIns
                .Where(c => c.UserId == user.Id && c.LocalDate == today)
                .ToListAsync(ct);

            foreach (var a in challenge.Activities)
            {
                var valid = dayCheckins.Any(c => c.ActivityId == a.Id && c.Status != CheckInStatus.Rejected);
                switch (a.Type)
                {
                    case ActivityType.Deadline when a.DeadlineTime is TimeOnly t && !valid:
                        {
                            var ahead = user.ReminderDeadlineAheadMinutes ?? 10;
                            // Nhắc tới khi cửa sổ check-in đóng (mốc +5 phút).
                            var deadline = ActivityEvaluator.ToInstant(today, t, _clock.LocalTimeZone)
                                .AddMinutes(ActivityEvaluator.DeadlineWindowMinutes);
                            var remindFrom = deadline.AddMinutes(-ahead);
                            if (now >= remindFrom && now <= deadline)
                            {
                                await _realtime.UserAsync(user.Id, EventNames.Reminder, new ReminderEvent(
                                    user.Id.ToString(), a.Id.ToString(),
                                    $"Sắp đến hạn '{a.Name}' lúc {t.ToString("HH:mm")} — nhớ check-in kẻo bị phạt!"), ct);
                            }
                            break;
                        }
                    case ActivityType.Duration when user.ReminderEndOfDay && evening && !valid:
                        {
                            await _realtime.UserAsync(user.Id, EventNames.Reminder, new ReminderEvent(
                                user.Id.ToString(), a.Id.ToString(),
                                $"Đêm muộn rồi — '{a.Name}' hôm nay bạn vẫn chưa check-in. Hoàn thành ngay để kịp ghi nhận!"), ct);
                            break;
                        }
                }
            }
        }
    }

    public async Task CleanOrphanMediaAsync(CancellationToken ct = default)
    {
        var now = _clock.UtcNow;
        var cutoff = now.AddHours(-24);

        var orphans = await _db.UploadIntents
            .Where(i => i.UsedAt == null && i.IntentAt < cutoff)
            .Select(i => i.Id)
            .ToListAsync(ct);
        foreach (var intentId in orphans)
        {
            try { await _media.DeleteAssetAsync(intentId.ToString("N"), ct); }
            catch (Exception ex) { _logger.LogWarning(ex, "Không xoá được orphan intent {IntentId}", intentId); }
        }

        var usedIds = await _db.CheckIns
            .SelectMany(c => new[] { c.CheckinMediaId, c.CheckoutMediaId })
            .Where(id => id != null)
            .Select(id => id!)
            .Distinct()
            .ToListAsync(ct);

        var unused = await _db.MediaAssets
            .Where(m => m.UploadedAt < cutoff)
            .ToListAsync(ct);
        foreach (var m in unused.Where(m => !usedIds.Contains(m.Id)))
        {
            try { await _media.DeleteAssetAsync(m.PublicId, ct); }
            catch (Exception ex) { _logger.LogWarning(ex, "Không xoá được orphan media {PublicId}", m.PublicId); }
        }
    }
}
