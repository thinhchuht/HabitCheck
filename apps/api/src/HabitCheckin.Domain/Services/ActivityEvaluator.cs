using HabitCheckin.Domain.Entities;
using HabitCheckin.Domain.Enums;

namespace HabitCheckin.Domain.Services;

public sealed record ActivityEvaluation(
    Guid ActivityId,
    bool Passed,
    string? Reason,
    int? ActualMinutes,
    DateTimeOffset? FirstCheckinAt);

public static class ActivityEvaluator
{
    /// <summary>Cửa sổ check-in DEADLINE: sớm nhất N phút trước mốc giờ (2 giờ).</summary>
    public const int DeadlineEarlyMinutes = 120;

    /// <summary>Cửa sổ check-in DEADLINE: muộn nhất N phút sau mốc giờ (10 phút).</summary>
    public const int DeadlineLateMinutes = 10;

    /// <summary>
    /// Ngày neo của mốc DEADLINE trong ngày X. Mốc sớm (&lt; 02:00 — cửa sổ "2 giờ trước"
    /// xuyên qua nửa đêm) neo sang ngày hôm sau: mốc 0:00 trong ngày X là 0:00 TỐI X,
    /// cửa sổ [X 22:00 → X+1 00:10], check-in trong đó tính cho ngày X.
    /// </summary>
    public static DateOnly DeadlineAnchorDay(DateOnly day, TimeOnly deadlineTime)
        => deadlineTime < new TimeOnly(2, 0) ? day.AddDays(1) : day;

    /// <summary>Mốc giờ chính xác (instant) của DEADLINE trong ngày X.</summary>
    public static DateTimeOffset DeadlineAnchor(DateOnly day, TimeOnly deadlineTime, TimeZoneInfo tz)
        => ToInstant(DeadlineAnchorDay(day, deadlineTime), deadlineTime, tz);

    /// <summary>Cửa sổ check-in của ngày X: [mốc − 2 giờ, mốc + 10 phút].</summary>
    public static (DateTimeOffset Start, DateTimeOffset End) DeadlineWindow(DateOnly day, TimeOnly deadlineTime, TimeZoneInfo tz)
    {
        var anchor = DeadlineAnchor(day, deadlineTime, tz);
        return (anchor.AddMinutes(-DeadlineEarlyMinutes), anchor.AddMinutes(DeadlineLateMinutes));
    }

    public static ActivityEvaluation Evaluate(Activity a, DateOnly date, IReadOnlyList<CheckIn> dayCheckins, TimeZoneInfo tz)
    {
        var valid = dayCheckins.Where(c => c.ActivityId == a.Id && c.Status != CheckInStatus.Rejected).ToList();
        var rejectedOnly = valid.Count == 0 && dayCheckins.Any(c => c.ActivityId == a.Id && c.Status == CheckInStatus.Rejected);

        switch (a.Type)
        {
            case ActivityType.Deadline:
                {
                    var first = valid.OrderBy(c => c.CheckinAt).FirstOrDefault();
                    if (first is null)
                        return new ActivityEvaluation(a.Id, false, rejectedOnly ? "REJECTED" : "MISSING", null, null);
                    // Mốc sớm (< 02:00) neo sang ngày hôm sau — mốc 0:00 của ngày X là X+1 00:00.
                    var limit = DeadlineAnchor(date, a.DeadlineTime!.Value, tz).AddMinutes(DeadlineLateMinutes);
                    return first.CheckinAt <= limit
                        ? new ActivityEvaluation(a.Id, true, null, null, first.CheckinAt)
                        : new ActivityEvaluation(a.Id, false, "LATE", null, first.CheckinAt);
                }

            case ActivityType.Duration:
                {
                    // DURATION là "tick + 1 ảnh": PASS khi có 1 check-in hoàn thành trong ngày, không đo thời lượng.
                    var done = valid
                        .Where(c => c.Status == CheckInStatus.Completed)
                        .OrderBy(c => c.CheckinAt)
                        .FirstOrDefault();
                    if (done is null)
                        return new ActivityEvaluation(a.Id, false, rejectedOnly ? "REJECTED" : "MISSING", null, null);
                    return new ActivityEvaluation(a.Id, true, null, null, done.CheckinAt);
                }

            case ActivityType.Window:
                {
                    var start = ToInstant(date, a.WindowStart!.Value, tz);
                    var end = ToInstant(date, a.WindowEnd!.Value, tz);
                    var hit = valid.FirstOrDefault(c => c.CheckinAt >= start && c.CheckinAt <= end);
                    var first = valid.OrderBy(c => c.CheckinAt).FirstOrDefault();
                    return hit is not null
                        ? new ActivityEvaluation(a.Id, true, null, null, hit.CheckinAt)
                        : new ActivityEvaluation(
                            a.Id,
                            false,
                            valid.Count == 0 ? (rejectedOnly ? "REJECTED" : "MISSING") : "LATE",
                            null,
                            first?.CheckinAt);
                }

            default:
                throw new ArgumentOutOfRangeException(nameof(a), a.Type, "Unknown activity type");
        }
    }

    public static DateTimeOffset ToInstant(DateOnly d, TimeOnly t, TimeZoneInfo tz)
    {
        var local = d.ToDateTime(t);
        return new DateTimeOffset(local, tz.GetUtcOffset(local));
    }
}
